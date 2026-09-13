package ru.stoloto.balloon.repo;

import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.stoloto.balloon.domain.GameRound;
import ru.stoloto.balloon.domain.RoundStatus;

import java.util.List;

public interface GameRoundRepository extends JpaRepository<GameRound, Long> {

    /** Общая история завершённых раундов всех игроков прототипа. */
    List<GameRound> findByStatusInOrderByFinishedAtDesc(List<RoundStatus> statuses, Limit limit);

    List<GameRound> findByUserIdAndStatusInOrderByFinishedAtDesc(Long userId, List<RoundStatus> statuses, Limit limit);

    List<GameRound> findByUserId(Long userId);

    /** Незакрытые раунды: восстанавливаются в игровом движке после перезапуска сервера. */
    List<GameRound> findByStatusIn(List<RoundStatus> statuses);

    long countByUserIdAndStatusIn(Long userId, List<RoundStatus> statuses);

    long countByUserIdAndStatus(Long userId, RoundStatus status);

    @Query("""
            SELECT COUNT(r) FROM GameRound r
            WHERE r.userId = :userId AND r.status = :status AND r.theme = :theme
              AND r.cashoutMultiplier >= :minMultiplier
            """)
    long countQualifiedThemeWins(@Param("userId") Long userId,
                               @Param("status") RoundStatus status,
                               @Param("theme") String theme,
                               @Param("minMultiplier") double minMultiplier);
}
