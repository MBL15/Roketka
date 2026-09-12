package ru.stoloto.balloon.service;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.stoloto.balloon.config.GameConfig;
import ru.stoloto.balloon.config.GameConfigService;
import ru.stoloto.balloon.domain.GameRound;
import ru.stoloto.balloon.domain.RoundParameters;
import ru.stoloto.balloon.domain.RoundStatus;
import ru.stoloto.balloon.domain.UserAccount;
import ru.stoloto.balloon.game.ActiveRound;
import ru.stoloto.balloon.game.CrashMath;
import ru.stoloto.balloon.game.FairnessService;
import ru.stoloto.balloon.game.RoundEngine;
import ru.stoloto.balloon.game.event.GameEvents;
import ru.stoloto.balloon.repo.GameRoundRepository;
import ru.stoloto.balloon.repo.UserAccountRepository;
import ru.stoloto.balloon.web.dto.GameDtos;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Жизненный цикл раунда: ставка, полёт, фиксация выигрыша, результат.
 *
 * <p>Здесь собрана вся авторитетная логика, которую клиент не может обойти:
 * <ul>
 *   <li>точка краха и уровень бустера генерируются до первого кадра анимации
 *       и сразу записываются в БД;</li>
 *   <li>коэффициент cashout берётся из серверного времени, а не из запроса;</li>
 *   <li>выплата считается по серверной ставке и серверному коэффициенту.</li>
 * </ul>
 */
@Service
public class RoundService {

    private static final List<RoundStatus> TERMINAL = List.of(RoundStatus.WON, RoundStatus.LOST);

    private final GameConfigService configService;
    private final FairnessService fairness;
    private final RoundEngine engine;
    private final GameRoundRepository rounds;
    private final UserAccountRepository users;
    private final TournamentService tournamentService;
    private final RewardService rewardService;
    private final UpsellService upsellService;
    private final PlayerProgressionService playerProgressionService;
    private final AchievementService achievementService;
    private final ApplicationEventPublisher events;

    public RoundService(GameConfigService configService,
                        FairnessService fairness,
                        RoundEngine engine,
                        GameRoundRepository rounds,
                        UserAccountRepository users,
                        TournamentService tournamentService,
                        RewardService rewardService,
                        UpsellService upsellService,
                        PlayerProgressionService playerProgressionService,
                        AchievementService achievementService,
                        ApplicationEventPublisher events) {
        this.configService = configService;
        this.fairness = fairness;
        this.engine = engine;
        this.rounds = rounds;
        this.users = users;
        this.tournamentService = tournamentService;
        this.rewardService = rewardService;
        this.upsellService = upsellService;
        this.playerProgressionService = playerProgressionService;
        this.achievementService = achievementService;
        this.events = events;
    }

    // ------------------------------------------------------------ старт раунда

    /** Идентификатор «произвольной» ставки без бустера (своя сумма или весь баланс). */
    private static final int CUSTOM_BET_OPTION_ID = 0;

    private record ResolvedBet(int betOptionId, long cost, int boostTier, double alphaShift) {
    }

