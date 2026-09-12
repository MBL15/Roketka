package ru.stoloto.balloon.config;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Проверка допустимости значений игровой конфигурации.
 *
 * <p>Один и тот же валидатор используется и при чтении файла с диска, и при
 * сохранении из административной панели, поэтому оба пути дают одинаковые
 * сообщения об ошибках. Ошибки возвращаются списком на русском языке — их
 * показывает админка и отдаёт GET /api/admin/config/status.
 */
@Component
public class GameConfigValidator {

    public static final int SUPPORTED_VERSION = 1;
    private static final int REQUIRED_BET_OPTIONS = 4;
    private static final int REQUIRED_BOOST_TIERS = 4;

    public List<String> validate(GameConfig config) {
        List<String> errors = new ArrayList<>();
        if (config == null) {
            errors.add("Конфигурация пуста");
            return errors;
        }
        if (config.version() != SUPPORTED_VERSION) {
            errors.add("version: ожидается " + SUPPORTED_VERSION + ", получено " + config.version());
        }

        Map<String, GameConfig.ThemeConfig> themes = config.themes();
        if (themes == null || themes.isEmpty()) {
            errors.add("themes: не задана ни одна тема игры");
        } else {
            GameConfig.EXPECTED_LEVELS.forEach((key, expectedLevels) -> {
                GameConfig.ThemeConfig theme = themes.get(key);
                if (theme == null) {
                    errors.add("themes." + key + ": обязательная тема отсутствует");
                } else {
                    validateTheme(key, theme, expectedLevels, errors);
                }
            });
            themes.keySet().stream()
                    .filter(key -> !GameConfig.EXPECTED_LEVELS.containsKey(key))
                    .forEach(key -> errors.add("themes." + key + ": неизвестная тема, допустимы только green и red"));
            if (themes.values().stream().noneMatch(GameConfig.ThemeConfig::active)) {
                errors.add("themes: хотя бы одна тема должна быть active: true");
            }
        }

        validateReward(config.reward(), errors);
        validateUpsell(config.upsell(), errors);
        validateTournament(config.tournament(), errors);
        validateSession(config.session(), errors);
        return errors;
    }

    private void validateTheme(String key, GameConfig.ThemeConfig theme, int expectedLevels, List<String> errors) {
        String path = "themes." + key;
        if (isBlank(theme.gameId())) {
            errors.add(path + ".gameId: не должен быть пустым");
        }
        if (isBlank(theme.gameName())) {
            errors.add(path + ".gameName: не должно быть пустым");
        }

        validateMath(path + ".math", theme.math(), errors);
        validateLevels(path, theme, expectedLevels, errors);
        validateLoot(path, theme, expectedLevels, errors);
        validateBoostTiers(path, theme, errors);
        validateBetOptions(path, theme, errors);
        validatePoints(path + ".points", theme.points(), errors);
    }

    private void validateMath(String path, GameConfig.MathConfig math, List<String> errors) {
        if (math == null) {
            errors.add(path + ": раздел обязателен");
            return;
        }
        inRange(path + ".alpha", math.alpha(), 0.5, 3.0, errors);
        inRange(path + ".houseEdge", math.houseEdge(), 0.0, 0.30, errors);
        inRange(path + ".minCrashMultiplier", math.minCrashMultiplier(), 1.0, 10.0, errors);
        inRange(path + ".maxMultiplier", math.maxMultiplier(), 2.0, 10_000.0, errors);
        inRange(path + ".multiplierGrowthRate", math.multiplierGrowthRate(), 0.01, 2.0, errors);
        inRange(path + ".fps", math.fps(), 5, 60, errors);
        inRange(path + ".delta", math.delta(), 0.001, 1.0, errors);
        inRange(path + ".maxFlightSeconds", math.maxFlightSeconds(), 5, 600, errors);

        if (math.maxMultiplier() <= math.minCrashMultiplier()) {
            errors.add(path + ".maxMultiplier: должен быть больше minCrashMultiplier");
        }
    }

