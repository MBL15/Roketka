package ru.stoloto.balloon.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Валидатор — единственная защита между правкой YAML и игровой экономикой,
 * поэтому проверяется и «счастливый путь», и каждое ограничение, о котором
 * говорит документация.
 */
class GameConfigValidatorTest {

    private final GameConfigValidator validator = new GameConfigValidator();

    @Test
    @DisplayName("Заводская конфигурация проходит валидацию без замечаний")
    void defaultConfigIsValid() {
        assertThat(validator.validate(TestConfigs.defaults())).isEmpty();
    }

    @Test
    @DisplayName("Зелёная тема обязана иметь 9 уровней, красная — 12")
    void levelCountIsEnforcedPerTheme() {
        GameConfig config = TestConfigs.defaults();
        GameConfig.ThemeConfig green = config.theme(GameConfig.THEME_GREEN);
        GameConfig broken = TestConfigs.withTheme(config, GameConfig.THEME_GREEN,
                TestConfigs.withLevels(green, List.of(1.2, 1.5, 1.9)));

        assertThat(validator.validate(broken))
                .anyMatch(error -> error.contains("levelMultipliers")
                        && error.contains("ожидается 9"));
    }

    @Test
    @DisplayName("Границы уровней должны строго возрастать")
    void levelsMustBeStrictlyIncreasing() {
        GameConfig config = TestConfigs.defaults();
        GameConfig.ThemeConfig green = config.theme(GameConfig.THEME_GREEN);
        GameConfig broken = TestConfigs.withTheme(config, GameConfig.THEME_GREEN,
                TestConfigs.withLevels(green, List.of(1.2, 1.5, 1.5, 2.4, 3.0, 3.8, 4.8, 6.0, 7.5)));

        assertThat(validator.validate(broken))
                .anyMatch(error -> error.contains("должен строго возрастать"));
    }

    @Test
    @DisplayName("Первый уровень не может быть равен 1.0: иначе cashout открыт сразу")
    void firstLevelMustExceedOne() {
        GameConfig config = TestConfigs.defaults();
        GameConfig.ThemeConfig green = config.theme(GameConfig.THEME_GREEN);
        GameConfig broken = TestConfigs.withTheme(config, GameConfig.THEME_GREEN,
                TestConfigs.withLevels(green, List.of(1.0, 1.5, 1.9, 2.4, 3.0, 3.8, 4.8, 6.0, 7.5)));

        assertThat(validator.validate(broken))
                .anyMatch(error -> error.contains("строго больше 1.0"));
    }

    @Test
    @DisplayName("Количество весов бустера должно совпадать с количеством уровней")
    void lootWeightsMustMatchLevelCount() {
        GameConfig config = TestConfigs.defaults();
        GameConfig.ThemeConfig red = config.theme(GameConfig.THEME_RED);
        GameConfig broken = TestConfigs.withTheme(config, GameConfig.THEME_RED,
                TestConfigs.withLoot(red, List.of(0.5, 0.5)));

        assertThat(validator.validate(broken))
                .anyMatch(error -> error.contains("lootProbabilities")
                        && error.contains("ожидается 12"));
    }

    @Test
    @DisplayName("Сумма весов положения бустера должна быть положительной")
    void lootWeightsMustSumAboveZero() {
        GameConfig config = TestConfigs.defaults();
        GameConfig.ThemeConfig green = config.theme(GameConfig.THEME_GREEN);
        GameConfig broken = TestConfigs.withTheme(config, GameConfig.THEME_GREEN,
                TestConfigs.withLoot(green, java.util.Collections.nCopies(9, 0.0)));

        assertThat(validator.validate(broken))
                .anyMatch(error -> error.contains("сумма весов должна быть положительной"));
    }

    @Test
    @DisplayName("alpha вне диапазона 0.5..3.0 отклоняется")
    void alphaOutOfRangeIsRejected() {
        GameConfig config = TestConfigs.defaults();
        GameConfig.ThemeConfig green = config.theme(GameConfig.THEME_GREEN);
        GameConfig broken = TestConfigs.withTheme(config, GameConfig.THEME_GREEN,
                TestConfigs.withMath(green, TestConfigs.withAlpha(green.math(), 12.0)));

        assertThat(validator.validate(broken))
                .anyMatch(error -> error.contains("math.alpha")
                        && error.contains("вне допустимого диапазона"));
    }

    @Test
    @DisplayName("Последний уровень не должен быть выше потолка коэффициента")
    void lastLevelMustBeReachable() {
        GameConfig config = TestConfigs.defaults();
        GameConfig.ThemeConfig green = config.theme(GameConfig.THEME_GREEN);
        GameConfig.MathConfig math = green.math();
        GameConfig.MathConfig lowCeiling = new GameConfig.MathConfig(
                math.alpha(), math.houseEdge(), math.minCrashMultiplier(), 5.0,
                math.multiplierGrowthRate(), math.fps(), math.delta(), math.maxFlightSeconds());
        GameConfig broken = TestConfigs.withTheme(config, GameConfig.THEME_GREEN,
                TestConfigs.withMath(green, lowCeiling));

        assertThat(validator.validate(broken))
                .anyMatch(error -> error.contains("недостижим"));
    }

    @Test
    @DisplayName("points_per_line меняется свободно: это основной параметр сценария 5")
    void pointsPerLineAcceptsNewValue() {
        GameConfig config = TestConfigs.defaults();
        GameConfig.ThemeConfig green = config.theme(GameConfig.THEME_GREEN);
        GameConfig updated = TestConfigs.withTheme(config, GameConfig.THEME_GREEN,
                TestConfigs.withPoints(green, new GameConfig.PointsConfig(
                        999, green.points().cashoutBonus(), green.points().boostBonusPerTier())));

        assertThat(validator.validate(updated)).isEmpty();
        assertThat(updated.theme(GameConfig.THEME_GREEN).points().perLine()).isEqualTo(999);
    }

    @Test
    @DisplayName("Неизвестная версия схемы отклоняется")
    void unknownVersionIsRejected() {
        GameConfig config = TestConfigs.defaults();
        GameConfig broken = new GameConfig(99, config.themes(), config.reward(),
                config.upsell(), config.tournament(), config.session());

        assertThat(validator.validate(broken)).anyMatch(error -> error.startsWith("version:"));
    }

    @Test
    @DisplayName("Пустая конфигурация не проходит валидацию и не роняет сервис")
    void emptyConfigIsRejected() {
        assertThat(validator.validate(null)).containsExactly("Конфигурация пуста");
    }
}
