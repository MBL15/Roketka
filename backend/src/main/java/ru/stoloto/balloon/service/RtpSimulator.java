package ru.stoloto.balloon.service;

import org.springframework.stereotype.Service;
import ru.stoloto.balloon.config.GameConfig;
import ru.stoloto.balloon.game.CrashMath;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Monte-Carlo симулятор игровой экономики.
 *
 * <p>Отвечает на вопрос, который нельзя проверить одним раундом: «что
 * произойдёт с игрой, если поменять эти параметры». Прогоняет десятки тысяч
 * раундов на заданной конфигурации и возвращает RTP, долю выигрышных раундов,
 * средний коэффициент выхода и вероятность дожить до бустера — по каждому из
 * четырёх вариантов ставки отдельно.
 *
 * <p>Симулятор работает с конфигурацией, переданной аргументом, а не с
 * активной. Благодаря этому админка проверяет ещё не сохранённый черновик:
 * сначала видно последствия, потом принимается решение.
 *
 * <p>Поддерживается фиксированный seed: одна и та же серия воспроизводится
 * повторно, что нужно и для отладки, и для демонстрации экспертам.
 */
@Service
public class RtpSimulator {

    private static final int MAX_ROUNDS = 500_000;

    /**
     * Стратегии игрока.
     *
     * <p>{@link #TARGET_MULTIPLIER} и {@link #LEVEL} — реализуемые: игрок
     * выбирает порог заранее, опираясь только на то, что видит. Перебор
     * {@code LEVEL} по всем уровням и даёт верхнюю границу того, что может
     * выжать реальный игрок; именно по ней калибруется {@code alphaShift}.
     *
     * <p>{@link #WAIT_FOR_BOOST} — нереализуемая: она требует знать позицию
     * бустера до полёта, а сервер её не раскрывает. Оставлена как диагностика:
     * разрыв между ней и лучшей реализуемой стратегией показывает, сколько
     * стоит скрытая информация, и подтверждает, что скрывать её необходимо.
     */
    public enum Strategy {
        /** Забрать на фиксированном коэффициенте. */
        TARGET_MULTIPLIER,
        /** Забрать сразу после прохождения указанного уровня. */
        LEVEL,
        /** Оракул: дождаться уровня с бустером и забрать сразу после активации. */
        WAIT_FOR_BOOST,
        /** Не забирать никогда: базовая линия «полный риск». */
        HOLD_TO_CRASH
    }

    public SimulationReport simulate(GameConfig config, String themeKey, Strategy strategy,
                                     int roundsPerOption, Double targetMultiplier, Integer targetLevel,
                                     Long seed) {
        GameConfig.ThemeConfig theme = config.theme(themeKey);
        int rounds = Math.max(1_000, Math.min(roundsPerOption, MAX_ROUNDS));
        List<Double> levels = theme.levelMultipliers();

        List<OptionReport> optionReports = new ArrayList<>(theme.betOptions().size());
        for (GameConfig.BetOptionConfig option : theme.betOptions()) {
            optionReports.add(simulateOption(theme, option, strategy, rounds,
                    targetMultiplier, targetLevel, levels, seed));
        }

        GameConfig.MathConfig math = theme.math();
        return new SimulationReport(
                themeKey, theme.gameName(), strategy.name(), rounds, seed,
                round4(math.alpha()), round4(math.houseEdge()),
                round4(CrashMath.medianCrashPoint(math.alpha(), math.houseEdge())),
                optionReports);
    }

