package ru.stoloto.balloon.service;

import org.springframework.stereotype.Service;
import ru.stoloto.balloon.config.GameConfig;
import ru.stoloto.balloon.domain.UserAccount;

/**
 * Прогрессия уровня игрока.
 *
 * <p>Опыт начисляется за cashout с коэффициентом ≥ 2×: зелёный шар — 1 очко,
 * красный — 2. Для перехода на следующий уровень нужно набрать порог по
 * арифметической прогрессии: 10, 15, 20, … (+5 за каждый текущий уровень).
 *
 * <p>Бонус «+0.01 × уровень» к профиту — только отображение в интерфейсе,
 * на выплату и RTP не влияет.
 */
@Service
public class PlayerProgressionService {

    public static final double MIN_CASHOUT_MULTIPLIER = 2.0;
    public static final int XP_GREEN_X2 = 1;
    public static final int XP_RED_X2 = 2;
    public static final int XP_BASE = 10;
    public static final int XP_STEP = 5;
    public static final double DISPLAY_BONUS_PER_LEVEL = 0.01;

    public record Snapshot(int playerLevel, int playerXp, int xpToNextLevel, double displayProfitBonus) {
    }

    public record AwardResult(int xpGained, boolean levelUp, Snapshot snapshot) {
    }

    /** Сколько опыта нужно для перехода с {@code currentLevel} на следующий. */
    public int xpRequiredForNextLevel(int currentLevel) {
        int level = Math.max(1, currentLevel);
        return XP_BASE + (level - 1) * XP_STEP;
    }

    public double displayProfitBonus(int level) {
        return DISPLAY_BONUS_PER_LEVEL * Math.max(1, level);
    }

    public Snapshot snapshot(UserAccount user) {
        int level = Math.max(1, user.getPlayerLevel());
        return new Snapshot(level, Math.max(0, user.getPlayerXp()), xpRequiredForNextLevel(level),
                displayProfitBonus(level));
    }

    public AwardResult awardForCashout(UserAccount user, String theme, double multiplier) {
        if (user.isBot() || multiplier < MIN_CASHOUT_MULTIPLIER) {
            return new AwardResult(0, false, snapshot(user));
        }

        int xpGained = GameConfig.THEME_RED.equals(theme) ? XP_RED_X2 : XP_GREEN_X2;
        int levelBefore = user.getPlayerLevel();
        user.setPlayerXp(user.getPlayerXp() + xpGained);

        while (user.getPlayerXp() >= xpRequiredForNextLevel(user.getPlayerLevel())) {
            user.setPlayerXp(user.getPlayerXp() - xpRequiredForNextLevel(user.getPlayerLevel()));
            user.setPlayerLevel(user.getPlayerLevel() + 1);
        }

        return new AwardResult(xpGained, user.getPlayerLevel() > levelBefore, snapshot(user));
    }
}
