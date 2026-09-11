package ru.stoloto.balloon.service;

import org.assertj.core.data.Offset;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import ru.stoloto.balloon.config.GameConfig;
import ru.stoloto.balloon.config.TestConfigs;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Проверка игровой экономики на боевых параметрах.
 *
 * <p>Здесь сходятся математическая модель и конфигурация: тест берёт тот самый
 * файл, с которым запускается игра, и убеждается, что заявленная в
 * docs/MATH_MODEL.md экономика действительно получается.
 *
 * <p>Ключевая проверка — {@link #noThresholdStrategyBeatsTheHouse()}: игрок
 * выбирает не «стратегию вообще», а порог выхода, и обыграть модель нельзя ни
 * при одном пороге. Если кто-то поменяет alpha, alphaShift или границы уровней
 * и сломает баланс, это упадёт здесь, а не на демонстрации.
 */
class RtpSimulatorTest {

    private static final int ROUNDS = 40_000;
    private static final long SEED = 20260911L;

    /** Коридор, в который должна попадать лучшая реализуемая стратегия. */
    private static final double RTP_FLOOR = 0.85;
    private static final double RTP_CEILING = 0.97;

    private final RtpSimulator simulator = new RtpSimulator();
    private final GameConfig config = TestConfigs.defaults();

    @ParameterizedTest(name = "тема {0}: RTP базовой ставки совпадает с теорией")
    @ValueSource(strings = {GameConfig.THEME_GREEN, GameConfig.THEME_RED})
    @DisplayName("Ставка без бустера даёт RTP, предсказанный формулой")
    void baseOptionMatchesTheoreticalRtp(String themeKey) {
        RtpSimulator.OptionReport base = simulator
                .simulate(config, themeKey, RtpSimulator.Strategy.TARGET_MULTIPLIER, ROUNDS, 2.0, null, SEED)
                .options()
                .get(0);

        assertThat(base.boostTier()).isEqualTo(1);
        assertThat(base.alphaShift()).isZero();
        assertThat(base.empiricalRtp()).isCloseTo(base.theoreticalRtp(), Offset.offset(0.03));
    }

    @Test
    @DisplayName("В зелёной теме RTP не зависит от выбранного коэффициента выхода")
    void greenThemeRtpIsFlatAcrossExitPoints() {
        // alpha = 1 — единственное значение, при котором RTP(m) = (1 - edge) * m^(1-alpha)
        // не зависит от m. Игрок не может переиграть модель выбором момента выхода,
        // и это заявлено в документации как свойство зелёной темы.
        double expected = 1.0 - config.theme(GameConfig.THEME_GREEN).math().houseEdge();

        for (double target : List.of(1.5, 2.0, 4.0, 8.0)) {
            RtpSimulator.OptionReport base = simulator
                    .simulate(config, GameConfig.THEME_GREEN, RtpSimulator.Strategy.TARGET_MULTIPLIER,
                            ROUNDS, target, null, SEED)
                    .options()
                    .get(0);

            assertThat(base.empiricalRtp())
                    .as("выход на %.1fx", target)
                    .isCloseTo(expected, Offset.offset(0.05));
        }
    }

    @Test
    @DisplayName("Ни один порог выхода не делает игру выгодной для игрока")
    void noThresholdStrategyBeatsTheHouse() {
        // Реализуемая стратегия — это выбор уровня, на котором забрать. Перебираем
        // все пороги во всех темах для всех вариантов ставки: бустер умножает
        // выплату, и без компенсации через alphaShift здесь были бы значения выше 1.
        for (String themeKey : List.of(GameConfig.THEME_GREEN, GameConfig.THEME_RED)) {
            int levelCount = config.theme(themeKey).levelCount();
            for (int level = 1; level <= levelCount; level++) {
                RtpSimulator.SimulationReport report = simulator.simulate(config, themeKey,
                        RtpSimulator.Strategy.LEVEL, ROUNDS, null, level, SEED);

                for (RtpSimulator.OptionReport option : report.options()) {
                    assertThat(option.empiricalRtp())
                            .as("тема %s, уровень %d, ставка %d (бустер x%.0f)",
                                    themeKey, level, option.optionId(), option.boostValue())
                            .isLessThan(1.0);
                }
            }
        }
    }

    @ParameterizedTest(name = "тема {0}: варианты ставок сбалансированы между собой")
    @ValueSource(strings = {GameConfig.THEME_GREEN, GameConfig.THEME_RED})
    @DisplayName("Лучшая стратегия каждого варианта ставки даёт сопоставимый RTP")
    void betOptionsAreBalancedUnderTheirBestStrategy(String themeKey) {
        // Ни один фрагмент не должен быть очевидно лучшим или очевидно худшим
        // выбором, иначе остальные три перестают быть решением игрока.
        double[] best = bestRtpPerOption(themeKey);

        double min = Double.MAX_VALUE;
        double max = 0;
        for (double value : best) {
            min = Math.min(min, value);
            max = Math.max(max, value);
        }

        assertThat(min).as("худший вариант ставки в теме %s", themeKey).isGreaterThan(RTP_FLOOR);
        assertThat(max).as("лучший вариант ставки в теме %s", themeKey).isLessThan(RTP_CEILING);
        assertThat(max - min).as("разброс RTP между вариантами в теме %s", themeKey).isLessThan(0.08);
    }

    @ParameterizedTest(name = "тема {0}: знание позиции бустера дало бы преимущество")
    @ValueSource(strings = {GameConfig.THEME_GREEN, GameConfig.THEME_RED})
    @DisplayName("Скрытие позиции бустера действительно необходимо")
    void hidingBoostPositionIsWhatKeepsTheModelSound(String themeKey) {
        // Стратегия-оракул знает, на каком уровне ждёт бустер, и забирает ровно
        // там. Она недостижима — сервер не раскрывает позицию до срабатывания —
        // но показывает, во что обошлась бы утечка: RTP уходит выше единицы.
        RtpSimulator.SimulationReport oracle = simulator.simulate(config, themeKey,
                RtpSimulator.Strategy.WAIT_FOR_BOOST, ROUNDS, null, null, SEED);
        double[] realizable = bestRtpPerOption(themeKey);

        for (RtpSimulator.OptionReport option : oracle.options()) {
            if (option.boostTier() == 1) {
                continue;
            }
            assertThat(option.empiricalRtp())
                    .as("оракул на ставке %d обыгрывает заведение", option.optionId())
                    .isGreaterThan(1.0)
                    .isGreaterThan(realizable[option.optionId() - 1]);
        }
    }

    @Test
    @DisplayName("Стратегия «не забирать никогда» проигрывает всегда")
    void holdingToCrashNeverPays() {
        RtpSimulator.SimulationReport report = simulator.simulate(config, GameConfig.THEME_RED,
                RtpSimulator.Strategy.HOLD_TO_CRASH, 5_000, null, null, SEED);

        for (RtpSimulator.OptionReport option : report.options()) {
            assertThat(option.empiricalRtp()).isZero();
            assertThat(option.winRate()).isZero();
            // Очки начисляются даже без выигрыша — на этом держится турнирный контур.
            assertThat(option.averagePointsPerRound()).isPositive();
        }
    }

    @Test
    @DisplayName("Одинаковый seed даёт побитово одинаковый отчёт")
    void reportIsReproducible() {
        RtpSimulator.SimulationReport first = simulator.simulate(config, GameConfig.THEME_GREEN,
                RtpSimulator.Strategy.LEVEL, 10_000, null, 3, 42L);
        RtpSimulator.SimulationReport second = simulator.simulate(config, GameConfig.THEME_GREEN,
                RtpSimulator.Strategy.LEVEL, 10_000, null, 3, 42L);

        assertThat(first).isEqualTo(second);
    }

    @Test
    @DisplayName("Симулятор считает по переданной конфигурации, а не по сохранённой")
    void simulatorHonoursDraftConfig() {
        // Это свойство делает админскую кнопку «проверить, не применяя» честной.
        GameConfig harsher = TestConfigs.withAlpha(config, GameConfig.THEME_GREEN, 1.8);

        double baseline = simulator.simulate(config, GameConfig.THEME_GREEN,
                        RtpSimulator.Strategy.TARGET_MULTIPLIER, ROUNDS, 3.0, null, SEED)
                .options().get(0).empiricalRtp();
        double tightened = simulator.simulate(harsher, GameConfig.THEME_GREEN,
                        RtpSimulator.Strategy.TARGET_MULTIPLIER, ROUNDS, 3.0, null, SEED)
                .options().get(0).empiricalRtp();

        assertThat(tightened).isLessThan(baseline);
    }

    /** Лучший RTP, достижимый выбором порога выхода, по каждому варианту ставки. */
    private double[] bestRtpPerOption(String themeKey) {
        int levelCount = config.theme(themeKey).levelCount();
        double[] best = new double[config.theme(themeKey).betOptions().size()];

        for (int level = 1; level <= levelCount; level++) {
            RtpSimulator.SimulationReport report = simulator.simulate(config, themeKey,
                    RtpSimulator.Strategy.LEVEL, ROUNDS, null, level, SEED);
            for (RtpSimulator.OptionReport option : report.options()) {
                int index = option.optionId() - 1;
                best[index] = Math.max(best[index], option.empiricalRtp());
            }
        }
        return best;
    }
}
