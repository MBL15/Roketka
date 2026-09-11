package ru.stoloto.balloon.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * Раунд игры — единица аудита.
 *
 * <p>Точка краха и уровень бустера записываются в момент создания раунда, до
 * первого кадра анимации, и больше не меняются. Клиент до завершения раунда
 * получает только хеш серверного зерна, поэтому не может ни узнать, ни
 * подменить исход; после краха зерно раскрывается и результат можно
 * пересчитать (GET /api/fairness/verify).
 */
@Entity
@Table(name = "rounds", indexes = {
        @Index(name = "idx_rounds_user", columnList = "user_id"),
        @Index(name = "idx_rounds_finished", columnList = "finished_at"),
        @Index(name = "idx_rounds_status", columnList = "status")
})
public class GameRound {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** Имя денормализовано: общая история читается без join к пользователям. */
    @Column(nullable = false, length = 64)
    private String nickname;

    @Column(nullable = false, length = 16)
    private String theme;

    @Column(nullable = false)
    private int betOptionId;

    @Column(nullable = false)
    private long betAmount;

    @Column(nullable = false)
    private int boostTier;

    @Column(nullable = false)
    private double boostValue;

    /** Уровень, на котором ждёт бустер; null — вариант без усиления. */
    @Column
    private Integer boostLevel;

    /** Точка краха в базовых коэффициентах (без учёта бустера). */
    @Column(nullable = false)
    private double crashMultiplier;

    /** Коэффициент, на котором игрок зафиксировал выигрыш (уже с бустером). */
    @Column
    private Double cashoutMultiplier;

    /** Максимум, который был достижим в этом раунде — для сообщения «могли бы забрать больше». */
    @Column(nullable = false)
    private double maxReachableMultiplier;

    @Column(nullable = false)
    private long payout;

    @Column(nullable = false)
    private int levelsPassed;

    @Column(nullable = false)
    private boolean boostApplied;

    @Column(nullable = false)
    private int pointsEarned;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private RoundStatus status;

    // --- Provably fair -------------------------------------------------------

    /** Раскрывается только после завершения раунда. */
    @Column(nullable = false, length = 64)
    private String serverSeed;

    @Column(nullable = false, length = 64)
    private String serverSeedHash;

    @Column(nullable = false, length = 64)
    private String clientSeed;

    @Column(nullable = false)
    private long nonce;

    // --- Награда -------------------------------------------------------------

    @Column
    private Integer rewardFragmentIndex;

    @Column(nullable = false)
    private boolean rewardDuplicate;

    @Column(nullable = false)
    private boolean collectionCompleted;

    @Column
    private Integer collectionLevel;

    @Embedded
    private RoundParameters parameters;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "finished_at")
    private Instant finishedAt;

    protected GameRound() {
    }

    public GameRound(Long userId, String nickname, String theme, int betOptionId, long betAmount,
                     int boostTier, double boostValue, Integer boostLevel,
                     double crashMultiplier, double maxReachableMultiplier,
                     String serverSeed, String serverSeedHash, String clientSeed, long nonce,
                     RoundParameters parameters, Instant startedAt) {
        this.userId = userId;
        this.nickname = nickname;
        this.theme = theme;
        this.betOptionId = betOptionId;
        this.betAmount = betAmount;
        this.boostTier = boostTier;
        this.boostValue = boostValue;
        this.boostLevel = boostLevel;
        this.crashMultiplier = crashMultiplier;
        this.maxReachableMultiplier = maxReachableMultiplier;
        this.serverSeed = serverSeed;
        this.serverSeedHash = serverSeedHash;
        this.clientSeed = clientSeed;
        this.nonce = nonce;
        this.parameters = parameters;
        this.startedAt = startedAt;
        this.status = RoundStatus.FLYING;
    }

    public void applyCashout(double multiplier, long payout, int levelsPassed, boolean boostApplied, int points) {
        this.cashoutMultiplier = multiplier;
        this.payout = payout;
        this.levelsPassed = levelsPassed;
        this.boostApplied = boostApplied;
        this.pointsEarned = points;
        this.status = RoundStatus.CASHED_OUT;
    }

    public void settle(int levelsPassed, boolean boostApplied, int points, Instant finishedAt) {
        this.levelsPassed = levelsPassed;
        this.boostApplied = boostApplied;
        this.pointsEarned = points;
        this.finishedAt = finishedAt;
        this.status = cashoutMultiplier != null ? RoundStatus.WON : RoundStatus.LOST;
    }

    public void attachReward(int collectionLevel, Integer fragmentIndex, boolean duplicate, boolean completed) {
        this.collectionLevel = collectionLevel;
        this.rewardFragmentIndex = fragmentIndex;
        this.rewardDuplicate = duplicate;
        this.collectionCompleted = completed;
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public String getNickname() {
        return nickname;
    }

    public String getTheme() {
        return theme;
    }

    public int getBetOptionId() {
        return betOptionId;
    }

    public long getBetAmount() {
        return betAmount;
    }

    public int getBoostTier() {
        return boostTier;
    }

    public double getBoostValue() {
        return boostValue;
    }

    public Integer getBoostLevel() {
        return boostLevel;
    }

    public double getCrashMultiplier() {
        return crashMultiplier;
    }

    public Double getCashoutMultiplier() {
        return cashoutMultiplier;
    }

    public double getMaxReachableMultiplier() {
        return maxReachableMultiplier;
    }

    public long getPayout() {
        return payout;
    }

    public int getLevelsPassed() {
        return levelsPassed;
    }

    public boolean isBoostApplied() {
        return boostApplied;
    }

    public int getPointsEarned() {
        return pointsEarned;
    }

    public RoundStatus getStatus() {
        return status;
    }

    public String getServerSeed() {
        return serverSeed;
    }

    public String getServerSeedHash() {
        return serverSeedHash;
    }

    public String getClientSeed() {
        return clientSeed;
    }

    public long getNonce() {
        return nonce;
    }

    public Integer getRewardFragmentIndex() {
        return rewardFragmentIndex;
    }

    public boolean isRewardDuplicate() {
        return rewardDuplicate;
    }

    public boolean isCollectionCompleted() {
        return collectionCompleted;
    }

    public Integer getCollectionLevel() {
        return collectionLevel;
    }

    public RoundParameters getParameters() {
        return parameters;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public Instant getFinishedAt() {
        return finishedAt;
    }
}
