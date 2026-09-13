package ru.stoloto.balloon.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.stoloto.balloon.config.GameConfig;
import ru.stoloto.balloon.config.GameConfigService;
import ru.stoloto.balloon.game.RoundEngine;
import ru.stoloto.balloon.repo.GameRoundRepository;
import ru.stoloto.balloon.repo.UserAccountRepository;
import ru.stoloto.balloon.service.RtpSimulator;
import ru.stoloto.balloon.service.TournamentService;

import java.util.List;

import ru.stoloto.balloon.web.dto.GameDtos;

/**
 * Административное API: управление игровыми параметрами без правки кода.
 *
 * <p>Пишет в тот же {@code config/game-config.yaml}, который можно править
 * руками, поэтому оба способа управления полностью равнозначны и не могут
 * разойтись. Значения проходят ту же валидацию, что и при чтении файла: если
 * они некорректны, файл не изменяется и продолжает работать предыдущая версия.
 *
 * <p>Доступ ограничен аккаунтом {@code expert}: демо-профили играют, но не
 * меняют конфигурацию.
 */
@RestController
@RequestMapping("/api/admin")
@Tag(name = "7. Администрирование", description = "Игровые параметры, их проверка и Monte-Carlo симуляция")
public class AdminController {

    private final GameConfigService configService;
    private final RtpSimulator simulator;
    private final RoundEngine engine;
    private final GameRoundRepository rounds;
    private final UserAccountRepository users;
    private final TournamentService tournamentService;

    public AdminController(GameConfigService configService,
                           RtpSimulator simulator,
                           RoundEngine engine,
                           GameRoundRepository rounds,
                           UserAccountRepository users,
                           TournamentService tournamentService) {
        this.configService = configService;
        this.simulator = simulator;
        this.engine = engine;
        this.rounds = rounds;
        this.users = users;
        this.tournamentService = tournamentService;
    }

    @GetMapping("/config")
    @Operation(summary = "Текущая игровая конфигурация",
            description = "Полный объект в том же виде, в каком он лежит в config/game-config.yaml")
    public GameConfig config(AuthContext context) {
        AdminAccess.requireExpert(context);
        return configService.current();
    }

    @GetMapping("/config/status")
    @Operation(summary = "Состояние конфигурации",
            description = """
                    Путь к файлу, время последнего применения, номер ревизии и ошибки последней
                    отклонённой попытки. Если поле `valid` равно false, значит на диске лежит
                    некорректная версия, а в игре работает предыдущая рабочая.
                    """)
    public GameConfigService.ConfigStatus status(AuthContext context) {
        AdminAccess.requireExpert(context);
        return configService.status();
    }

    @PostMapping("/config/validate")
    @Operation(summary = "Проверить черновик без сохранения",
            description = "Возвращает список ошибок на русском языке; пустой список означает, что значения допустимы")
    public ValidationResponse validate(AuthContext context, @RequestBody GameConfig candidate) {
        AdminAccess.requireExpert(context);
        List<String> errors = configService.dryRun(candidate);
        return new ValidationResponse(errors.isEmpty(), errors);
    }

    @PutMapping("/config")
    @Operation(summary = "Сохранить и применить конфигурацию",
            description = """
                    Записывает значения в YAML-файл (с сохранением пояснений) и применяет их к
                    каждому новому раунду. Уже летящие раунды доигрываются на своих параметрах.
                    При ошибках валидации отвечает кодом 422 и не меняет файл.
                    """)
    public GameConfig save(AuthContext context, @RequestBody GameConfig candidate) {
        AdminAccess.requireExpert(context);
        return configService.save(candidate, "admin:" + context.user().getNickname());
    }

    @PostMapping("/config/reset")
    @Operation(summary = "Вернуть заводские значения")
    public GameConfig reset(AuthContext context) {
        AdminAccess.requireExpert(context);
        return configService.resetToDefaults();
    }

