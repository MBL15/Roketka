package ru.stoloto.balloon.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import ru.stoloto.balloon.config.GameConfig;
import ru.stoloto.balloon.domain.GameRound;
import ru.stoloto.balloon.domain.PlayerAchievement;
import ru.stoloto.balloon.domain.RoundParameters;
import ru.stoloto.balloon.domain.RoundStatus;
import ru.stoloto.balloon.domain.UserAccount;
import ru.stoloto.balloon.game.event.GameEvents;
import ru.stoloto.balloon.repo.GameRoundRepository;
import ru.stoloto.balloon.repo.PlayerAchievementRepository;
import ru.stoloto.balloon.web.dto.GameDtos;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AchievementServiceTest {

    @Mock
    private PlayerAchievementRepository achievements;
    @Mock
    private GameRoundRepository rounds;
    @Mock
    private ApplicationEventPublisher events;

    private AchievementService service;

    @BeforeEach
    void setUp() {
        service = new AchievementService(achievements, rounds, events);
    }

    @Test
    void cashoutUnlocksMultiplierAchievements() {
        UserAccount user = player(1L);
        GameRound round = round(10L, GameConfig.THEME_GREEN);

        when(achievements.existsByUserIdAndAchievementId(any(), any())).thenReturn(false);
        when(achievements.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        List<GameDtos.AchievementDto> unlocked = service.onCashout(user, round, 5.2, false);

        assertThat(unlocked).extracting(GameDtos.AchievementDto::id)
                .containsExactlyInAnyOrder("multiplier_x2", "multiplier_x5");
        verify(events, org.mockito.Mockito.times(2)).publishEvent(any(GameEvents.AchievementUnlocked.class));
    }

    @Test
    void settlementUnlocksFirstWinAndNearMiss() {
        UserAccount user = player(1L);
        user.registerRoundPlayed();
        GameRound round = round(11L, GameConfig.THEME_GREEN);
        round.settle(6, false, 40, Instant.now());

        when(achievements.existsByUserIdAndAchievementId(any(), any())).thenReturn(false);
        when(achievements.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        RewardService.RewardGrant reward = RewardService.RewardGrant.disabled();
        List<GameDtos.AchievementDto> unlocked = service.onSettlement(user, round, false, reward, 9);

        assertThat(unlocked).extracting(GameDtos.AchievementDto::id)
                .contains("near_miss", "rounds_10");
        assertThat(unlocked).extracting(GameDtos.AchievementDto::id).doesNotContain("first_win");
    }

    @Test
    void botsReceiveNoAchievements() {
        UserAccount bot = new UserAccount("bot", "hash", 1000, true);
        GameRound round = round(12L, GameConfig.THEME_RED);

        List<GameDtos.AchievementDto> unlocked = service.onCashout(bot, round, 3.0, false);

        assertThat(unlocked).isEmpty();
        verify(achievements, never()).save(any());
    }

    private static UserAccount player(long id) {
        UserAccount user = new UserAccount("demo", "hash", 5000, false);
        try {
            var field = UserAccount.class.getDeclaredField("id");
            field.setAccessible(true);
            field.set(user, id);
        } catch (ReflectiveOperationException e) {
            throw new RuntimeException(e);
        }
        for (int i = 0; i < 9; i++) {
            user.registerRoundPlayed();
        }
        return user;
    }

    private static GameRound round(long id, String theme) {
        RoundParameters parameters = new RoundParameters(
                1.0, 0.04, 1.01, 60, 0.17, 0.01, 30, 45,
                List.of(1.2, 1.5, 1.9), List.of(0.1, 0.2, 0.3),
                10, 25, 0);
        GameRound round = new GameRound(
                1L, "demo", theme, 1, 50,
                2, 2.0, 2,
                3.0, 6.0,
                "seed", "hash", "client", 1,
                parameters, Instant.now());
        try {
            var field = GameRound.class.getDeclaredField("id");
            field.setAccessible(true);
            field.set(round, id);
        } catch (ReflectiveOperationException e) {
            throw new RuntimeException(e);
        }
        return round;
    }
}
