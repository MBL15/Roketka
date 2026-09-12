package ru.stoloto.balloon.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.stoloto.balloon.config.GameConfigService;
import ru.stoloto.balloon.domain.AuthSession;
import ru.stoloto.balloon.domain.UserAccount;
import ru.stoloto.balloon.repo.AuthSessionRepository;
import ru.stoloto.balloon.repo.UserAccountRepository;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.Optional;

/**
 * Аутентификация по токену сессии.
 *
 * <p>Для прототипа выбрана серверная сессия, а не JWT: игровая сессия и так
 * нужна как сущность (к ней привязан однократный показ апсейла), а
 * серверный токен можно отозвать и он не требует раздачи секретов клиенту.
 */
@Service
public class AuthService {

    private final UserAccountRepository users;
    private final AuthSessionRepository sessions;
    private final PasswordHasher passwordHasher;
    private final TournamentService tournamentService;
    private final GameConfigService configService;
    private final SecureRandom random = new SecureRandom();

    public AuthService(UserAccountRepository users,
                       AuthSessionRepository sessions,
                       PasswordHasher passwordHasher,
                       TournamentService tournamentService,
                       GameConfigService configService) {
        this.users = users;
        this.sessions = sessions;
        this.passwordHasher = passwordHasher;
        this.tournamentService = tournamentService;
        this.configService = configService;
    }

    @Transactional
    public AuthSession login(String nickname, String password) {
        UserAccount user = users.findByNicknameIgnoreCase(nickname.trim())
                .orElseThrow(() -> new AuthenticationFailedException("Пользователь не найден"));
        if (user.isBot()) {
            throw new AuthenticationFailedException("Этот участник — симулированный соперник");
        }
        if (!passwordHasher.matches(password, user.getPasswordHash())) {
            throw new AuthenticationFailedException("Неверный пароль");
        }
        return sessions.save(new AuthSession(newToken(), user.getId()));
    }

    @Transactional
    public AuthSession register(String nickname, String password) {
        String trimmed = nickname == null ? "" : nickname.trim();
        if (trimmed.length() < 3 || trimmed.length() > 24) {
            throw new AuthenticationFailedException("Имя должно быть от 3 до 24 символов");
        }
        if (password == null || password.length() < 4) {
            throw new AuthenticationFailedException("Пароль должен быть не короче 4 символов");
        }
        if (users.findByNicknameIgnoreCase(trimmed).isPresent()) {
            throw new AuthenticationFailedException("Такое имя уже занято");
        }
        long startingBalance = configService.current().session().demoBonusBalance();
        UserAccount created = users.save(
                new UserAccount(trimmed, passwordHasher.hash(password), startingBalance, false));
        tournamentService.track(created);
        return sessions.save(new AuthSession(newToken(), created.getId()));
    }

    @Transactional
    public Optional<UserAccount> resolve(String token) {
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }
        return sessions.findById(token).flatMap(session -> {
            session.touch();
            return users.findById(session.getUserId());
        });
    }

    @Transactional(readOnly = true)
    public Optional<AuthSession> session(String token) {
        return token == null ? Optional.empty() : sessions.findById(token);
    }

    @Transactional
    public void logout(String token) {
        if (token != null) {
            sessions.deleteById(token);
        }
    }

    /** Начисление демонстрационных бонусов; для судьи запрещено. */
    @Transactional
    public UserAccount topUp(UserAccount user, long amount) {
        if (!AccountProfiles.manualTopUpAllowed(AccountProfiles.kindOf(user))) {
            throw new TopUpNotAllowedException("Пополнение недоступно для аккаунта судьи");
        }
        UserAccount stored = users.findById(user.getId()).orElseThrow();
        stored.creditBonus(Math.max(0, Math.min(amount, 1_000_000)));
        return stored;
    }

    private String newToken() {
        byte[] bytes = new byte[24];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public static class AuthenticationFailedException extends RuntimeException {
        public AuthenticationFailedException(String message) {
            super(message);
        }
    }

    public static class TopUpNotAllowedException extends RuntimeException {
        public TopUpNotAllowedException(String message) {
            super(message);
        }
    }
}