    @Transactional
    public GameDtos.StartRoundResponse start(UserAccount account, String themeKey,
                                             Integer betOptionId, Long betAmount, String clientSeed) {
        GameConfig config = configService.current();
        GameConfig.ThemeConfig theme = config.theme(themeKey);
        if (!theme.active()) {
            throw new RoundRejectedException("Тема «" + theme.gameName() + "» отключена в конфигурации");
        }

        UserAccount user = users.findById(account.getId()).orElseThrow();
        if (engine.findByUser(user.getId()).isPresent()) {
            throw new RoundRejectedException("У вас уже есть незавершённый раунд");
        }

        ResolvedBet bet = resolveBet(theme, betOptionId, betAmount, user.getBonusBalance());
        if (user.getBonusBalance() < bet.cost()) {
            throw new UserAccount.InsufficientBalanceException(user.getBonusBalance(), bet.cost());
        }

        boolean showOnboarding = !user.isOnboardingSeen();
        user.debitBonus(bet.cost());
        user.markOnboardingSeen();

        String serverSeed = fairness.newServerSeed();
        String seedHash = fairness.sha256(serverSeed);
        String usedClientSeed = normalizeClientSeed(clientSeed);
        long nonce = rounds.countByUserIdAndStatusIn(user.getId(), TERMINAL) + 1;

        GameConfig.MathConfig math = theme.math();
        double alpha = math.alpha() + bet.alphaShift();
        double crashMultiplier = CrashMath.sampleCrashPoint(
                fairness.uniform(serverSeed, usedClientSeed, nonce, FairnessService.NAMESPACE_CRASH),
                alpha, math.houseEdge(), math.minCrashMultiplier(), math.maxMultiplier(), math.delta());

        double boostValue = theme.boostValue(bet.boostTier());
        Integer boostLevel = null;
        if (bet.boostTier() > 1) {
            boostLevel = CrashMath.pickBoostLevel(
                    fairness.uniform(serverSeed, usedClientSeed, nonce, FairnessService.NAMESPACE_LOOT),
                    theme.lootProbabilities());
        }

        boolean boostReachable = boostLevel != null && theme.levelThreshold(boostLevel) <= crashMultiplier;
        double maxReachable = CrashMath.quantizeDown(
                crashMultiplier * (boostReachable ? boostValue : 1.0), math.delta());

        RoundParameters parameters = new RoundParameters(
                alpha, math.houseEdge(), math.minCrashMultiplier(), math.maxMultiplier(),
                math.multiplierGrowthRate(), math.delta(), math.fps(), math.maxFlightSeconds(),
                theme.levelMultipliers(), theme.lootProbabilities(),
                theme.points().perLine(), theme.points().cashoutBonus(),
                theme.points().boostBonus(bet.boostTier()));

        GameRound round = rounds.save(new GameRound(
                user.getId(), user.getNickname(), themeKey, bet.betOptionId(), bet.cost(),
                bet.boostTier(), boostValue, boostLevel,
                crashMultiplier, maxReachable,
                serverSeed, seedHash, usedClientSeed, nonce,
                parameters, Instant.now()));

        engine.register(round);

        return new GameDtos.StartRoundResponse(
                round.getId(), themeKey, bet.cost(),
                bet.boostTier(), boostValue,
                normalizedChances(theme.lootProbabilities()),
                theme.levelCount(), theme.levelMultipliers(),
                math.multiplierGrowthRate(), math.delta(), math.maxMultiplier(),
                theme.levelThreshold(1),
                round.getStartedAt().toEpochMilli(), System.currentTimeMillis(),
                seedHash, usedClientSeed, nonce,
                user.getBonusBalance(), showOnboarding,
                new GameDtos.PointsDto(theme.points().perLine(), theme.points().cashoutBonus(),
                        theme.points().boostBonusPerTier()));
    }

    private ResolvedBet resolveBet(GameConfig.ThemeConfig theme, Integer betOptionId, Long betAmount, long balance) {
        if (betAmount != null) {
            if (betAmount <= 0) {
                throw new IllegalArgumentException("Сумма ставки должна быть больше 0");
            }
            if (balance < betAmount) {
                throw new UserAccount.InsufficientBalanceException(balance, betAmount);
            }
            return new ResolvedBet(CUSTOM_BET_OPTION_ID, betAmount, 1, 0.0);
        }
        if (betOptionId == null) {
            throw new IllegalArgumentException("Не выбран вариант ставки");
        }
        GameConfig.BetOptionConfig option = theme.betOption(betOptionId);
        return new ResolvedBet(option.id(), option.cost(), option.boostTier(), option.alphaShift());
    }

    // ---------------------------------------------------------------- cashout

    @Transactional
    public GameDtos.CashoutResponse cashout(UserAccount account, long roundId) {
        ActiveRound.CashoutOutcome outcome = engine.cashout(roundId, account.getId());
        if (!outcome.accepted()) {
            throw new RoundRejectedException(outcome.reason());
        }

        GameRound round = rounds.findById(roundId).orElseThrow();
        UserAccount user = users.findById(account.getId()).orElseThrow();
        user.creditBonus(outcome.payout());
        user.recordBonusEarned(outcome.payout());

        round.applyCashout(outcome.multiplier(), outcome.payout(), outcome.levelsPassed(),
                outcome.boostApplied(), outcome.totalPoints());

        long livePoints = tournamentService.addLivePoints(user.getId(), outcome.pointsAwarded());
        user.setGamePoints(livePoints);

        PlayerProgressionService.AwardResult progression = playerProgressionService.awardForCashout(
                user, round.getTheme(), outcome.multiplier());
        List<GameDtos.AchievementDto> newAchievements = achievementService.onCashout(
                user, round, outcome.multiplier(), progression.levelUp());

        events.publishEvent(new GameEvents.CashoutAccepted(roundId, user.getId(),
                outcome.multiplier(), outcome.payout(), user.getBonusBalance(), outcome.totalPoints()));

        return new GameDtos.CashoutResponse(roundId, outcome.multiplier(), outcome.payout(),
                user.getBonusBalance(), outcome.pointsAwarded(), outcome.totalPoints(),
                "Могли бы забрать больше",
                progression.snapshot().playerLevel(), progression.snapshot().playerXp(),
                progression.snapshot().xpToNextLevel(), progression.snapshot().displayProfitBonus(),
                progression.xpGained(), progression.levelUp(), newAchievements);
    }

