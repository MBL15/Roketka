package ru.stoloto.balloon.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.stoloto.balloon.domain.AuthSession;

public interface AuthSessionRepository extends JpaRepository<AuthSession, String> {
}
