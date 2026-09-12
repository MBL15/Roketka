package ru.stoloto.balloon.web.dto;

import java.time.Instant;
import java.util.List;

/**
 * Контракты REST API.
 *
 * <p>Собраны в одном файле осознанно: это внешняя граница системы, и видеть
 * её целиком полезнее, чем открывать три десятка однострочных файлов.
 * Внутренние сущности наружу не отдаются — только эти записи.
 *
 * <p>Ключевое правило: до момента краха клиент не получает ни точки краха, ни
 * потенциального максимума (он равен точке краха). Наружу уходит лишь хеш
 * серверного зерна как обязательство.
 */
public final class GameDtos {

    private GameDtos() {
    }

    // ------------------------------------------------------------- аккаунт

    public record LoginRequest(String nickname, String password) {
    }

    public record AuthResponse(String token, PlayerDto player) {
    }

    public record PlayerDto(long id, String nickname, long bonusBalance, long gamePoints,
                            int lotteryTickets, int roundsPlayed, boolean onboardingSeen,
                            int tournamentPosition, int collectionLevel,
                            int playerLevel, int playerXp, int xpToNextLevel,
                            double displayProfitBonus,
                            List<AchievementDto> achievements) {
    }

    public record AchievementDto(String id, String title, String description, String icon,
                                 String category, boolean unlocked, Instant unlockedAt) {
    }

    public record TopUpRequest(Long amount) {
    }

    // ------------------------------------------- конфигурация игры для клиента

    /** Публичная часть конфигурации: всё, что нужно для отрисовки интерфейса. */
    public record GameSetupDto(long configRevision,
                               List<ThemeDto> themes,
                               SessionDto session,
                               RewardDto reward,
                               UpsellDto upsell,
                               TournamentHeaderDto tournament) {
    }

    /**
     * @param boostLevelChances нормированные вероятности положения бустера по
     *                          уровням; одинаковы для всех раундов темы и
     *                          описаны в правилах, поэтому раскрываются заранее
     */
    public record ThemeDto(String key, String gameId, String gameName, boolean active,
                           int levelCount, List<Double> levelMultipliers,
                           List<Double> boostLevelChances,
                           List<BetOptionDto> betOptions, PointsDto points,
                           double growthRate, double maxMultiplier, double delta, int fps) {
    }

    public record BetOptionDto(int id, long cost, int boostTier, double boostValue, boolean affordable) {
    }

    public record PointsDto(int perLine, int cashoutBonus, List<Integer> boostBonusPerTier) {
    }

    public record SessionDto(int resultIdleTimeoutSeconds, int onboardingHintSeconds, int historySize) {
    }

    public record RewardDto(boolean enabled, String collectionName, int collectionSize,
                            int collectionLevel, List<Integer> ownedFragments,
                            int completionBonusPoints, long completionBonusBalance) {
    }

    public record UpsellDto(boolean enabled, long minWinAmount, int popupTimeoutSeconds,
                            long ticketPriceBonus, int maxTickets) {
    }

    public record TournamentHeaderDto(boolean enabled, boolean active, String name,
                                      Instant endsAt, long secondsLeft, int participants) {
    }

    // ----------------------------------------------------------------- раунд

    public record StartRoundRequest(String theme, Integer betOptionId, String clientSeed) {
    }

    /**
     * Всё, что нужно клиенту для локальной анимации полёта.
     *
     * <p>Уровень, на котором ждёт бустер, сюда намеренно не входит. Зная его
     * заранее, игрок мог бы выбирать момент выхода так, что математическое
     * ожидание выплаты превысило бы ставку (разбор — в docs/MATH_MODEL.md).
     * Вместо точной позиции отдаётся её распределение вероятностей: оно
     * одинаково во всех раундах, публично описано в правилах и позволяет
     * подсветить «горячие» уровни, ничего не раскрывая о конкретном раунде.
     *
     * @param serverTimeMillis   серверное время ответа: клиент вычисляет поправку
     *                           к своим часам и считает коэффициент той же
     *                           формулой, что и сервер, без опроса на каждом кадре
     * @param serverSeedHash     обязательство честности; само зерно раскрывается
     *                           только в результате раунда
     * @param boostLevelChances  нормированные вероятности по уровням, сумма = 1
     */
    public record StartRoundResponse(long roundId, String theme, long betAmount,
                                     int boostTier, double boostValue,
                                     List<Double> boostLevelChances,
                                     int levelCount, List<Double> levelMultipliers,
                                     double growthRate, double delta, double maxMultiplier,
                                     double cashoutUnlockMultiplier,
                                     long startedAtMillis, long serverTimeMillis,
                                     String serverSeedHash, String clientSeed, long nonce,
                                     long balance, boolean showOnboarding,
                                     PointsDto points) {
    }

