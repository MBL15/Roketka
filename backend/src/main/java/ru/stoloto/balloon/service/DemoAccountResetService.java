package ru.stoloto.balloon.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.stoloto.balloon.config.BalloonProperties;
import ru.stoloto.balloon.config.GameConfigService;
import ru.stoloto.balloon.domain.GameRound;
import ru.stoloto.balloon.domain.RoundStatus;
import ru.stoloto.balloon.domain.UserAccount;
import ru.stoloto.balloon.game.ActiveRound;
import ru.stoloto.balloon.game.RoundEngine;
import ru.stoloto.balloon.repo.AuthSessionRepository;
import ru.stoloto.balloon.repo.CollectionFragmentRepository;
import ru.stoloto.balloon.repo.GameRoundRepository;
import ru.stoloto.balloon.repo.PlayerAchievementRepository;
import ru.stoloto.balloon.repo.UserAccountRepository;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

/**
 * Сброс служебных аккаунтов прототипа (demo, judge, expert) к заводским значениям.
 *
 * <p>Очищает прогресс, историю раундов, коллекции и достижения, завершает
 * незакрытые полёты и возвращает пароли из {@code balloon.demo-users}.
 */
@Service
public class DemoAccountResetService {

    private static final Logger log = LoggerFactory.getLogger(DemoAccountResetService.class);
    private static final List<RoundStatus> OPEN_STATUSES = List.of(RoundStatus.FLYING, RoundStatus.CASHED_OUT);
    private static final long SETTLE_TIMEOUT_SECONDS = 30;

    private final UserAccountRepository users;
    private final GameRoundRepository rounds;
    private final CollectionFragmentRepository fragments;
    private final PlayerAchievementRepository achievements;
    private final AuthSessionRepository sessions;
    private final PasswordHasher passwordHasher;
    private final GameConfigService configService;
    private final BalloonProperties properties;
    private final RoundEngine engine;
    private final TournamentService tournamentService;

    public DemoAccountResetService(UserAccountRepository users,
                                   GameRoundRepository rounds,
                                   CollectionFragmentRepository fragments,
                                   PlayerAchievementRepository achievements,
                                   AuthSessionRepository sessions,
                                   PasswordHasher passwordHasher,
                                   GameConfigService configService,
                                   BalloonProperties properties,
                                   RoundEngine engine,
                                   TournamentService tournamentService) {
        this.users = users;
        this.rounds = rounds;
        this.fragments = fragments;
        this.achievements = achievements;
        this.sessions = sessions;
        this.passwordHasher = passwordHasher;
        this.configService = configService;
        this.properties = properties;
        this.engine = engine;
        this.tournamentService = tournamentService;
    }

    @Transactional
    public ResetResult resetServiceAccounts() {
        long demoBalance = configService.current().session().demoBonusBalance();
        Map<String, String> defaultPasswords = defaultPasswords();
        List<ResetEntry> entries = new ArrayList<>();

        for (String entry : properties.demoUsers()) {
            String nickname = parseNickname(entry);
            if (nickname == null) {
                continue;
            }
            AccountProfiles.Kind kind = AccountProfiles.kindOf(nickname);
            if (!AccountProfiles.isServiceAccount(kind)) {
                continue;
            }
            users.findByNicknameIgnoreCase(nickname).ifPresent(user -> {
                ResetEntry reset = resetAccount(user, kind, demoBalance, defaultPasswords.get(nickname.toLowerCase()));
                entries.add(reset);
                log.info("Служебный аккаунт {} сброшен: баланс {}, удалено раундов {}",
                        nickname, reset.bonusBalance(), reset.roundsRemoved());
            });
        }

        if (entries.isEmpty()) {
            throw new IllegalStateException("Служебные аккаунты не найдены в базе");
        }
        return new ResetResult(entries);
    }

    private ResetEntry resetAccount(UserAccount user,
                                    AccountProfiles.Kind kind,
                                    long demoBalance,
                                    String plainPassword) {
        settleOpenRounds(user.getId());

        List<GameRound> userRounds = rounds.findByUserId(user.getId());
        int roundsRemoved = userRounds.size();
        achievements.deleteByUserId(user.getId());
        fragments.deleteByUserId(user.getId());
        rounds.deleteAllInBatch(userRounds);
        sessions.deleteByUserId(user.getId());

        long startingBalance = AccountProfiles.startingBonus(kind, demoBalance);
        String password = plainPassword != null ? plainPassword : nicknameFallbackPassword(user.getNickname());
        user.applyFactoryDefaults(startingBalance, passwordHasher.hash(password));
        tournamentService.syncFromDatabase(user.getId(), 0);

        return new ResetEntry(user.getNickname(), AccountProfiles.kindCode(kind), startingBalance, roundsRemoved);
    }

    private void settleOpenRounds(long userId) {
        engine.findByUser(userId).ifPresent(this::settleAndWait);

        for (GameRound round : rounds.findByUserId(userId)) {
            if (!OPEN_STATUSES.contains(round.getStatus())) {
                continue;
            }
            if (engine.find(round.getId()).isEmpty()) {
                settleAndWait(engine.register(round));
            }
        }
        engine.findByUser(userId).ifPresent(this::settleAndWait);
    }

    private void settleAndWait(ActiveRound round) {
        Future<?> future = engine.forceSettle(round);
        try {
            future.get(SETTLE_TIMEOUT_SECONDS, TimeUnit.SECONDS);
        } catch (Exception e) {
            log.warn("Не удалось дождаться расчёта раунда {}: {}", round.roundId(), e.getMessage());
        }
    }

    private Map<String, String> defaultPasswords() {
        Map<String, String> map = new HashMap<>();
        for (String entry : properties.demoUsers()) {
            String[] parts = entry.split(":", 2);
            if (parts.length == 2) {
                map.put(parts[0].trim().toLowerCase(), parts[1].trim());
            }
        }
        return map;
    }

    private static String parseNickname(String entry) {
        if (entry == null || entry.isBlank()) {
            return null;
        }
        String[] parts = entry.split(":", 2);
        return parts[0].trim();
    }

    private static String nicknameFallbackPassword(String nickname) {
        return nickname == null ? "demo" : nickname.toLowerCase();
    }

    public record ResetEntry(String nickname, String accountKind, long bonusBalance, int roundsRemoved) {
    }

    public record ResetResult(List<ResetEntry> accounts) {
    }
}
