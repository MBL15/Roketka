package ru.stoloto.balloon.game;

import ru.stoloto.balloon.domain.GameRound;
import ru.stoloto.balloon.domain.RoundParameters;

import java.util.List;

/**
 * Оперативное состояние летящего раунда.
 *
 * <p>Живёт только в памяти игрового движка: на каждом кадре полёта нет ни
 * одного обращения к базе. В БД раунд записывается дважды — при cashout и при
 * завершении, — поэтому нагрузка на СУБД не зависит от частоты тиков.
 *
 * <p>Все изменяемые поля меняются под {@code synchronized} на самом объекте:
 * тик игрового цикла и запрос cashout от игрока приходят из разных потоков,
 * и двойная выплата по одному раунду должна быть невозможна.
 */
public final class ActiveRound {

    private final long roundId;
    private final long userId;
    private final String nickname;
    private final String theme;
    private final long betAmount;
    private final int boostTier;
    private final double boostValue;
    private final Integer boostLevel;
    private final double crashMultiplier;
    private final long startedAtMillis;

    private final List<Double> levelMultipliers;
    private final double growthRate;
    private final double delta;
    private final double maxMultiplier;
    private final int maxFlightSeconds;
    private final int pointsPerLine;
    private final int pointsCashoutBonus;
    private final int pointsBoostBonus;

    private int levelsPassed;
    private boolean boostApplied;
    private Double cashoutMultiplier;
    private long payout;
    private int points;
    private boolean settling;

    public ActiveRound(GameRound round) {
        RoundParameters parameters = round.getParameters();
        this.roundId = round.getId();
        this.userId = round.getUserId();
        this.nickname = round.getNickname();
        this.theme = round.getTheme();
        this.betAmount = round.getBetAmount();
        this.boostTier = round.getBoostTier();
        this.boostValue = round.getBoostValue();
        this.boostLevel = round.getBoostLevel();
        this.crashMultiplier = round.getCrashMultiplier();
        this.startedAtMillis = round.getStartedAt().toEpochMilli();
        this.levelMultipliers = parameters.levelMultipliers();
        this.growthRate = parameters.growthRate();
        this.delta = parameters.delta();
        this.maxMultiplier = parameters.maxMultiplier();
        this.maxFlightSeconds = parameters.maxFlightSeconds();
        this.pointsPerLine = parameters.pointsPerLine();
        this.pointsCashoutBonus = parameters.pointsCashoutBonus();
        this.pointsBoostBonus = parameters.pointsBoostBonus();

        // Восстановление после перезапуска сервера: раунд детерминирован по
        // времени старта, поэтому уже начисленные очки пересчитываются точно.
        this.levelsPassed = 0;
        this.points = 0;
        if (round.getCashoutMultiplier() != null) {
            this.cashoutMultiplier = round.getCashoutMultiplier();
            this.payout = round.getPayout();
            this.levelsPassed = round.getLevelsPassed();
            this.boostApplied = round.isBoostApplied();
            this.points = round.getPointsEarned();
        }
    }

    // ------------------------------------------------------------- вычисления

    /** Базовый коэффициент (без бустера) в момент {@code nowMillis}. */
    public double baseMultiplierAt(long nowMillis) {
        double elapsed = elapsedSeconds(nowMillis);
        double raw = Math.min(CrashMath.multiplierAt(elapsed, growthRate), maxMultiplier);
        return CrashMath.quantizeDown(raw, delta);
    }

    public double elapsedSeconds(long nowMillis) {
        return Math.max(0, nowMillis - startedAtMillis) / 1000.0;
    }

    /** Коэффициент, который видит игрок: базовый, умноженный на сработавший бустер. */
    public double displayedMultiplier(double baseMultiplier, boolean boostIsApplied) {
        return CrashMath.quantizeDown(baseMultiplier * (boostIsApplied ? boostValue : 1.0), delta);
    }

    public boolean crashReached(long nowMillis) {
        return baseMultiplierAt(nowMillis) >= crashMultiplier
                || elapsedSeconds(nowMillis) > maxFlightSeconds;
    }

    /** Момент краха в миллисекундах epoch — известен заранее и не меняется. */
    public long crashAtMillis() {
        double seconds = CrashMath.secondsToReach(crashMultiplier, growthRate);
        return startedAtMillis + (long) Math.ceil(seconds * 1000.0);
    }

    // ------------------------------------------------------ изменение состояния

