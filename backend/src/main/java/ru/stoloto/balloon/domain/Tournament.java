package ru.stoloto.balloon.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/** Активный турнир: имя, окно проведения и признак активности. */
@Entity
@Table(name = "tournaments")
public class Tournament {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 128)
    private String name;

    @Column(name = "starts_at", nullable = false)
    private Instant startsAt;

    @Column(name = "ends_at", nullable = false)
    private Instant endsAt;

    @Column(nullable = false)
    private boolean active;

    protected Tournament() {
    }

    public Tournament(String name, Instant startsAt, Instant endsAt) {
        this.name = name;
        this.startsAt = startsAt;
        this.endsAt = endsAt;
        this.active = true;
    }

    public boolean isRunning(Instant now) {
        return active && now.isAfter(startsAt) && now.isBefore(endsAt);
    }

    public void rename(String name) {
        this.name = name;
    }

    public void reschedule(Instant endsAt) {
        this.endsAt = endsAt;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public Instant getStartsAt() {
        return startsAt;
    }

    public Instant getEndsAt() {
        return endsAt;
    }

    public boolean isActive() {
        return active;
    }
}
