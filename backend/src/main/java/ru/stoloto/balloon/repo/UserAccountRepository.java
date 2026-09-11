package ru.stoloto.balloon.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.stoloto.balloon.domain.UserAccount;

import java.util.List;
import java.util.Optional;

public interface UserAccountRepository extends JpaRepository<UserAccount, Long> {

    Optional<UserAccount> findByNicknameIgnoreCase(String nickname);

    List<UserAccount> findByBotTrue();

    long countByBotTrue();
}
