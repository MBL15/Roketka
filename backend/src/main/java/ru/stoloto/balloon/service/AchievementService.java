package ru.stoloto.balloon.service;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.stoloto.balloon.config.GameConfig;
import ru.stoloto.balloon.domain.GameRound;
import ru.stoloto.balloon.domain.PlayerAchievement;
import ru.stoloto.balloon.domain.RoundStatus;
import ru.stoloto.balloon.domain.UserAccount;
import ru.stoloto.balloon.game.event.GameEvents;
import ru.stoloto.balloon.repo.GameRoundRepository;
import ru.stoloto.balloon.repo.PlayerAchievementRepository;
import ru.stoloto.balloon.web.dto.GameDtos;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Проверка условий и выдача достижений.
 *
 * <p>Вызывается из {@code cashout} (мгновенные триггеры по коэффициенту и
 * уровню) и из {@code settle} (итоги раунда, коллекция, накопительные счётчики).
 */
@Service
public class AchievementService {

    private static final double MIN_X2 = PlayerProgressionService.MIN_CASHOUT_MULTIPLIER;
    private static final long BIG_WIN_NET = 500;

    private final PlayerAchievementRepository achievements;
    private final GameRoundRepository rounds;
    private final ApplicationEventPublisher events;

    public AchievementService(PlayerAchievementRepository achievements,
                              GameRoundRepository rounds,
                              ApplicationEventPublisher events) {
        this.achievements = achievements;
        this.rounds = rounds;
        this.events = events;
    }

    @Transactional(readOnly = true)
    public List<GameDtos.AchievementDto> catalogFor(UserAccount user) {
        if (user == null || user.isBot()) {
            return AchievementCatalog.ALL.stream()
                    .map(def -> toDto(def, false, null))
                    .toList();
        }
        Map<String, Instant> unlocked = achievements.findByUserIdOrderByUnlockedAtDesc(user.getId()).stream()
                .collect(Collectors.toMap(
                        PlayerAchievement::getAchievementId,
                        PlayerAchievement::getUnlockedAt,
                        (a, b) -> a));
        return AchievementCatalog.ALL.stream()
                .map(def -> toDto(def, unlocked.containsKey(def.id()), unlocked.get(def.id())))
                .toList();
    }

    @Transactional
    public List<GameDtos.AchievementDto> onCashout(UserAccount user, GameRound round, double multiplier,
                                                   boolean levelUp) {
        if (user.isBot()) {
            return List.of();
        }
        List<GameDtos.AchievementDto> unlocked = new ArrayList<>();
        if (multiplier >= MIN_X2) {
            unlock(user, round.getId(), AchievementCatalog.MULTIPLIER_X2, unlocked);
        }
        if (multiplier >= 5.0) {
            unlock(user, round.getId(), AchievementCatalog.MULTIPLIER_X5, unlocked);
        }
        if (levelUp || user.getPlayerLevel() >= 5) {
            tryUnlockLevel(user, round.getId(), user.getPlayerLevel(), unlocked);
        }
        publish(unlocked, user.getId());
        return unlocked;
    }

