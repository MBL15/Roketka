package ru.stoloto.balloon.game;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import ru.stoloto.balloon.config.GameConfig;
import ru.stoloto.balloon.config.GameConfigService;
import ru.stoloto.balloon.config.GameConfigUpdatedEvent;
import ru.stoloto.balloon.domain.GameRound;
import ru.stoloto.balloon.game.event.GameEvents;
import ru.stoloto.balloon.service.RoundSettlementService;
import ru.stoloto.balloon.service.TournamentService;

import java.util.Collection;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

/**
 * Игровой цикл: единственный источник правды о том, что происходит в полёте.
 *
 * <h2>Почему один поток на все раунды</h2>
 * Состояние полёта — чистая функция от времени старта и параметров раунда,
 * поэтому обслуживать N одновременных раундов можно одним тикером, проходящим
 * по карте активных раундов. Поток на раунд не создаётся, число потоков не
 * зависит от числа игроков.
 *
 * <h2>Почему тик не обращается к базе</h2>
 * Тик только считает и публикует события. Запись в БД (cashout, завершение
 * раунда) выполняется в отдельном пуле, поэтому задержка СУБД не может
 * «просадить» частоту игрового цикла.
 *
 * <h2>Почему клиенту хватает 30 тиков в секунду для 60 FPS</h2>
 * Клиент получает время старта и темп роста и вычисляет коэффициент той же
 * формулой локально на каждом кадре. Серверные тики нужны для синхронизации,
 * событий уровней и авторитетного завершения, а не для отрисовки.
 */
@Component
public class RoundEngine {

    private static final Logger log = LoggerFactory.getLogger(RoundEngine.class);

    private final GameConfigService configService;
    private final RoundSettlementService settlementService;
    private final TournamentService tournamentService;
    private final ApplicationEventPublisher events;

    private final ConcurrentHashMap<Long, ActiveRound> active = new ConcurrentHashMap<>();
    private final ScheduledExecutorService ticker =
            Executors.newSingleThreadScheduledExecutor(runnable -> {
                Thread thread = new Thread(runnable, "balloon-tick");
                thread.setDaemon(true);
                return thread;
            });
    private final ExecutorService settlementPool =
            Executors.newFixedThreadPool(2, runnable -> {
                Thread thread = new Thread(runnable, "balloon-settle");
                thread.setDaemon(true);
                return thread;
            });

    private volatile ScheduledFuture<?> tickTask;
    private volatile long tickPeriodMillis;

    public RoundEngine(GameConfigService configService,
                       RoundSettlementService settlementService,
                       TournamentService tournamentService,
                       ApplicationEventPublisher events) {
        this.configService = configService;
        this.settlementService = settlementService;
        this.tournamentService = tournamentService;
        this.events = events;
    }

    @PostConstruct
    void start() {
        reschedule(resolveTickPeriod(configService.current()));
    }

    @PreDestroy
    void stop() {
        ticker.shutdownNow();
        settlementPool.shutdown();
    }

    /** Частота тиков берётся из конфигурации и меняется вместе с ней. */
    @EventListener
    void onConfigUpdated(GameConfigUpdatedEvent event) {
        long period = resolveTickPeriod(event.config());
        if (period != tickPeriodMillis) {
            reschedule(period);
        }
    }

    private void reschedule(long periodMillis) {
        ScheduledFuture<?> previous = tickTask;
        if (previous != null) {
            previous.cancel(false);
        }
        tickPeriodMillis = periodMillis;
        tickTask = ticker.scheduleAtFixedRate(this::tick, 0, periodMillis, TimeUnit.MILLISECONDS);
        log.info("Игровой цикл запущен с периодом {} мс ({} тиков/с)", periodMillis, 1000 / periodMillis);
    }

    private static long resolveTickPeriod(GameConfig config) {
        int fps = config.themes().values().stream()
                .map(GameConfig.ThemeConfig::math)
                .mapToInt(GameConfig.MathConfig::fps)
                .max()
                .orElse(30);
        return Math.max(10, 1000L / Math.max(1, fps));
    }

    // -------------------------------------------------------------- публичное

    /** Ставит раунд в полёт. Вызывается сразу после списания ставки. */
    public ActiveRound register(GameRound round) {
        ActiveRound activeRound = new ActiveRound(round);
        active.put(round.getId(), activeRound);
        return activeRound;
    }

    public Optional<ActiveRound> find(long roundId) {
        return Optional.ofNullable(active.get(roundId));
    }

    /** Активный раунд игрока: позволяет продолжить полёт после перезагрузки страницы. */
    public Optional<ActiveRound> findByUser(long userId) {
        return active.values().stream().filter(round -> round.userId() == userId).findFirst();
    }

    public Collection<ActiveRound> activeRounds() {
        return active.values();
    }

    public int activeCount() {
        return active.size();
    }

    /**
     * Фиксация выигрыша по авторитетному серверному коэффициенту.
     * Клиент не передаёт коэффициент — он его только показывает.
     */
    public ActiveRound.CashoutOutcome cashout(long roundId, long userId) {
        ActiveRound round = active.get(roundId);
        if (round == null) {
            return ActiveRound.CashoutOutcome.rejected("Раунд не найден среди активных");
        }
        if (round.userId() != userId) {
            return ActiveRound.CashoutOutcome.rejected("Раунд принадлежит другому игроку");
        }
        return round.cashout(System.currentTimeMillis());
    }

    /**
     * Досрочное завершение: используется при восстановлении после перезапуска,
     * когда время полёта раунда уже истекло.
     */
    public Future<?> forceSettle(ActiveRound round) {
        active.remove(round.roundId());
        if (!round.beginSettlement()) {
            return java.util.concurrent.CompletableFuture.completedFuture(null);
        }
        return settlementPool.submit(() -> settle(round));
    }

    // ------------------------------------------------------------ игровой цикл

    private void tick() {
        long now = System.currentTimeMillis();
        for (ActiveRound round : active.values()) {
            try {
                tickRound(round, now);
            } catch (Exception e) {
                log.error("Сбой тика раунда {}: {}", round.roundId(), e.getMessage(), e);
            }
        }
    }

    private void tickRound(ActiveRound round, long now) {
        if (round.crashReached(now)) {
            if (active.remove(round.roundId()) != null && round.beginSettlement()) {
                settlementPool.submit(() -> settle(round));
            }
            return;
        }

        ActiveRound.Progress progress = round.advance(now);

        for (ActiveRound.LevelCrossed level : progress.levelsCrossed) {
            long livePoints = tournamentService.addLivePoints(round.userId(), level.pointsAwarded());
            events.publishEvent(new GameEvents.LevelCrossed(
                    round.roundId(), round.userId(), level.level(),
                    round.snapshot(now).levelCount(), level.pointsAwarded(), level.totalPoints(), livePoints));
        }

        if (progress.boostActivated != null) {
            ActiveRound.BoostActivated boost = progress.boostActivated;
            long livePoints = tournamentService.addLivePoints(round.userId(), boost.pointsAwarded());
            events.publishEvent(new GameEvents.BoostActivated(
                    round.roundId(), round.userId(), boost.level(), boost.boostValue(),
                    boost.multiplier(), boost.pointsAwarded(), boost.totalPoints(), livePoints));
        }

        events.publishEvent(new GameEvents.RoundTick(
                round.roundId(), round.userId(), round.snapshot(now),
                tournamentService.livePoints(round.userId())));
    }

    private void settle(ActiveRound round) {
        try {
            settlementService.settle(round);
        } catch (Exception e) {
            log.error("Не удалось рассчитать раунд {}: {}", round.roundId(), e.getMessage(), e);
        }
    }
}
