package ru.stoloto.balloon.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;

/**
 * Разблокированное достижение игрока.
 *
 * <p>Уникальный ключ (игрок, идентификатор достижения) исключает повторную
 * выдачу одной и той же награды.
 */
@Entity
@Table(name = "player_achievements",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_player_achievement",
                columnNames = {"user_id", "achievement_id"}))
public class PlayerAchievement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "achievement_id", nullable = false, length = 64)
    private String achievementId;

    @Column(name = "round_id")
    private Long roundId;

    @Column(nullable = false)
    private Instant unlockedAt = Instant.now();

    protected PlayerAchievement() {
    }

    public PlayerAchievement(Long userId, String achievementId, Long roundId) {
        this.userId = userId;
        this.achievementId = achievementId;
        this.roundId = roundId;
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public String getAchievementId() {
        return achievementId;
    }

    public Long getRoundId() {
        return roundId;
    }

    public Instant getUnlockedAt() {
        return unlockedAt;
    }
}
