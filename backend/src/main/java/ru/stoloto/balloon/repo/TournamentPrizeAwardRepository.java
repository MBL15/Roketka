package ru.stoloto.balloon.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.stoloto.balloon.domain.TournamentPrizeAward;

import java.util.List;

public interface TournamentPrizeAwardRepository extends JpaRepository<TournamentPrizeAward, Long> {

    List<TournamentPrizeAward> findByTournamentIdOrderByPositionAsc(long tournamentId);
}
