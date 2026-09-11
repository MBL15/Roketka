package ru.stoloto.balloon.repo;

import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import ru.stoloto.balloon.domain.GameRound;
import ru.stoloto.balloon.domain.RoundStatus;

import java.util.List;

public interface GameRoundRepository extends JpaRepository<GameRound, Long> {

    /** Общая история завершённых раундов всех игроков прототипа. */
    List<GameRound> findByStatusInOrderByFinishedAtDesc(List<RoundStatus> statuses, Limit limit);

    List<GameRound> findByUserIdAndStatusInOrderByFinishedAtDesc(Long userId, List<RoundStatus> statuses, Limit limit);

    /** Незакрытые раунды: восстанавливаются в игровом движке после перезапуска сервера. */
    List<GameRound> findByStatusIn(List<RoundStatus> statuses);

    long countByUserIdAndStatusIn(Long userId, List<RoundStatus> statuses);
}
