package ru.stoloto.balloon.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import ru.stoloto.balloon.config.GameConfig;
import ru.stoloto.balloon.domain.UserAccount;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PlayerProgressionServiceTest {

    private PlayerProgressionService service;
    private UserAccount user;

    @BeforeEach
    void setUp() {
        service = new PlayerProgressionService();
        user = new UserAccount("player", "hash", 5000, false);
    }

    @Test
    void xpThresholdFollowsArithmeticProgression() {
        assertEquals(10, service.xpRequiredForNextLevel(1));
        assertEquals(15, service.xpRequiredForNextLevel(2));
        assertEquals(20, service.xpRequiredForNextLevel(3));
    }

    @Test
    void tenGreenX2CashoutsAdvanceOneLevel() {
        for (int i = 0; i < 10; i++) {
            service.awardForCashout(user, GameConfig.THEME_GREEN, 2.0);
        }
        assertEquals(2, user.getPlayerLevel());
        assertEquals(0, user.getPlayerXp());
    }

    @Test
    void fiveRedX2CashoutsAdvanceOneLevel() {
        for (int i = 0; i < 5; i++) {
            service.awardForCashout(user, GameConfig.THEME_RED, 2.4);
        }
        assertEquals(2, user.getPlayerLevel());
        assertEquals(0, user.getPlayerXp());
    }

    @Test
    void belowX2DoesNotGrantXp() {
        var result = service.awardForCashout(user, GameConfig.THEME_GREEN, 1.9);
        assertEquals(0, result.xpGained());
        assertFalse(result.levelUp());
        assertEquals(1, user.getPlayerLevel());
        assertEquals(0, user.getPlayerXp());
    }

    @Test
    void displayBonusScalesWithLevel() {
        assertEquals(0.03, service.displayProfitBonus(3), 0.0001);
    }
}