    private void validateLevels(String path, GameConfig.ThemeConfig theme, int expectedLevels, List<String> errors) {
        List<Double> levels = theme.levelMultipliers();
        if (levels == null || levels.isEmpty()) {
            errors.add(path + ".levelMultipliers: список обязателен");
            return;
        }
        if (levels.size() != expectedLevels) {
            errors.add(path + ".levelMultipliers: ожидается " + expectedLevels
                    + " уровней для этой темы, задано " + levels.size());
        }
        if (levels.get(0) <= 1.0) {
            errors.add(path + ".levelMultipliers[0]: первый уровень должен быть строго больше 1.0");
        }
        for (int i = 1; i < levels.size(); i++) {
            if (levels.get(i) <= levels.get(i - 1)) {
                errors.add(path + ".levelMultipliers[" + i + "]: список должен строго возрастать ("
                        + levels.get(i - 1) + " -> " + levels.get(i) + ")");
            }
        }
        GameConfig.MathConfig math = theme.math();
        if (math != null && levels.get(levels.size() - 1) > math.maxMultiplier()) {
            errors.add(path + ".levelMultipliers: последний уровень (" + levels.get(levels.size() - 1)
                    + ") недостижим при math.maxMultiplier = " + math.maxMultiplier());
        }
    }

    private void validateLoot(String path, GameConfig.ThemeConfig theme, int expectedLevels, List<String> errors) {
        List<Double> loot = theme.lootProbabilities();
        if (loot == null || loot.isEmpty()) {
            errors.add(path + ".lootProbabilities: список обязателен");
            return;
        }
        if (loot.size() != expectedLevels) {
            errors.add(path + ".lootProbabilities: ожидается " + expectedLevels + " значений, задано " + loot.size());
        }
        double sum = 0;
        for (int i = 0; i < loot.size(); i++) {
            double value = loot.get(i);
            if (value < 0) {
                errors.add(path + ".lootProbabilities[" + i + "]: вес не может быть отрицательным");
            }
            sum += value;
        }
        if (sum <= 0) {
            errors.add(path + ".lootProbabilities: сумма весов должна быть положительной");
        }
    }

    private void validateBoostTiers(String path, GameConfig.ThemeConfig theme, List<String> errors) {
        List<Double> tiers = theme.boostTierValues();
        if (tiers == null || tiers.size() != REQUIRED_BOOST_TIERS) {
            errors.add(path + ".boostTierValues: требуется ровно " + REQUIRED_BOOST_TIERS + " значения множителей");
            return;
        }
        if (Math.abs(tiers.get(0) - 1.0) > 1e-9) {
            errors.add(path + ".boostTierValues[0]: вариант «без усиления» должен быть равен 1.0");
        }
        for (int i = 1; i < tiers.size(); i++) {
            if (tiers.get(i) < tiers.get(i - 1)) {
                errors.add(path + ".boostTierValues[" + i + "]: множители должны не убывать");
            }
            inRange(path + ".boostTierValues[" + i + "]", tiers.get(i), 1.0, 50.0, errors);
        }
    }

    private void validateBetOptions(String path, GameConfig.ThemeConfig theme, List<String> errors) {
        List<GameConfig.BetOptionConfig> options = theme.betOptions();
        if (options == null || options.size() != REQUIRED_BET_OPTIONS) {
            errors.add(path + ".betOptions: требуется ровно " + REQUIRED_BET_OPTIONS
                    + " варианта ставки (4 фрагмента пазла)");
            return;
        }
        int tierCount = theme.boostTierValues() == null ? 0 : theme.boostTierValues().size();
        List<Integer> seenIds = new ArrayList<>();
        for (int i = 0; i < options.size(); i++) {
            GameConfig.BetOptionConfig option = options.get(i);
            String optionPath = path + ".betOptions[" + i + "]";
            if (seenIds.contains(option.id())) {
                errors.add(optionPath + ".id: идентификатор " + option.id() + " повторяется");
            }
            seenIds.add(option.id());
            if (option.cost() <= 0) {
                errors.add(optionPath + ".cost: стоимость ставки должна быть положительной");
            }
            if (option.boostTier() < 1 || option.boostTier() > tierCount) {
                errors.add(optionPath + ".boostTier: должен быть от 1 до " + tierCount);
            }
            inRange(optionPath + ".alphaShift", option.alphaShift(), 0.0, 2.0, errors);

            GameConfig.MathConfig math = theme.math();
            if (math != null) {
                double effective = math.alpha() + option.alphaShift();
                if (effective < 0.5 || effective > 4.0) {
                    errors.add(optionPath + ".alphaShift: итоговая alpha = " + round(effective)
                            + " выходит за допустимый диапазон 0.5..4.0");
                }
            }
        }
    }

