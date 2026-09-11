package ru.stoloto.balloon.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.Instant;

/**
 * Игрок прототипа.
 *
 * <p>Три независимые валюты, у каждой своя продуктовая роль:
 * <ul>
 *   <li>{@code bonusBalance} — бонусные баллы: ими платят за ставку и получают выигрыш;</li>
 *   <li>{@code gamePoints} — игровые очки: турнирная валюта, не конвертируется в баллы;</li>
 *   <li>{@code lotteryTickets} — билеты, купленные в апсейле (имитация).</li>
 * </ul>
 *
 * <p>{@code @Version} даёт оптимистичную блокировку: два параллельных списания
 * с одного баланса не могут «потеряться».
 */
@Entity
@Table(name = "users")
public class UserAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 64)
    private String nickname;

    @Column(nullable = false, length = 128)
    private String passwordHash;

    @Column(nullable = false)
    private long bonusBalance;

    @Column(nullable = false)
    private long gamePoints;

    @Column(nullable = false)
    private int lotteryTickets;

    /** Симулируемый соперник по турниру: в рейтинге участвует, играть не может. */
    @Column(nullable = false)
    private boolean bot;

    /** Номер текущей коллекции награды: закрытая коллекция открывает следующую. */
    @Column(nullable = false)
    private int collectionLevel = 1;

    @Column(nullable = false)
    private int roundsPlayed;

    /** Мини-онбординг у кнопки «Забрать» показывается только перед первым полётом. */
    @Column(nullable = false)
    private boolean onboardingSeen;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    @Version
    private long entityVersion;

    protected UserAccount() {
    }

    public UserAccount(String nickname, String passwordHash, long bonusBalance, boolean bot) {
        this.nickname = nickname;
        this.passwordHash = passwordHash;
        this.bonusBalance = bonusBalance;
        this.bot = bot;
    }

    public void debitBonus(long amount) {
        if (amount < 0) {
            throw new IllegalArgumentException("Сумма списания не может быть отрицательной");
        }
        if (bonusBalance < amount) {
            throw new InsufficientBalanceException(bonusBalance, amount);
        }
        bonusBalance -= amount;
    }

    public void creditBonus(long amount) {
        bonusBalance += Math.max(0, amount);
    }

    public void addGamePoints(long amount) {
        gamePoints += Math.max(0, amount);
    }

    public void addLotteryTickets(int amount) {
        lotteryTickets += Math.max(0, amount);
    }

    public void registerRoundPlayed() {
        roundsPlayed++;
    }

    public void markOnboardingSeen() {
        onboardingSeen = true;
    }

    public void nextCollection() {
        collectionLevel++;
    }

    public Long getId() {
        return id;
    }

    public String getNickname() {
        return nickname;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public long getBonusBalance() {
        return bonusBalance;
    }

    public long getGamePoints() {
        return gamePoints;
    }

    public int getLotteryTickets() {
        return lotteryTickets;
    }

    public boolean isBot() {
        return bot;
    }

    public int getCollectionLevel() {
        return collectionLevel;
    }

    public int getRoundsPlayed() {
        return roundsPlayed;
    }

    public boolean isOnboardingSeen() {
        return onboardingSeen;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setBonusBalance(long bonusBalance) {
        this.bonusBalance = bonusBalance;
    }

    public void setGamePoints(long gamePoints) {
        this.gamePoints = gamePoints;
    }

    /** Баланса не хватает на выбранную ставку. */
    public static class InsufficientBalanceException extends RuntimeException {
        public InsufficientBalanceException(long balance, long required) {
            super("Не хватает бонусов: на балансе " + balance + ", требуется " + required);
        }
    }
}