    @Transactional
    public List<GameDtos.AchievementDto> onSettlement(UserAccount user,
                                                      GameRound round,
                                                      boolean won,
                                                      RewardService.RewardGrant reward,
                                                      int levelCount) {
        if (user.isBot()) {
            return List.of();
        }
        List<GameDtos.AchievementDto> unlocked = new ArrayList<>();

        if (won) {
            unlock(user, round.getId(), AchievementCatalog.FIRST_WIN, unlocked);
            Double cashout = round.getCashoutMultiplier();
            if (cashout != null && cashout >= MIN_X2) {
                long greenWins = rounds.countQualifiedThemeWins(
                        user.getId(), RoundStatus.WON, GameConfig.THEME_GREEN, MIN_X2);
                if (greenWins >= 10) {
                    unlock(user, round.getId(), AchievementCatalog.GREEN_X2_10, unlocked);
                }
                long redWins = rounds.countQualifiedThemeWins(
                        user.getId(), RoundStatus.WON, GameConfig.THEME_RED, MIN_X2);
                if (redWins >= 5) {
                    unlock(user, round.getId(), AchievementCatalog.RED_X2_5, unlocked);
                }
            }
            if (round.isBoostApplied()) {
                unlock(user, round.getId(), AchievementCatalog.BOOST_FIRST, unlocked);
            }
            if (round.getBoostTier() >= 4 && round.isBoostApplied()) {
                unlock(user, round.getId(), AchievementCatalog.BOOST_MAX, unlocked);
            }
            if (round.getLevelsPassed() >= levelCount) {
                unlock(user, round.getId(), AchievementCatalog.PERFECT_FLIGHT, unlocked);
            }
            long net = round.getPayout() - round.getBetAmount();
            if (net >= BIG_WIN_NET) {
                unlock(user, round.getId(), AchievementCatalog.BIG_WIN, unlocked);
            }
        } else if (round.getLevelsPassed() >= 5) {
            unlock(user, round.getId(), AchievementCatalog.NEAR_MISS, unlocked);
        }

        if (reward.fragmentIndex() != null && !reward.duplicate()) {
            unlock(user, round.getId(), AchievementCatalog.FRAGMENT_FIRST, unlocked);
        }
        if (reward.collectionCompleted()) {
            unlock(user, round.getId(), AchievementCatalog.COLLECTION_DONE, unlocked);
        }

        if (user.getRoundsPlayed() >= 10) {
            unlock(user, round.getId(), AchievementCatalog.ROUNDS_10, unlocked);
        }
        if (user.getRoundsPlayed() >= 50) {
            unlock(user, round.getId(), AchievementCatalog.ROUNDS_50, unlocked);
        }
        tryUnlockLevel(user, round.getId(), user.getPlayerLevel(), unlocked);

        publish(unlocked, user.getId());
        return unlocked;
    }

    private void tryUnlockLevel(UserAccount user, Long roundId, int level, List<GameDtos.AchievementDto> unlocked) {
        if (level >= 5) {
            unlock(user, roundId, AchievementCatalog.LEVEL_5, unlocked);
        }
        if (level >= 10) {
            unlock(user, roundId, AchievementCatalog.LEVEL_10, unlocked);
        }
    }

    private void unlock(UserAccount user,
                        Long roundId,
                        AchievementCatalog.Definition definition,
                        List<GameDtos.AchievementDto> unlocked) {
        if (achievements.existsByUserIdAndAchievementId(user.getId(), definition.id())) {
            return;
        }
        PlayerAchievement record = achievements.save(new PlayerAchievement(user.getId(), definition.id(), roundId));
        unlocked.add(toDto(definition, true, record.getUnlockedAt()));
    }

    private void publish(List<GameDtos.AchievementDto> unlocked, long userId) {
        for (GameDtos.AchievementDto dto : unlocked) {
            events.publishEvent(new GameEvents.AchievementUnlocked(
                    userId, dto.id(), dto.title(), dto.description(), dto.icon()));
        }
    }

    @Transactional(readOnly = true)
    public List<GameDtos.AchievementDto> unlockedInRound(UserAccount user, long roundId) {
        if (user.isBot()) {
            return List.of();
        }
        return achievements.findByUserIdAndRoundIdOrderByUnlockedAtAsc(user.getId(), roundId).stream()
                .map(record -> {
                    AchievementCatalog.Definition def = AchievementCatalog.require(record.getAchievementId());
                    return toDto(def, true, record.getUnlockedAt());
                })
                .toList();
    }

    private static GameDtos.AchievementDto toDto(AchievementCatalog.Definition def,
                                                 boolean unlocked,
                                                 Instant unlockedAt) {
        return new GameDtos.AchievementDto(
                def.id(), def.title(), def.description(), def.icon(), def.category(),
                unlocked, unlockedAt);
    }
}
