package ru.stoloto.balloon.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.stoloto.balloon.domain.GameRound;
import ru.stoloto.balloon.domain.UserAccount;
import ru.stoloto.balloon.game.ActiveRound;
import ru.stoloto.balloon.game.event.GameEvents;
import ru.stoloto.balloon.repo.GameRoundRepository;
import ru.stoloto.balloon.repo.UserAccountRepository;

import java.time.Instant;

/**
 * Расчёт завершённого раунда: единственное место, где полёт превращается
 * в запись истории.
 *
 * <p>Вынесен из игрового цикла отдельным транзакционным сервисом: тик обязан
 * возвращать управление за миллисекунды, а здесь происходит запись в БД,
 * выдача награды и фиксация очков.
 *
 * <p>Выплата на баланс здесь НЕ начисляется — она уже была начислена в момент
 * нажатия «Забрать». После краха сумма выигрыша не пересматривается, что и
 * требует постановка.
 */
@Service
public class RoundSettlementService {

    private static final Logger log = LoggerFactory.getLogger(RoundSettlementService.class);

    private final GameRoundRepository rounds;
    private final UserAccountRepository users;
    private final RewardService rewardService;
    private final TournamentService tournamentService;
    private final AchievementService achievementService;
    private final ApplicationEventPublisher events;

    public RoundSettlementService(GameRoundRepository rounds,
                                  UserAccountRepository users,
                                  RewardService rewardService,
                                  TournamentService tournamentService,
                                  AchievementService achievementService,
                                  ApplicationEventPublisher events) {
        this.rounds = rounds;
        this.users = users;
        this.rewardService = rewardService;
        this.tournamentService = tournamentService;
        this.achievementService = achievementService;
        this.events = events;
    }

    @Transactional
    public void settle(ActiveRound activeRound) {
        GameRound round = rounds.findById(activeRound.roundId()).orElse(null);
        if (round == null) {
            log.warn("Раунд {} отсутствует в базе, расчёт пропущен", activeRound.roundId());
            return;
        }
        if (round.getStatus().isTerminal()) {
            return;
        }
        UserAccount user = users.findById(round.getUserId()).orElseThrow();

        boolean won = activeRound.cashoutMultiplierOrNull() != null;
        int flightPoints = activeRound.points();

        RewardService.RewardGrant reward = rewardService.grant(user, round.getId(), won);
        int totalPoints = flightPoints + reward.pointsAwarded();

        if (reward.pointsAwarded() > 0) {
            tournamentService.addLivePoints(user.getId(), reward.pointsAwarded());
        }

        // Память — источник правды для живого рейтинга, БД — её зеркало.
        long points = tournamentService.livePoints(user.getId());
        user.setGamePoints(points);
        tournamentService.syncFromDatabase(user.getId(), points);
        user.registerRoundResult(won);

        round.settle(activeRound.levelsPassed(), activeRound.boostApplied(), totalPoints, Instant.now());
        round.attachReward(reward.collectionLevel(), reward.fragmentIndex(),
                reward.duplicate(), reward.collectionCompleted());

        achievementService.onSettlement(
                user, round, won, reward, round.getParameters().levelMultipliers().size());

        events.publishEvent(new GameEvents.RoundCrashed(
                round.getId(), user.getId(), round.getCrashMultiplier(), won));
        events.publishEvent(new GameEvents.RoundSettled(round.getId(), user.getId()));
        events.publishEvent(new GameEvents.HistoryUpdated(round.getId()));
        events.publishEvent(new GameEvents.RatingUpdated(tournamentService.liveRating(null)));
    }
}