    /**
     * Продвигает раунд до момента {@code nowMillis} и возвращает произошедшие
     * события: пересечения уровней и активацию бустера.
     */
    public synchronized Progress advance(long nowMillis) {
        double base = baseMultiplierAt(nowMillis);
        Progress progress = new Progress();

        // Очки за уровни начисляются только пока выигрыш не зафиксирован:
        // остаться в полёте дольше — это и есть способ заработать больше очков.
        if (cashoutMultiplier == null) {
            int reached = Math.min(CrashMath.levelsPassed(base, levelMultipliers), levelMultipliers.size());
            while (levelsPassed < reached) {
                levelsPassed++;
                points += pointsPerLine;
                progress.levelsCrossed.add(new LevelCrossed(levelsPassed, pointsPerLine, points));
            }
            if (boostLevel != null && !boostApplied && levelsPassed >= boostLevel) {
                boostApplied = true;
                points += pointsBoostBonus;
                progress.boostActivated = new BoostActivated(
                        boostLevel, boostValue, displayedMultiplier(base, true), pointsBoostBonus, points);
            }
        }
        progress.baseMultiplier = base;
        progress.displayedMultiplier = displayedMultiplier(base, boostApplied);
        return progress;
    }

    /**
     * Фиксация выигрыша. Коэффициент берётся серверный, на момент обработки
     * запроса, а не присланный клиентом.
     *
     * @return результат фиксации либо причина отказа
     */
    public synchronized CashoutOutcome cashout(long nowMillis) {
        if (cashoutMultiplier != null) {
            return CashoutOutcome.rejected("Выигрыш по этому раунду уже зафиксирован");
        }
        if (settling || crashReached(nowMillis)) {
            return CashoutOutcome.rejected("Шар уже лопнул");
        }
        double base = baseMultiplierAt(nowMillis);
        if (CrashMath.levelsPassed(base, levelMultipliers) < 1) {
            return CashoutOutcome.rejected("«Забрать» доступно после прохождения первого уровня");
        }

        double multiplier = displayedMultiplier(base, boostApplied);
        cashoutMultiplier = multiplier;
        payout = Math.round(betAmount * multiplier);
        points += pointsCashoutBonus;
        return CashoutOutcome.accepted(multiplier, payout, pointsCashoutBonus, points, levelsPassed, boostApplied);
    }

    /** Помечает раунд как уходящий в расчёт, чтобы завершение произошло один раз. */
    public synchronized boolean beginSettlement() {
        if (settling) {
            return false;
        }
        settling = true;
        return true;
    }

    // ------------------------------------------------------------- аксессоры

    public synchronized Snapshot snapshot(long nowMillis) {
        double base = baseMultiplierAt(nowMillis);
        return new Snapshot(
                roundId, theme, betAmount, boostTier, boostValue, boostLevel,
                base, displayedMultiplier(base, boostApplied),
                levelsPassed, levelMultipliers.size(), boostApplied,
                cashoutMultiplier, payout, points,
                elapsedSeconds(nowMillis), cashoutMultiplier != null
        );
    }

    public long roundId() {
        return roundId;
    }

    public long userId() {
        return userId;
    }

    public String nickname() {
        return nickname;
    }

    public String theme() {
        return theme;
    }

    public long betAmount() {
        return betAmount;
    }

    public double crashMultiplier() {
        return crashMultiplier;
    }

    public double boostValue() {
        return boostValue;
    }

    public Integer boostLevel() {
        return boostLevel;
    }

    public synchronized int levelsPassed() {
        return levelsPassed;
    }

    public synchronized boolean boostApplied() {
        return boostApplied;
    }

    public synchronized Double cashoutMultiplierOrNull() {
        return cashoutMultiplier;
    }

    public synchronized long payout() {
        return payout;
    }

    public synchronized int points() {
        return points;
    }

    // ------------------------------------------------------------------ типы

    public record LevelCrossed(int level, int pointsAwarded, int totalPoints) {
    }

    public record BoostActivated(int level, double boostValue, double multiplier,
                                 int pointsAwarded, int totalPoints) {
    }

    /** Что произошло за один тик игрового цикла. */
    public static final class Progress {
        public final List<LevelCrossed> levelsCrossed = new java.util.ArrayList<>(2);
        public BoostActivated boostActivated;
        public double baseMultiplier;
        public double displayedMultiplier;

        public boolean hasEvents() {
            return !levelsCrossed.isEmpty() || boostActivated != null;
        }
    }

    public record CashoutOutcome(boolean accepted, String reason, double multiplier, long payout,
                                 int pointsAwarded, int totalPoints, int levelsPassed, boolean boostApplied) {

        static CashoutOutcome accepted(double multiplier, long payout, int pointsAwarded,
                                       int totalPoints, int levelsPassed, boolean boostApplied) {
            return new CashoutOutcome(true, null, multiplier, payout, pointsAwarded, totalPoints,
                    levelsPassed, boostApplied);
        }

        static CashoutOutcome rejected(String reason) {
            return new CashoutOutcome(false, reason, 0, 0, 0, 0, 0, false);
        }
    }

    /** Полное состояние раунда для выдачи клиенту (WebSocket или polling). */
    public record Snapshot(long roundId, String theme, long betAmount, int boostTier, double boostValue,
                           Integer boostLevel, double baseMultiplier, double multiplier,
                           int levelsPassed, int levelCount, boolean boostApplied,
                           Double cashoutMultiplier, long payout, int points,
                           double elapsedSeconds, boolean cashedOut) {
    }
}
