package ru.stoloto.balloon.service;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.stoloto.balloon.config.GameConfig;
import ru.stoloto.balloon.config.GameConfigService;
import ru.stoloto.balloon.domain.Tournament;
import ru.stoloto.balloon.domain.UserAccount;
import ru.stoloto.balloon.game.event.GameEvents;
import ru.stoloto.balloon.repo.TournamentRepository;
import ru.stoloto.balloon.repo.UserAccountRepository;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.LongAdder;

/**
 * Турнир и живой рейтинг.
 *
 * <h2>Почему очки живут в памяти</h2>
 * Очки меняются на каждом пересечённом уровне, то есть несколько раз в
 * секунду на каждого игрока в полёте. Писать это в БД синхронно — гарантированный
 * тормоз и лишние блокировки. Поэтому актуальные очки лежат в
 * {@link ConcurrentHashMap} и служат источником правды для рейтинга, а в БД
 * сбрасываются по завершении раунда и раз в несколько секунд фоновой задачей.
 * При перезапуске значения снова поднимаются из БД.
 */
@Service
public class TournamentService {

    private static final Logger log = LoggerFactory.getLogger(TournamentService.class);
    private static final String ANONYMOUS_PREFIX = "***";

    private final UserAccountRepository users;
    private final TournamentRepository tournaments;
    private final GameConfigService configService;
    private final ApplicationEventPublisher events;

    /** Актуальные очки: userId -> очки. Источник правды для живого рейтинга. */
    private final Map<Long, AtomicLong> livePoints = new ConcurrentHashMap<>();
    private final Map<Long, String> nicknames = new ConcurrentHashMap<>();
    private final Set<Long> botIds = ConcurrentHashMap.newKeySet();
    private final Set<Long> dirty = ConcurrentHashMap.newKeySet();
    private final LongAdder simulationTicks = new LongAdder();

    private volatile long lastSimulationAt;

    public TournamentService(UserAccountRepository users,
                             TournamentRepository tournaments,
                             GameConfigService configService,
                             ApplicationEventPublisher events) {
        this.users = users;
        this.tournaments = tournaments;
        this.configService = configService;
        this.events = events;
    }

    @PostConstruct
    @Transactional(readOnly = true)
    public void warmUp() {
        for (UserAccount user : users.findAll()) {
            track(user);
        }
        log.info("Живой рейтинг загружен: {} участников", livePoints.size());
    }

    /** Регистрирует игрока в рейтинге (при создании аккаунта или прогреве). */
    public void track(UserAccount user) {
        livePoints.computeIfAbsent(user.getId(), id -> new AtomicLong(user.getGamePoints()))
                .set(user.getGamePoints());
        nicknames.put(user.getId(), user.getNickname());
        if (user.isBot()) {
            botIds.add(user.getId());
        }
    }

    // --------------------------------------------------------- очки в полёте

    /** Начисление очков в реальном времени. Возвращает новое значение. */
    public long addLivePoints(long userId, long delta) {
        if (delta == 0) {
            return livePoints(userId);
        }
        dirty.add(userId);
        return livePoints.computeIfAbsent(userId, id -> new AtomicLong()).addAndGet(delta);
    }

    public long livePoints(long userId) {
        AtomicLong value = livePoints.get(userId);
        return value == null ? 0 : value.get();
    }

    /** Приводит память к значению из БД после того, как раунд рассчитан. */
    public void syncFromDatabase(long userId, long persistedPoints) {
        livePoints.computeIfAbsent(userId, id -> new AtomicLong()).set(persistedPoints);
        dirty.remove(userId);
    }

    /** Периодический сброс накопленных очков в БД: разгружает горячий путь. */
    @Scheduled(fixedDelay = 5000L)
    @Transactional
    public void flushDirtyScores() {
        if (dirty.isEmpty()) {
            return;
        }
        List<Long> batch = new ArrayList<>(dirty);
        dirty.removeAll(batch);
        for (Long userId : batch) {
            AtomicLong points = livePoints.get(userId);
            if (points == null) {
                continue;
            }
            users.findById(userId).ifPresent(user -> user.setGamePoints(points.get()));
        }
    }

    // ------------------------------------------------------------- рейтинг

    /**
     * Строка живого рейтинга над игровым экраном: срез верхних участников,
     * в который всегда попадает текущий игрок.
     */
    public List<GameEvents.RatingEntry> liveRating(Long currentUserId) {
        GameConfig.TournamentConfig config = configService.current().tournament();
        List<GameEvents.RatingEntry> full = fullRating(currentUserId);
        int limit = Math.min(config.liveRatingSize(), full.size());
        List<GameEvents.RatingEntry> slice = new ArrayList<>(full.subList(0, limit));

        boolean containsCurrent = slice.stream().anyMatch(entry -> entry.userId() == (currentUserId == null ? -1 : currentUserId));
        if (!containsCurrent && currentUserId != null) {
            full.stream()
                    .filter(entry -> entry.userId() == currentUserId)
                    .findFirst()
                    .ifPresent(entry -> {
                        if (!slice.isEmpty()) {
                            slice.set(slice.size() - 1, entry);
                        } else {
                            slice.add(entry);
                        }
                    });
        }
        return slice;
    }

