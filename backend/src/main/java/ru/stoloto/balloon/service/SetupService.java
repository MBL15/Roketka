package ru.stoloto.balloon.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.stoloto.balloon.config.GameConfig;
import ru.stoloto.balloon.config.GameConfigService;
import ru.stoloto.balloon.domain.UserAccount;
import ru.stoloto.balloon.web.dto.GameDtos;

import java.util.ArrayList;
import java.util.List;

/**
 * Сборка публичной конфигурации для клиента.
 *
 * <p>Наружу уходит только то, что нужно для отрисовки: границы уровней, цены
 * вариантов ставки, множители бустеров, правила начисления очков. Параметры
 * распределения точки краха (alpha, houseEdge, alphaShift) клиенту не
 * передаются — иначе он мог бы оценивать выгодность вариантов там, где это
 * делает сервер. Полный набор параметров доступен только административному API
 * и раскрывается в результате раунда вместе с зерном.
 */
@Service
public class SetupService {

    private final GameConfigService configService;
    private final RewardService rewardService;
    private final TournamentService tournamentService;
    private final PlayerProgressionService playerProgressionService;
    private final AchievementService achievementService;

    public SetupService(GameConfigService configService,
                        RewardService rewardService,
                        TournamentService tournamentService,
                        PlayerProgressionService playerProgressionService,
                        AchievementService achievementService) {
        this.configService = configService;
        this.rewardService = rewardService;
        this.tournamentService = tournamentService;
        this.playerProgressionService = playerProgressionService;
        this.achievementService = achievementService;
    }

    @Transactional(readOnly = true)
    public GameDtos.GameSetupDto setupFor(UserAccount user) {
        GameConfig config = configService.current();
        long balance = user == null ? 0 : user.getBonusBalance();

        List<GameDtos.ThemeDto> themes = new ArrayList<>();
        config.orderedThemes().forEach((key, theme) -> {
            List<GameDtos.BetOptionDto> options = theme.betOptions().stream()
                    .map(option -> new GameDtos.BetOptionDto(
                            option.id(), option.cost(), option.boostTier(),
                            theme.boostValue(option.boostTier()),
                            balance >= option.cost()))
                    .toList();
            themes.add(new GameDtos.ThemeDto(
                    key, theme.gameId(), theme.gameName(), theme.active(),
                    theme.levelCount(), theme.levelMultipliers(),
                    normalizedChances(theme.lootProbabilities()), options,
                    new GameDtos.PointsDto(theme.points().perLine(), theme.points().cashoutBonus(),
                            theme.points().boostBonusPerTier()),
                    theme.math().multiplierGrowthRate(), theme.math().maxMultiplier(),
                    theme.math().delta(), theme.math().fps()));
        });

        RewardService.CollectionState collection = user == null
                ? new RewardService.CollectionState(false, null, 0, 0, List.of(), 0, 0)
                : rewardService.state(user);

        TournamentService.TournamentInfo tournament = tournamentService.info();

        return new GameDtos.GameSetupDto(
                configService.status().appliedRevisions(),
                themes,
                new GameDtos.SessionDto(
                        config.session().resultIdleTimeoutSeconds(),
                        config.session().onboardingHintSeconds(),
                        config.session().historySize()),
                new GameDtos.RewardDto(
                        collection.enabled(), collection.collectionName(), collection.collectionSize(),
                        collection.collectionLevel(), collection.ownedFragments(),
                        collection.completionBonusPoints(), collection.completionBonusBalance()),
                new GameDtos.UpsellDto(
                        config.upsell().enabled(), config.upsell().minWinAmount(),
                        config.upsell().popupTimeoutSeconds(), config.upsell().ticketPriceBonus(),
                        config.upsell().maxTickets()),
                new GameDtos.TournamentHeaderDto(
                        config.tournament().enabled(), tournament.active(), tournament.name(),
                        tournament.endsAt(), tournament.secondsLeft(), tournament.participants()));
    }

    /**
     * Веса уровней -> вероятности. Само распределение не секретно: оно едино для
     * всех раундов темы и описано в правилах. Секретна только позиция бустера
     * в конкретном раунде, и она сюда не попадает.
     */
    private List<Double> normalizedChances(List<Double> weights) {
        double sum = weights.stream().mapToDouble(Double::doubleValue).sum();
        if (sum <= 0) {
            return weights.stream().map(weight -> 0.0).toList();
        }
        return weights.stream().map(weight -> Math.round(weight / sum * 10_000.0) / 10_000.0).toList();
    }

    public GameDtos.PlayerDto toPlayerDto(UserAccount user) {
        PlayerProgressionService.Snapshot progression = playerProgressionService.snapshot(user);
        return new GameDtos.PlayerDto(
                user.getId(), user.getNickname(),
                AccountProfiles.kindCode(AccountProfiles.kindOf(user)),
                user.getBonusBalance(),
                tournamentService.livePoints(user.getId()), user.getLotteryTickets(),
                user.getRoundsPlayed(), user.getRoundsWon(), user.getRoundsLost(),
                user.getTotalBonusEarned(),
                user.isOnboardingSeen(),
                tournamentService.positionOf(user.getId()), user.getCollectionLevel(),
                progression.playerLevel(), progression.playerXp(), progression.xpToNextLevel(),
                progression.displayProfitBonus(),
                achievementService.catalogFor(user));
    }
}
