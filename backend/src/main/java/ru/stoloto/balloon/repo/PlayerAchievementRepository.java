package ru.stoloto.balloon.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.stoloto.balloon.domain.PlayerAchievement;

import java.util.List;

public interface PlayerAchievementRepository extends JpaRepository<PlayerAchievement, Long> {

    List<PlayerAchievement> findByUserIdOrderByUnlockedAtDesc(Long userId);

    boolean existsByUserIdAndAchievementId(Long userId, String achievementId);

    @Query("SELECT p.achievementId FROM PlayerAchievement p WHERE p.userId = :userId")
    List<String> findAchievementIdsByUserId(@Param("userId") Long userId);

    List<PlayerAchievement> findByUserIdAndRoundIdOrderByUnlockedAtAsc(Long userId, Long roundId);

    void deleteByUserId(Long userId);
}
