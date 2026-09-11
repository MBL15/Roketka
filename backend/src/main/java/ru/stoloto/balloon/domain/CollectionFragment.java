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
 * Полученный фрагмент коллекции — дополнительная игровая награда за раунд.
 *
 * <p>Уникальный ключ (игрок, коллекция, фрагмент) делает механику коллекции
 * самопроверяемой: повторная выдача того же фрагмента физически невозможна,
 * а дубликат по правилам обменивается на игровые очки.
 */
@Entity
@Table(name = "collection_fragments",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_fragment_owner",
                columnNames = {"user_id", "collection_level", "fragment_index"}))
public class CollectionFragment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "collection_level", nullable = false)
    private int collectionLevel;

    @Column(name = "fragment_index", nullable = false)
    private int fragmentIndex;

    @Column(name = "round_id")
    private Long roundId;

    @Column(nullable = false)
    private Instant obtainedAt = Instant.now();

    protected CollectionFragment() {
    }

    public CollectionFragment(Long userId, int collectionLevel, int fragmentIndex, Long roundId) {
        this.userId = userId;
        this.collectionLevel = collectionLevel;
        this.fragmentIndex = fragmentIndex;
        this.roundId = roundId;
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public int getCollectionLevel() {
        return collectionLevel;
    }

    public int getFragmentIndex() {
        return fragmentIndex;
    }

    public Long getRoundId() {
        return roundId;
    }

    public Instant getObtainedAt() {
        return obtainedAt;
    }
}