    /** Полная турнирная таблица. Участники с равными очками идут рядом. */
    public List<GameEvents.RatingEntry> fullRating(Long currentUserId) {
        boolean anonymize = configService.current().tournament().anonymizeNames();
        List<Map.Entry<Long, AtomicLong>> sorted = new ArrayList<>(livePoints.entrySet());
        sorted.sort(Comparator
                .comparingLong((Map.Entry<Long, AtomicLong> entry) -> entry.getValue().get()).reversed()
                .thenComparing(Map.Entry::getKey));

        List<GameEvents.RatingEntry> result = new ArrayList<>(sorted.size());
        for (int i = 0; i < sorted.size(); i++) {
            Long userId = sorted.get(i).getKey();
            boolean isCurrent = currentUserId != null && currentUserId.equals(userId);
            String nickname = nicknames.getOrDefault(userId, "player" + userId);
            result.add(new GameEvents.RatingEntry(
                    userId,
                    isCurrent || !anonymize ? nickname : mask(nickname),
                    sorted.get(i).getValue().get(),
                    i + 1,
                    botIds.contains(userId)
            ));
        }
        return result;
    }

    public int positionOf(long userId) {
        long points = livePoints(userId);
        int position = 1;
        for (Map.Entry<Long, AtomicLong> entry : livePoints.entrySet()) {
            if (entry.getValue().get() > points) {
                position++;
            }
        }
        return position;
    }

    public int participantCount() {
        return livePoints.size();
    }

    /** Деперсонализация: первые три символа имени заменяются на «***». */
    private static String mask(String nickname) {
        if (nickname == null || nickname.isEmpty()) {
            return ANONYMOUS_PREFIX;
        }
        return nickname.length() <= 3
                ? ANONYMOUS_PREFIX
                : ANONYMOUS_PREFIX + nickname.substring(3);
    }

    // -------------------------------------------------------------- турнир

    @Transactional
    public Tournament ensureActiveTournament() {
        GameConfig.TournamentConfig config = configService.current().tournament();
        Instant now = Instant.now();
        Optional<Tournament> existing = tournaments.findFirstByActiveTrueOrderByStartsAtDesc();
        if (existing.isPresent()) {
            Tournament tournament = existing.get();
            if (!tournament.getName().equals(config.name())) {
                tournament.rename(config.name());
            }
            if (tournament.getEndsAt().isBefore(now)) {
                // Турнир истёк: в прототипе он продлевается, чтобы таймер был виден экспертам.
                tournament.reschedule(now.plus(Duration.ofDays(config.durationDays())));
            }
            return tournament;
        }
        Tournament created = new Tournament(config.name(), now,
                now.plus(Duration.ofDays(config.durationDays())));
        return tournaments.save(created);
    }

    @Transactional(readOnly = true)
    public TournamentInfo info() {
        GameConfig.TournamentConfig config = configService.current().tournament();
        if (!config.enabled()) {
            return new TournamentInfo(false, config.name(), null, 0, participantCount());
        }
        Optional<Tournament> tournament = tournaments.findFirstByActiveTrueOrderByStartsAtDesc();
        if (tournament.isEmpty()) {
            return new TournamentInfo(false, config.name(), null, 0, participantCount());
        }
        Instant endsAt = tournament.get().getEndsAt();
        long secondsLeft = Math.max(0, Duration.between(Instant.now(), endsAt).getSeconds());
        return new TournamentInfo(secondsLeft > 0, tournament.get().getName(), endsAt,
                secondsLeft, participantCount());
    }

    // ------------------------------------------------- симуляция соперников

    /**
     * Соперники-боты двигают свои очки, чтобы живой рейтинг «дышал» даже при
     * одном реальном игроке. Выключается параметром
     * {@code tournament.simulation.enabled}.
     */
    @Scheduled(fixedDelay = 1000L)
    public void simulateOpponents() {
        GameConfig.SimulationConfig simulation = configService.current().tournament().simulation();
        if (!simulation.enabled() || botIds.isEmpty()) {
            return;
        }
        long now = System.currentTimeMillis();
        if (now - lastSimulationAt < simulation.tickSeconds() * 1000L) {
            return;
        }
        lastSimulationAt = now;
        simulationTicks.increment();

        List<Long> bots = new ArrayList<>(botIds);
        int moving = Math.max(1, bots.size() / 4);
        for (int i = 0; i < moving; i++) {
            Long botId = bots.get((int) (Math.random() * bots.size()));
            long delta = (long) (Math.random() * simulation.maxPointsPerTick());
            if (delta > 0) {
                addLivePoints(botId, delta);
            }
        }
        events.publishEvent(new GameEvents.RatingUpdated(liveRating(null)));
    }

    public long simulationTickCount() {
        return simulationTicks.sum();
    }

    public record TournamentInfo(boolean active, String name, Instant endsAt,
                                 long secondsLeft, int participants) {
    }
}
