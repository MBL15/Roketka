package ru.stoloto.balloon.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.PlatformTransactionManager;
import ru.stoloto.balloon.config.GameConfigService;
import ru.stoloto.balloon.config.TestConfigs;
import ru.stoloto.balloon.game.event.GameEvents;
import ru.stoloto.balloon.repo.TournamentPrizeAwardRepository;
import ru.stoloto.balloon.repo.TournamentRepository;
import ru.stoloto.balloon.repo.UserAccountRepository;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Рассылка живого рейтинга.
 *
 * Постановка отводит на обновление позиции игрока не более 0.5 секунды, а
 * очки меняются на каждом пересечённом уровне. Проверяем, что изменение очков
 * действительно приводит к рассылке и что рассылка не повторяется вхолостую.
 */
class TournamentServiceTest {

    private final List<Object> published = new ArrayList<>();
    private TournamentService service;

    @BeforeEach
    void setUp() {
        GameConfigService configService = mock(GameConfigService.class);
        when(configService.current()).thenReturn(TestConfigs.defaults());

        ApplicationEventPublisher events = published::add;

        service = new TournamentService(
                mock(UserAccountRepository.class),
                mock(TournamentRepository.class),
                mock(TournamentPrizeAwardRepository.class),
                configService,
                events,
                mock(PlatformTransactionManager.class));
    }

    private List<GameEvents.RatingUpdated> ratingEvents() {
        return published.stream()
                .filter(GameEvents.RatingUpdated.class::isInstance)
                .map(GameEvents.RatingUpdated.class::cast)
                .toList();
    }

    @Test
    @DisplayName("начисление очков приводит к рассылке рейтинга на ближайшем тике")
    void pointsChangeTriggersBroadcast() {
        service.addLivePoints(1L, 10);
        service.broadcastRating();

        assertThat(ratingEvents()).hasSize(1);
        assertThat(ratingEvents().get(0).entries())
                .extracting(GameEvents.RatingEntry::userId, GameEvents.RatingEntry::points)
                .containsExactly(tuple(1L, 10L));
    }

    @Test
    @DisplayName("без изменения очков тик молчит")
    void idleTickPublishesNothing() {
        service.broadcastRating();
        service.broadcastRating();

        assertThat(ratingEvents()).isEmpty();
    }

    @Test
    @DisplayName("рассылка не повторяется, пока очки не изменились снова")
    void broadcastIsNotRepeatedUntilPointsChangeAgain() {
        service.addLivePoints(1L, 10);
        service.broadcastRating();
        service.broadcastRating();
        assertThat(ratingEvents()).hasSize(1);

        service.addLivePoints(1L, 5);
        service.broadcastRating();
        assertThat(ratingEvents()).hasSize(2);
    }

    @Test
    @DisplayName("несколько начислений подряд схлопываются в одну рассылку")
    void burstOfPointsCoalescesIntoSingleBroadcast() {
        service.addLivePoints(1L, 10);
        service.addLivePoints(2L, 30);
        service.addLivePoints(1L, 10);
        service.broadcastRating();

        assertThat(ratingEvents()).hasSize(1);
        // Порядок по убыванию очков: второй игрок впереди.
        assertThat(ratingEvents().get(0).entries())
                .extracting(GameEvents.RatingEntry::userId)
                .containsExactly(2L, 1L);
    }

    @Test
    @DisplayName("нулевое начисление не поднимает флаг рассылки")
    void zeroDeltaDoesNotTriggerBroadcast() {
        service.addLivePoints(1L, 0);
        service.broadcastRating();

        assertThat(ratingEvents()).isEmpty();
    }
}