    private void validatePoints(String path, GameConfig.PointsConfig points, List<String> errors) {
        if (points == null) {
            errors.add(path + ": раздел обязателен");
            return;
        }
        inRange(path + ".perLine", points.perLine(), 0, 100_000, errors);
        inRange(path + ".cashoutBonus", points.cashoutBonus(), 0, 100_000, errors);
        if (points.boostBonusPerTier() == null || points.boostBonusPerTier().size() != REQUIRED_BOOST_TIERS) {
            errors.add(path + ".boostBonusPerTier: требуется ровно " + REQUIRED_BOOST_TIERS + " значения");
        } else {
            List<Integer> bonuses = points.boostBonusPerTier();
            for (int i = 0; i < bonuses.size(); i++) {
                inRange(path + ".boostBonusPerTier[" + i + "]", bonuses.get(i), 0, 100_000, errors);
            }
        }
    }

    private void validateReward(GameConfig.RewardConfig reward, List<String> errors) {
        if (reward == null) {
            errors.add("reward: раздел обязателен");
            return;
        }
        inRange("reward.collectionSize", reward.collectionSize(), 2, 60, errors);
        inRange("reward.guaranteedNewChanceOnWin", reward.guaranteedNewChanceOnWin(), 0.0, 1.0, errors);
        inRange("reward.guaranteedNewChanceOnLoss", reward.guaranteedNewChanceOnLoss(), 0.0, 1.0, errors);
        inRange("reward.duplicateCompensationPoints", reward.duplicateCompensationPoints(), 0, 100_000, errors);
        inRange("reward.completionBonusPoints", reward.completionBonusPoints(), 0, 1_000_000, errors);
        inRange("reward.completionBonusBalance", reward.completionBonusBalance(), 0, 1_000_000, errors);
        if (isBlank(reward.collectionName())) {
            errors.add("reward.collectionName: не должно быть пустым");
        }
    }

    private void validateUpsell(GameConfig.UpsellConfig upsell, List<String> errors) {
        if (upsell == null) {
            errors.add("upsell: раздел обязателен");
            return;
        }
        inRange("upsell.minWinAmount", upsell.minWinAmount(), 0, 10_000_000, errors);
        inRange("upsell.popupTimeoutSeconds", upsell.popupTimeoutSeconds(), 1, 300, errors);
        inRange("upsell.ticketPriceBonus", upsell.ticketPriceBonus(), 1, 1_000_000, errors);
        inRange("upsell.maxTickets", upsell.maxTickets(), 1, 1_000, errors);
        inRange("upsell.winShare", upsell.winShare(), 0.01, 5.0, errors);
    }

    private void validateTournament(GameConfig.TournamentConfig tournament, List<String> errors) {
        if (tournament == null) {
            errors.add("tournament: раздел обязателен");
            return;
        }
        inRange("tournament.durationDays", tournament.durationDays(), 1, 365, errors);
        inRange("tournament.liveRatingSize", tournament.liveRatingSize(), 3, 100, errors);
        if (isBlank(tournament.name())) {
            errors.add("tournament.name: не должно быть пустым");
        }
        GameConfig.SimulationConfig simulation = tournament.simulation();
        if (simulation == null) {
            errors.add("tournament.simulation: раздел обязателен");
        } else {
            inRange("tournament.simulation.botCount", simulation.botCount(), 0, 500, errors);
            inRange("tournament.simulation.tickSeconds", simulation.tickSeconds(), 1, 60, errors);
            inRange("tournament.simulation.maxPointsPerTick", simulation.maxPointsPerTick(), 0, 10_000, errors);
        }
    }

    private void validateSession(GameConfig.SessionConfig session, List<String> errors) {
        if (session == null) {
            errors.add("session: раздел обязателен");
            return;
        }
        inRange("session.resultIdleTimeoutSeconds", session.resultIdleTimeoutSeconds(), 3, 300, errors);
        inRange("session.onboardingHintSeconds", session.onboardingHintSeconds(), 1, 60, errors);
        inRange("session.historySize", session.historySize(), 5, 500, errors);
        inRange("session.demoBonusBalance", session.demoBonusBalance(), 0, 10_000_000, errors);
        inRange("session.playerStartingBalance", session.playerStartingBalance(), 0, 10_000_000, errors);
    }

    private void inRange(String path, double value, double min, double max, List<String> errors) {
        if (value < min || value > max) {
            errors.add(path + ": значение " + round(value) + " вне допустимого диапазона "
                    + round(min) + ".." + round(max));
        }
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static String round(double value) {
        return value == Math.rint(value) && Math.abs(value) < 1e9
                ? String.valueOf((long) value)
                : String.format(java.util.Locale.ROOT, "%.4f", value);
    }
}