    /**
     * Состояние летящего раунда: используется и как fallback вместо WebSocket.
     *
     * @param boostLevel уровень бустера; {@code null}, пока бустер не сработал —
     *                   до этого момента его позиция не раскрывается клиенту
     */
    public record RoundStateDto(long roundId, String status, String theme, long betAmount,
                                double baseMultiplier, double multiplier,
                                int levelsPassed, int levelCount,
                                Integer boostLevel, List<Double> boostLevelChances,
                                int boostTier, double boostValue, boolean boostApplied,
                                Double cashoutMultiplier, long payout, int points,
                                double elapsedSeconds, long serverTimeMillis,
                                long startedAtMillis, double growthRate, double delta,
                                double maxMultiplier, List<Double> levelMultipliers) {
    }

    public record CashoutResponse(long roundId, double multiplier, long payout,
                                  long balance, int pointsAwarded, int totalPoints,
                                  String message,
                                  int playerLevel, int playerXp, int xpToNextLevel,
                                  double displayProfitBonus, int xpGained, boolean levelUp,
                                  List<AchievementDto> newAchievements) {
    }

    /** Экран результата. Точка краха и зерно раскрываются только здесь. */
    public record RoundResultDto(long roundId, String status, boolean won, String theme,
                                 long betAmount, long payout, long netResult,
                                 Double cashoutMultiplier, double crashMultiplier,
                                 double potentialMaxMultiplier,
                                 int levelsPassed, int levelCount,
                                 Integer boostLevel, int boostTier, double boostValue, boolean boostApplied,
                                 PointsBreakdownDto points,
                                 RewardGrantDto reward,
                                 FairnessProofDto fairness,
                                 long balance, long gamePoints, int tournamentPosition,
                                 int playerLevel, int playerXp, int xpToNextLevel,
                                 double displayProfitBonus,
                                 List<AchievementDto> newAchievements,
                                 UpsellOfferDto upsell,
                                 Instant startedAt, Instant finishedAt) {
    }

    public record PointsBreakdownDto(int total, int fromLevels, int fromCashout,
                                     int fromBoost, int fromReward) {
    }

    public record RewardGrantDto(boolean enabled, String collectionName, int collectionLevel,
                                 Integer fragmentIndex, boolean duplicate, boolean collectionCompleted,
                                 int pointsAwarded, long bonusAwarded,
                                 int ownedAfter, int collectionSize) {
    }

    /** Данные для самостоятельной проверки честности раунда. */
    public record FairnessProofDto(String serverSeed, String serverSeedHash, String clientSeed,
                                   long nonce, double alpha, double houseEdge,
                                   double minCrashMultiplier, double maxMultiplier,
                                   String verifyUrl) {
    }

    public record UpsellOfferDto(boolean available, int tickets, long price,
                                 long minWinAmount, int popupTimeoutSeconds, String reason) {
    }

    public record PurchaseTicketsRequest(Integer tickets) {
    }

    public record PurchaseTicketsResponse(int tickets, long price, long balance, int totalTickets) {
    }

    // --------------------------------------------------------------- история

    public record HistoryEntryDto(long roundId, String nickname, String theme, long betAmount,
                                  Double cashoutMultiplier, double crashMultiplier,
                                  long payout, boolean won, int levelsPassed,
                                  int boostTier, boolean boostApplied, int points,
                                  Instant finishedAt, boolean mine) {
    }

    // --------------------------------------------------------------- турнир

    public record RatingEntryDto(long userId, String displayName, long points,
                                int position, boolean bot, boolean current) {
    }

    public record TournamentTableDto(TournamentHeaderDto header, List<RatingEntryDto> top,
                                     List<RatingEntryDto> rest, RatingEntryDto current) {
    }

    // ---------------------------------------------------------- проверяемость

    public record FairnessVerificationDto(boolean matches, double expectedCrashMultiplier,
                                          double storedCrashMultiplier,
                                          Integer expectedBoostLevel, Integer storedBoostLevel,
                                          String algorithm) {
    }

    public record ApiError(String error, String message, List<String> details) {
    }
}
