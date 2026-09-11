package ru.stoloto.balloon.game;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.List;
import java.util.Random;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Проверка математической модели.
 *
 * <p>Тесты сформулированы как свойства распределения, а не как сравнение с
 * заранее вычисленными числами: именно свойства («RTP не зависит от момента
 * выхода при alpha = 1», «доля мгновенных крахов равна houseEdge») и являются
 * содержанием модели, описанным в docs/MATH_MODEL.md.
 */
class CrashMathTest {

    private static final double EDGE = 0.04;
    private static final double MIN_CRASH = 1.01;
    private static final double MAX_CRASH = 10_000.0;
    private static final double DELTA = 0.01;

    @Test
    @DisplayName("Ветка мгновенного краха срабатывает ровно при u < houseEdge")
    void instantCrashBranchIsTriggeredByHouseEdge() {
        // Граница проверяется точно, без статистики: чуть ниже edge — мгновенный
        // крах, чуть выше — обычный розыгрыш, который у самой границы даёт
        // максимально возможный коэффициент.
        assertThat(CrashMath.sampleCrashPoint(0.0, 1.0, EDGE, MIN_CRASH, MAX_CRASH, DELTA))
                .isEqualTo(MIN_CRASH);
        assertThat(CrashMath.sampleCrashPoint(EDGE - 1e-12, 1.0, EDGE, MIN_CRASH, MAX_CRASH, DELTA))
                .isEqualTo(MIN_CRASH);
        assertThat(CrashMath.sampleCrashPoint(EDGE, 1.0, EDGE, MIN_CRASH, MAX_CRASH, DELTA))
                .isEqualTo(MAX_CRASH);
    }

    @Test
    @DisplayName("Доля раундов на минимальном коэффициенте = houseEdge плюс округление вниз")
    void minimumCrashShareAccountsForQuantization() {
        // На MIN_CRASH попадают две группы: мгновенные крахи (доля edge) и те
        // розыгрыши, чей «сырой» коэффициент оказался в [MIN_CRASH; MIN_CRASH +
        // DELTA) и был округлён вниз. Вторую группу нельзя игнорировать — иначе
        // проверка ловит не ошибку кода, а собственную неточность.
        int rounds = 200_000;
        int atMinimum = 0;
        Random random = new Random(20260911L);
        for (int i = 0; i < rounds; i++) {
            double crash = CrashMath.sampleCrashPoint(random.nextDouble(), 1.0, EDGE,
                    MIN_CRASH, MAX_CRASH, DELTA);
            if (crash <= MIN_CRASH) {
                atMinimum++;
            }
        }
        double quantized = 1.0 - Math.pow(MIN_CRASH + DELTA, -1.0);
        double expected = EDGE + (1.0 - EDGE) * quantized;
        assertThat((double) atMinimum / rounds)
                .isCloseTo(expected, org.assertj.core.data.Offset.offset(0.005));
    }

    @ParameterizedTest(name = "выживание до {0}x соответствует формуле")
    @ValueSource(doubles = {1.5, 2.0, 3.0, 5.0, 10.0})
    @DisplayName("Эмпирическая функция выживания совпадает с (1 - edge) * m^(-alpha)")
    void survivalProbabilityMatchesFormula(double target) {
        int rounds = 300_000;
        int survived = 0;
        Random random = new Random(777L);
        for (int i = 0; i < rounds; i++) {
            double crash = CrashMath.sampleCrashPoint(random.nextDouble(), 1.0, EDGE,
                    MIN_CRASH, MAX_CRASH, DELTA);
            if (crash > target) {
                survived++;
            }
        }
        double expected = CrashMath.survivalProbability(target, 1.0, EDGE);
        assertThat((double) survived / rounds)
                .isCloseTo(expected, org.assertj.core.data.Offset.offset(0.01));
    }

    @Test
    @DisplayName("При alpha = 1 RTP одинаков для любого момента выхода")
    void rtpIsFlatWhenAlphaIsOne() {
        for (double target : new double[]{1.2, 2.0, 3.5, 7.0, 20.0}) {
            assertThat(CrashMath.theoreticalRtp(target, 1.0, EDGE))
                    .isCloseTo(1.0 - EDGE, org.assertj.core.data.Offset.offset(1e-9));
        }
    }

    @Test
    @DisplayName("Увеличение alpha снижает RTP: так компенсируется прирост от бустера")
    void largerAlphaReducesRtp() {
        double withoutBoost = CrashMath.theoreticalRtp(3.0, 1.0, EDGE);
        double withBoostCompensation = CrashMath.theoreticalRtp(3.0, 1.58, EDGE);
        assertThat(withBoostCompensation).isLessThan(withoutBoost);

        // Бустер x2 умножает выплату, поэтому сравнивать нужно 2 * RTP.
        assertThat(2 * withBoostCompensation)
                .isCloseTo(withoutBoost, org.assertj.core.data.Offset.offset(0.1));
    }

