package ru.stoloto.balloon.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/** Запись о призовом месте и начислении бонусов по завершённому турниру. */
@Entity
@Table(name = "tournament_prize_awards")
public class TournamentPrizeAward {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tournament_id", nullable = false)
    private long tournamentId;

    @Column(name = "user_id", nullable = false)
    private long userId;

    @Column(nullable = false, length = 64)
    private String nickname;

    @Column(nullable = false)
    private int position;

    @Column(name = "points_at_finish", nullable = false)
    private long pointsAtFinish;

    @Column(name = "bonus_awarded", nullable = false)
    private long bonusAwarded;

    @Column(name = "awarded_at", nullable = false)
    private Instant awardedAt;

    protected TournamentPrizeAward() {
    }

    public TournamentPrizeAward(long tournamentId, long userId, String nickname, int position,
                                long pointsAtFinish, long bonusAwarded, Instant awardedAt) {
        this.tournamentId = tournamentId;
        this.userId = userId;
        this.nickname = nickname;
        this.position = position;
        this.pointsAtFinish = pointsAtFinish;
        this.bonusAwarded = bonusAwarded;
        this.awardedAt = awardedAt;
    }

    public Long getId() {
        return id;
    }

    public long getTournamentId() {
        return tournamentId;
    }

    public long getUserId() {
        return userId;
    }

    public String getNickname() {
        return nickname;
    }

    public int getPosition() {
        return position;
    }

    public long getPointsAtFinish() {
        return pointsAtFinish;
    }

    public long getBonusAwarded() {
        return bonusAwarded;
    }

    public Instant getAwardedAt() {
        return awardedAt;
    }
}