    // ------------------------------------------------------- состояние раунда

    /** Состояние летящего раунда: WebSocket и polling используют один и тот же источник. */
    @Transactional(readOnly = true)
    public Optional<GameDtos.RoundStateDto> state(UserAccount user, long roundId) {
        Optional<ActiveRound> active = engine.find(roundId)
                .filter(round -> round.userId() == user.getId());
        if (active.isPresent()) {
            return Optional.of(toStateDto(active.get()));
        }
        return rounds.findById(roundId)
                .filter(round -> round.getUserId().equals(user.getId()))
                .map(this::toFinishedStateDto);
    }

    /** Незавершённый раунд игрока: позволяет вернуться в полёт после перезагрузки страницы. */
    @Transactional(readOnly = true)
    public Optional<GameDtos.RoundStateDto> activeRound(UserAccount user) {
        return engine.findByUser(user.getId()).map(this::toStateDto);
    }

    private GameDtos.RoundStateDto toStateDto(ActiveRound round) {
        long now = System.currentTimeMillis();
        ActiveRound.Snapshot snapshot = round.snapshot(now);
        GameRound stored = rounds.findById(round.roundId()).orElseThrow();
        RoundParameters parameters = stored.getParameters();
        return new GameDtos.RoundStateDto(
                snapshot.roundId(),
                snapshot.cashedOut() ? RoundStatus.CASHED_OUT.name() : RoundStatus.FLYING.name(),
                snapshot.theme(), snapshot.betAmount(),
                snapshot.baseMultiplier(), snapshot.multiplier(),
                snapshot.levelsPassed(), snapshot.levelCount(),
                // Позиция бустера раскрывается только после срабатывания.
                snapshot.boostApplied() ? snapshot.boostLevel() : null,
                normalizedChances(parameters.lootProbabilities()),
                snapshot.boostTier(), snapshot.boostValue(), snapshot.boostApplied(),
                snapshot.cashoutMultiplier(), snapshot.payout(), snapshot.points(),
                snapshot.elapsedSeconds(), now,
                stored.getStartedAt().toEpochMilli(), parameters.growthRate(), parameters.delta(),
                parameters.maxMultiplier(), parameters.levelMultipliers());
    }

    private GameDtos.RoundStateDto toFinishedStateDto(GameRound round) {
        RoundParameters parameters = round.getParameters();
        return new GameDtos.RoundStateDto(
                round.getId(), round.getStatus().name(), round.getTheme(), round.getBetAmount(),
                round.getCrashMultiplier(), round.getCrashMultiplier(),
                round.getLevelsPassed(), parameters.levelCount(),
                // Раунд завершён — скрывать позицию бустера уже незачем.
                round.getBoostLevel(), normalizedChances(parameters.lootProbabilities()),
                round.getBoostTier(), round.getBoostValue(), round.isBoostApplied(),
                round.getCashoutMultiplier(), round.getPayout(), round.getPointsEarned(),
                0, System.currentTimeMillis(),
                round.getStartedAt().toEpochMilli(), parameters.growthRate(), parameters.delta(),
                parameters.maxMultiplier(), parameters.levelMultipliers());
    }

    // ------------------------------------------------------- экран результата

    @Transactional
    public GameDtos.RoundResultDto result(String sessionToken, UserAccount account, long roundId) {
        GameRound round = rounds.findById(roundId)
                .filter(item -> item.getUserId().equals(account.getId()))
                .orElseThrow(() -> new RoundRejectedException("Раунд не найден"));
        if (!round.getStatus().isTerminal()) {
            throw new RoundNotFinishedException(round.getStatus());
        }
        UserAccount user = users.findById(account.getId()).orElseThrow();
        RoundParameters parameters = round.getParameters();

        int fromLevels = round.getLevelsPassed() * parameters.pointsPerLine();
        int fromCashout = round.getCashoutMultiplier() != null ? parameters.pointsCashoutBonus() : 0;
        int fromBoost = round.isBoostApplied() ? parameters.pointsBoostBonus() : 0;
        int fromReward = Math.max(0, round.getPointsEarned() - fromLevels - fromCashout - fromBoost);

        boolean won = round.getStatus() == RoundStatus.WON;
        RewardService.CollectionState collection = rewardService.state(user);
        PlayerProgressionService.Snapshot progression = playerProgressionService.snapshot(user);
        List<GameDtos.AchievementDto> roundAchievements = achievementService.unlockedInRound(user, roundId);

        return new GameDtos.RoundResultDto(
                round.getId(), round.getStatus().name(), won, round.getTheme(),
                round.getBetAmount(), round.getPayout(), round.getPayout() - round.getBetAmount(),
                round.getCashoutMultiplier(), round.getCrashMultiplier(), round.getMaxReachableMultiplier(),
                round.getLevelsPassed(), parameters.levelCount(),
                round.getBoostLevel(), round.getBoostTier(), round.getBoostValue(), round.isBoostApplied(),
                new GameDtos.PointsBreakdownDto(round.getPointsEarned(), fromLevels, fromCashout,
                        fromBoost, fromReward),
                new GameDtos.RewardGrantDto(
                        round.getRewardFragmentIndex() != null,
                        collection.collectionName(),
                        round.getCollectionLevel() == null ? collection.collectionLevel() : round.getCollectionLevel(),
                        round.getRewardFragmentIndex(), round.isRewardDuplicate(), round.isCollectionCompleted(),
                        fromReward, round.isCollectionCompleted() ? configCompletionBalance() : 0,
                        collection.ownedFragments().size(), collection.collectionSize()),
                new GameDtos.FairnessProofDto(
                        round.getServerSeed(), round.getServerSeedHash(), round.getClientSeed(),
                        round.getNonce(), parameters.alpha(), parameters.houseEdge(),
                        parameters.minCrashMultiplier(), parameters.maxMultiplier(),
                        "/api/fairness/verify?roundId=" + round.getId()),
                user.getBonusBalance(), user.getGamePoints(),
                tournamentService.positionOf(user.getId()),
                progression.playerLevel(), progression.playerXp(), progression.xpToNextLevel(),
                progression.displayProfitBonus(),
                roundAchievements,
                upsellService.prepareOffer(sessionToken, user, round),
                round.getStartedAt(), round.getFinishedAt());
    }