    private OptionReport simulateOption(GameConfig.ThemeConfig theme, GameConfig.BetOptionConfig option,
                                        Strategy strategy, int rounds,
                                        Double targetMultiplier, Integer targetLevel,
                                        List<Double> levels, Long seed) {
        GameConfig.MathConfig math = theme.math();
        double alpha = math.alpha() + option.alphaShift();
        double boostValue = theme.boostValue(option.boostTier());
        boolean hasBoost = option.boostTier() > 1;

        Random random = seed == null
                ? ThreadLocalRandom.current()
                : new Random(seed * 31L + option.id());

        long totalStaked = 0;
        long totalReturned = 0;
        int wins = 0;
        int boostActivations = 0;
        double sumCashoutMultiplier = 0;
        double sumCrash = 0;
        long sumPoints = 0;
        List<Double> crashSamples = new ArrayList<>(Math.min(rounds, 50_000));

        for (int i = 0; i < rounds; i++) {
            double crash = CrashMath.sampleCrashPoint(random.nextDouble(), alpha, math.houseEdge(),
                    math.minCrashMultiplier(), math.maxMultiplier(), math.delta());
            Integer boostLevel = hasBoost
                    ? CrashMath.pickBoostLevel(random.nextDouble(), theme.lootProbabilities())
                    : null;

            double target = resolveTarget(strategy, levels, boostLevel, targetMultiplier, targetLevel);
            boolean cashoutPlanned = strategy != Strategy.HOLD_TO_CRASH;
            boolean survived = cashoutPlanned && crash > target;

            boolean boostApplied = boostLevel != null
                    && levels.get(boostLevel - 1) <= (survived ? target : crash)
                    && crash > levels.get(boostLevel - 1);

            totalStaked += option.cost();
            sumCrash += crash;
            if (crashSamples.size() < 50_000) {
                crashSamples.add(crash);
            }

            int levelsPassed = CrashMath.levelsPassed(survived ? target : crash, levels);
            int points = levelsPassed * theme.points().perLine();
            if (survived) {
                points += theme.points().cashoutBonus();
                double payoutMultiplier = target * (boostApplied ? boostValue : 1.0);
                totalReturned += Math.round(option.cost() * payoutMultiplier);
                sumCashoutMultiplier += payoutMultiplier;
                wins++;
            }
            if (boostApplied) {
                points += theme.points().boostBonus(option.boostTier());
                boostActivations++;
            }
            sumPoints += points;
        }

        crashSamples.sort(Double::compareTo);
        double empiricalMedian = crashSamples.isEmpty() ? 0 : crashSamples.get(crashSamples.size() / 2);

        double target = resolveTarget(strategy, levels, null, targetMultiplier, targetLevel);
        double theoreticalRtp = strategy == Strategy.HOLD_TO_CRASH
                ? 0.0
                : CrashMath.theoreticalRtp(target, alpha, math.houseEdge());

        return new OptionReport(
                option.id(), option.cost(), option.boostTier(), boostValue,
                round4(alpha), round4(option.alphaShift()),
                round4((double) totalReturned / totalStaked),
                round4(theoreticalRtp),
                round4((double) wins / rounds),
                round4((double) boostActivations / rounds),
                round4(wins == 0 ? 0 : sumCashoutMultiplier / wins),
                round4(sumCrash / rounds),
                round4(empiricalMedian),
                round4((double) sumPoints / rounds)
        );
    }

    private double resolveTarget(Strategy strategy, List<Double> levels, Integer boostLevel,
                                 Double targetMultiplier, Integer targetLevel) {
        return switch (strategy) {
            case TARGET_MULTIPLIER -> targetMultiplier == null ? 2.0 : Math.max(1.01, targetMultiplier);
            case LEVEL -> {
                int level = targetLevel == null ? 1 : Math.max(1, Math.min(targetLevel, levels.size()));
                yield levels.get(level - 1);
            }
            // Без бустера стратегия «ждать бустер» вырождается в удержание до последнего уровня.
            case WAIT_FOR_BOOST -> boostLevel == null
                    ? levels.get(levels.size() - 1)
                    : levels.get(boostLevel - 1);
            case HOLD_TO_CRASH -> Double.MAX_VALUE;
        };
    }

    private static double round4(double value) {
        return Math.round(value * 10_000.0) / 10_000.0;
    }

    /**
     * @param theoreticalMedianCrash медиана точки краха из аналитической формулы —
     *                               ориентир для сверки с эмпирической
     */
    public record SimulationReport(String theme, String themeName, String strategy,
                                   int roundsPerOption, Long seed,
                                   double alpha, double houseEdge,
                                   double theoreticalMedianCrash,
                                   List<OptionReport> options) {
    }

    /**
     * @param empiricalRtp   отношение выплат к ставкам по симуляции
     * @param theoreticalRtp {@code (1 - houseEdge) * target^(1 - alpha)}, без учёта бустера
     */
    public record OptionReport(int optionId, long cost, int boostTier, double boostValue,
                               double effectiveAlpha, double alphaShift,
                               double empiricalRtp, double theoreticalRtp,
                               double winRate, double boostActivationRate,
                               double averageCashoutMultiplier,
                               double averageCrashMultiplier, double medianCrashMultiplier,
                               double averagePointsPerRound) {
    }
}