    @PostMapping("/simulate")
    @Operation(summary = "Monte-Carlo симуляция игровой экономики",
            description = """
                    Прогоняет заданное число раундов по каждому из четырёх вариантов ставки и
                    возвращает RTP, долю выигрышных раундов, вероятность дожить до бустера и
                    средние коэффициенты.

                    Если в теле передана конфигурация (`config`), симуляция идёт по ней — так
                    админка показывает последствия правок до сохранения. Иначе используется
                    активная конфигурация. Поле `seed` делает серию воспроизводимой.
                    """)
    public RtpSimulator.SimulationReport simulate(AuthContext context, @RequestBody SimulateRequest request) {
        AdminAccess.requireExpert(context);
        GameConfig config = request.config() != null ? request.config() : configService.current();
        if (request.config() != null) {
            List<String> errors = configService.dryRun(request.config());
            if (!errors.isEmpty()) {
                throw new GameConfigService.ConfigRejectedException(errors);
            }
        }
        RtpSimulator.Strategy strategy = request.strategy() == null
                ? RtpSimulator.Strategy.WAIT_FOR_BOOST
                : RtpSimulator.Strategy.valueOf(request.strategy());
        String theme = request.theme() == null ? GameConfig.THEME_GREEN : request.theme();
        int rounds = request.rounds() == null ? 50_000 : request.rounds();

        return simulator.simulate(config, theme, strategy, rounds,
                request.targetMultiplier(), request.targetLevel(), request.seed());
    }

    @GetMapping("/stats")
    @Operation(summary = "Оперативные показатели прототипа",
            description = "Активные раунды, размеры таблиц и состояние симуляции соперников")
    public RuntimeStats stats(AuthContext context) {
        AdminAccess.requireExpert(context);
        return new RuntimeStats(
                engine.activeCount(),
                rounds.count(),
                users.count(),
                users.countByBotTrue(),
                tournamentService.participantCount(),
                tournamentService.simulationTickCount(),
                configService.status().appliedRevisions(),
                configService.configPath().toString());
    }

    @GetMapping("/tournament")
    @Operation(summary = "Состояние текущего турнира",
            description = "Таблица лидеров среди реальных игроков и настроенные призы для админ-панели")
    public GameDtos.AdminTournamentStatusDto tournamentStatus(AuthContext context) {
        AdminAccess.requireExpert(context);
        TournamentService.AdminTournamentStatus status = tournamentService.adminStatus();
        return new GameDtos.AdminTournamentStatusDto(
                status.enabled(), status.active(), status.name(), status.tournamentId(),
                status.endsAt(), status.secondsLeft(), status.participants(), status.prizes(),
                status.leaders().stream()
                        .map(entry -> new GameDtos.AdminTournamentLeaderDto(
                                entry.userId(), entry.nickname(), entry.points(), entry.position()))
                        .toList());
    }

    @PostMapping("/tournament/finish")
    @Operation(summary = "Досрочно завершить турнир и выдать призы",
            description = """
                    Фиксирует текущую таблицу, начисляет бонусные баллы победителям по списку
                    `tournament.prizes` (боты не участвуют), обнуляет игровые очки и открывает
                    новый турнир с длительностью из конфигурации.
                    """)
    public GameDtos.TournamentFinishResultDto finishTournament(AuthContext context) {
        AdminAccess.requireExpert(context);
        TournamentService.FinishResult result = tournamentService.finishTournamentNow();
        return new GameDtos.TournamentFinishResultDto(
                result.finishedTournamentId(), result.finishedTournamentName(), result.finishedAt(),
                result.awards().stream()
                        .map(award -> new GameDtos.TournamentPrizeAwardDto(
                                award.userId(), award.nickname(), award.position(),
                                award.points(), award.bonusAwarded()))
                        .toList(),
                result.nextTournamentId(), result.nextTournamentName(), result.nextEndsAt());
    }

    public record ValidationResponse(boolean valid, List<String> errors) {
    }

    /**
     * @param config опциональный черновик конфигурации: позволяет проверить
     *               последствия правок до их сохранения
     */
    public record SimulateRequest(GameConfig config, String theme, String strategy,
                                  Integer rounds, Double targetMultiplier,
                                  Integer targetLevel, Long seed) {
    }

    public record RuntimeStats(int activeRounds, long totalRounds, long totalUsers,
                               long simulatedOpponents, int ratingParticipants,
                               long simulationTicks, long configRevision, String configPath) {
    }
}
