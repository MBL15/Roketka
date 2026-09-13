package ru.stoloto.balloon.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.PlatformTransactionManager;
import ru.stoloto.balloon.config.GameConfig;
import ru.stoloto.balloon.config.GameConfigService;
import ru.stoloto.balloon.config.TestConfigs;
import ru.stoloto.balloon.domain.Tournament;
import ru.stoloto.balloon.domain.TournamentPrizeAward;
import ru.stoloto.balloon.domain.UserAccount;
import ru.stoloto.balloon.repo.TournamentPrizeAwardRepository;
import ru.stoloto.balloon.repo.TournamentRepository;
import ru.stoloto.balloon.repo.UserAccountRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TournamentFinishTest {

    private TournamentService service;
    private UserAccountRepository users;
    private TournamentRepository tournaments;
    private TournamentPrizeAwardRepository prizeAwards;
    private GameConfig config;

    @BeforeEach
    void setUp() {
        config = TestConfigs.defaults();
        GameConfigService configService = mock(GameConfigService.class);
        when(configService.current()).thenReturn(config);

        users = mock(UserAccountRepository.class);
        tournaments = mock(TournamentRepository.class);
        prizeAwards = mock(TournamentPrizeAwardRepository.class);

        service = new TournamentService(
                users, tournaments, prizeAwards, configService,
                event -> { }, mock(PlatformTransactionManager.class));
    }

    @Test
    @DisplayName("досрочное завершение начисляет призы реальным игрокам и обнуляет очки")
    void finishAwardsHumansAndResetsScores() {
        UserAccount winner = new UserAccount("demo", "hash", 100, false);
        winner.setGamePoints(500);
        setId(winner, 1L);

        UserAccount runnerUp = new UserAccount("judge", "hash", 100, false);
        runnerUp.setGamePoints(300);
        setId(runnerUp, 2L);

        UserAccount bot = new UserAccount("bot-1", "hash", 0, true);
        bot.setGamePoints(900);
        setId(bot, 3L);

        when(users.findAll()).thenReturn(List.of(winner, runnerUp, bot));
        when(users.findById(1L)).thenReturn(Optional.of(winner));
        when(users.findById(2L)).thenReturn(Optional.of(runnerUp));
        when(users.findById(3L)).thenReturn(Optional.of(bot));

        Tournament active = new Tournament("Кубок", Instant.now().minusSeconds(3600),
                Instant.now().plusSeconds(86_400));
        setId(active, 10L);
        when(tournaments.findFirstByActiveTrueOrderByStartsAtDesc()).thenReturn(Optional.of(active));
        when(tournaments.save(any(Tournament.class))).thenAnswer(invocation -> {
            Tournament saved = invocation.getArgument(0);
            setId(saved, 11L);
            return saved;
        });

        service.track(winner);
        service.track(runnerUp);
        service.track(bot);
        service.addLivePoints(1L, 500);
        service.addLivePoints(2L, 300);
        service.addLivePoints(3L, 900);

        TournamentService.FinishResult result = service.finishTournamentNow();

        assertThat(result.finishedTournamentId()).isEqualTo(10L);
        assertThat(result.awards())
                .extracting(TournamentService.PrizeAward::nickname,
                        TournamentService.PrizeAward::position,
                        TournamentService.PrizeAward::bonusAwarded)
                .containsExactly(tuple("demo", 1, 1_000L), tuple("judge", 2, 500L));
        assertThat(winner.getBonusBalance()).isEqualTo(1_100);
        assertThat(runnerUp.getBonusBalance()).isEqualTo(600);
        assertThat(winner.getGamePoints()).isZero();
        assertThat(runnerUp.getGamePoints()).isZero();
        assertThat(service.livePoints(3L)).isZero();
        assertThat(active.isActive()).isFalse();

        verify(prizeAwards).save(any(TournamentPrizeAward.class));
    }

    private static void setId(UserAccount user, long id) {
        try {
            var field = UserAccount.class.getDeclaredField("id");
            field.setAccessible(true);
            field.set(user, id);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }

    private static void setId(Tournament tournament, long id) {
        try {
            var field = Tournament.class.getDeclaredField("id");
            field.setAccessible(true);
            field.set(tournament, id);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }
}