    @Test
    @DisplayName("Точка краха всегда в заданных границах и кратна delta")
    void crashPointStaysWithinBounds() {
        Random random = new Random(42L);
        for (int i = 0; i < 50_000; i++) {
            double crash = CrashMath.sampleCrashPoint(random.nextDouble(), 1.2, EDGE, 1.5, 25.0, DELTA);
            assertThat(crash).isBetween(1.5, 25.0);
            assertThat(Math.round(crash * 100) / 100.0).isCloseTo(crash,
                    org.assertj.core.data.Offset.offset(1e-9));
        }
    }

    @Test
    @DisplayName("Рост коэффициента обратим: время -> коэффициент -> время")
    void growthIsInvertible() {
        double rate = 0.17;
        for (double seconds : new double[]{0.5, 1.0, 3.7, 12.0}) {
            double multiplier = CrashMath.multiplierAt(seconds, rate);
            assertThat(CrashMath.secondsToReach(multiplier, rate))
                    .isCloseTo(seconds, org.assertj.core.data.Offset.offset(1e-9));
        }
    }

    @Test
    @DisplayName("Уровень считается пройденным по достижении его границы")
    void levelsPassedCountsReachedThresholds() {
        List<Double> levels = List.of(1.20, 1.50, 1.90, 2.40);
        assertThat(CrashMath.levelsPassed(1.00, levels)).isZero();
        assertThat(CrashMath.levelsPassed(1.19, levels)).isZero();
        assertThat(CrashMath.levelsPassed(1.20, levels)).isEqualTo(1);
        assertThat(CrashMath.levelsPassed(1.89, levels)).isEqualTo(2);
        assertThat(CrashMath.levelsPassed(9.99, levels)).isEqualTo(4);
    }

    @Test
    @DisplayName("Бустер распределяется по уровням пропорционально весам")
    void boostLevelFollowsWeights() {
        List<Double> weights = List.of(0.1, 0.2, 0.7);
        int[] hits = new int[4];
        Random random = new Random(1234L);
        int rounds = 120_000;
        for (int i = 0; i < rounds; i++) {
            hits[CrashMath.pickBoostLevel(random.nextDouble(), weights)]++;
        }
        assertThat((double) hits[1] / rounds).isCloseTo(0.1, org.assertj.core.data.Offset.offset(0.01));
        assertThat((double) hits[2] / rounds).isCloseTo(0.2, org.assertj.core.data.Offset.offset(0.01));
        assertThat((double) hits[3] / rounds).isCloseTo(0.7, org.assertj.core.data.Offset.offset(0.01));
    }

    @Test
    @DisplayName("Ненормированные веса нормируются автоматически")
    void unnormalizedWeightsAreNormalized() {
        List<Double> weights = List.of(2.0, 2.0);
        assertThat(CrashMath.pickBoostLevel(0.0, weights)).isEqualTo(1);
        assertThat(CrashMath.pickBoostLevel(0.49, weights)).isEqualTo(1);
        assertThat(CrashMath.pickBoostLevel(0.51, weights)).isEqualTo(2);
        assertThat(CrashMath.pickBoostLevel(0.999999, weights)).isEqualTo(2);
    }

    @Test
    @DisplayName("Округление коэффициента всегда вниз: отображаемое значение не обгонит крах")
    void quantizationNeverRoundsUp() {
        assertThat(CrashMath.quantizeDown(2.3749, 0.01)).isEqualTo(2.37);
        assertThat(CrashMath.quantizeDown(2.3799, 0.01)).isEqualTo(2.37);
        assertThat(CrashMath.quantizeDown(2.38, 0.01)).isEqualTo(2.38);
    }

    @Test
    @DisplayName("Медиана точки краха согласуется с симуляцией")
    void medianMatchesSimulation() {
        double alpha = 1.4;
        double[] samples = new double[100_001];
        Random random = new Random(9090L);
        for (int i = 0; i < samples.length; i++) {
            samples[i] = CrashMath.sampleCrashPoint(random.nextDouble(), alpha, EDGE,
                    MIN_CRASH, MAX_CRASH, DELTA);
        }
        java.util.Arrays.sort(samples);
        double empiricalMedian = samples[samples.length / 2];
        assertThat(empiricalMedian).isCloseTo(CrashMath.medianCrashPoint(alpha, EDGE),
                org.assertj.core.data.Offset.offset(0.05));
    }
}
