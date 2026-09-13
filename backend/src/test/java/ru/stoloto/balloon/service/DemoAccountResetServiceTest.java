package ru.stoloto.balloon.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import ru.stoloto.balloon.config.BalloonProperties;
import ru.stoloto.balloon.config.GameConfigService;
import ru.stoloto.balloon.config.TestConfigs;
import ru.stoloto.balloon.domain.UserAccount;
import ru.stoloto.balloon.game.RoundEngine;
import ru.stoloto.balloon.repo.AuthSessionRepository;
import ru.stoloto.balloon.repo.CollectionFragmentRepository;
import ru.stoloto.balloon.repo.GameRoundRepository;
import ru.stoloto.balloon.repo.PlayerAchievementRepository;
import ru.stoloto.balloon.repo.UserAccountRepository;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DemoAccountResetServiceTest {

    private DemoAccountResetService service;
    private UserAccountRepository users;
    private GameRoundRepository rounds;
    private PasswordHasher passwordHasher;

    @BeforeEach
    void setUp() {
        GameConfigService configService = mock(GameConfigService.class);
        when(configService.current()).thenReturn(TestConfigs.defaults());

        users = mock(UserAccountRepository.class);
        rounds = mock(GameRoundRepository.class);
        passwordHasher = mock(PasswordHasher.class);
        when(passwordHasher.hash(any())).thenReturn("hashed");

        service = new DemoAccountResetService(
                users,
                rounds,
                mock(CollectionFragmentRepository.class),
                mock(PlayerAchievementRepository.class),
                mock(AuthSessionRepository.class),
                passwordHasher,
                configService,
                new BalloonProperties(null, true, true, null,
                        List.of("demo:demo", "expert:expert", "judge:judge"), List.of("*")),
                mock(RoundEngine.class),
                mock(TournamentService.class));
    }

    @Test
    @DisplayName("сбрасывает demo, expert и judge к заводским балансам и паролям")
    void resetAllServiceAccounts() {
        UserAccount demo = serviceAccount("demo", 120, 900);
        UserAccount expert = serviceAccount("expert", 50, 300);
        UserAccount judge = serviceAccount("judge", 10, 40);

        when(users.findByNicknameIgnoreCase("demo")).thenReturn(Optional.of(demo));
        when(users.findByNicknameIgnoreCase("expert")).thenReturn(Optional.of(expert));
        when(users.findByNicknameIgnoreCase("judge")).thenReturn(Optional.of(judge));
        when(rounds.findByUserId(any())).thenReturn(List.of());

        DemoAccountResetService.ResetResult result = service.resetServiceAccounts();

        assertThat(result.accounts()).hasSize(3);
        assertThat(demo.getBonusBalance()).isEqualTo(TestConfigs.defaults().session().demoBonusBalance());
        assertThat(expert.getBonusBalance()).isEqualTo(TestConfigs.defaults().session().demoBonusBalance());
        assertThat(judge.getBonusBalance()).isEqualTo(AccountProfiles.JUDGE_STARTING_BALANCE);
        assertThat(demo.getGamePoints()).isZero();
        assertThat(demo.isOnboardingSeen()).isFalse();
        verify(passwordHasher).hash("demo");
        verify(passwordHasher).hash("expert");
        verify(passwordHasher).hash("judge");
    }

    private static UserAccount serviceAccount(String nickname, long balance, long points) {
        UserAccount user = new UserAccount(nickname, "old", balance, false);
        user.setGamePoints(points);
        user.markOnboardingSeen();
        return user;
    }
}
