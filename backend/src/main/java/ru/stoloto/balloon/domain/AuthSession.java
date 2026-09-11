package ru.stoloto.balloon.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * Игровая сессия.
 *
 * <p>Сессия — не только средство аутентификации: к ней привязан флаг показа
 * апсейла, потому что по постановке окно «Закрепи успех» показывается не
 * более одного раза за сессию, а выход из игры сессию завершает.
 */
@Entity
@Table(name = "sessions", indexes = @Index(name = "idx_sessions_user", columnList = "user_id"))
public class AuthSession {

    @Id
    @Column(length = 64)
    private String token;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false)
    private boolean upsellShown;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    @Column(nullable = false)
    private Instant lastSeenAt = Instant.now();

    protected AuthSession() {
    }

    public AuthSession(String token, Long userId) {
        this.token = token;
        this.userId = userId;
    }

    public void touch() {
        this.lastSeenAt = Instant.now();
    }

    public void markUpsellShown() {
        this.upsellShown = true;
    }

    public String getToken() {
        return token;
    }

    public Long getUserId() {
        return userId;
    }

    public boolean isUpsellShown() {
        return upsellShown;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getLastSeenAt() {
        return lastSeenAt;
    }
}