    private long configCompletionBalance() {
        return configService.current().reward().completionBonusBalance();
    }

    // --------------------------------------------------------------- история

    /**
     * Общая история завершённых раундов всех игроков прототипа.
     * Обязательна по постановке и не зависит от наличия турниров.
     */
    @Transactional(readOnly = true)
    public List<GameDtos.HistoryEntryDto> sharedHistory(Long currentUserId, int limit) {
        int size = limit > 0 ? limit : configService.current().session().historySize();
        return rounds.findByStatusInOrderByFinishedAtDesc(TERMINAL, Limit.of(size)).stream()
                .map(round -> toHistoryEntry(round, currentUserId))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<GameDtos.HistoryEntryDto> personalHistory(UserAccount user, int limit) {
        int size = limit > 0 ? limit : configService.current().session().historySize();
        return rounds.findByUserIdAndStatusInOrderByFinishedAtDesc(user.getId(), TERMINAL, Limit.of(size)).stream()
                .map(round -> toHistoryEntry(round, user.getId()))
                .toList();
    }

    private GameDtos.HistoryEntryDto toHistoryEntry(GameRound round, Long currentUserId) {
        return new GameDtos.HistoryEntryDto(
                round.getId(), round.getNickname(), round.getTheme(), round.getBetAmount(),
                round.getCashoutMultiplier(), round.getCrashMultiplier(), round.getPayout(),
                round.getStatus() == RoundStatus.WON, round.getLevelsPassed(),
                round.getBoostTier(), round.isBoostApplied(), round.getPointsEarned(),
                round.getFinishedAt(), currentUserId != null && currentUserId.equals(round.getUserId()));
    }

    /**
     * Приводит веса уровней к вероятностям, суммирующимся в единицу.
     *
     * <p>В конфигурации веса не обязаны быть нормированы — так их удобнее
     * править руками. Клиенту же нужны именно вероятности: по ним подсвечивается,
     * на каких уровнях бустер встречается чаще.
     */
    private List<Double> normalizedChances(List<Double> weights) {
        double sum = weights.stream().mapToDouble(Double::doubleValue).sum();
        if (sum <= 0) {
            return weights.stream().map(weight -> 0.0).toList();
        }
        return weights.stream().map(weight -> Math.round(weight / sum * 10_000.0) / 10_000.0).toList();
    }

    private String normalizeClientSeed(String clientSeed) {
        if (clientSeed == null || clientSeed.isBlank()) {
            return fairness.newClientSeed();
        }
        String trimmed = clientSeed.trim();
        return trimmed.length() > 64 ? trimmed.substring(0, 64) : trimmed;
    }

    // ------------------------------------------------------------------ ошибки

    public static class RoundRejectedException extends RuntimeException {
        public RoundRejectedException(String message) {
            super(message);
        }
    }

    /** Результат запрошен до того, как шар лопнул: выигрыш уже зафиксирован, но раунд не закрыт. */
    public static class RoundNotFinishedException extends RuntimeException {
        private final RoundStatus status;

        public RoundNotFinishedException(RoundStatus status) {
            super("Раунд ещё не завершён, текущий статус: " + status);
            this.status = status;
        }

        public RoundStatus status() {
            return status;
        }
    }
}
