package ru.stoloto.balloon.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.stoloto.balloon.domain.Tournament;

import java.util.Optional;

public interface TournamentRepository extends JpaRepository<Tournament, Long> {

    Optional<Tournament> findFirstByActiveTrueOrderByStartsAtDesc();
}
