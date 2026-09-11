package ru.stoloto.balloon.config;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Иммутабельное представление config/game-config.yaml.
 *
 * <p>Структура намеренно повторяет YAML один-в-один: тот же объект отдаётся
 * административной панели, принимается от неё обратно и сериализуется в файл.
 * Благодаря этому правка руками и правка через UI не расходятся.
 *
 * <p>Объект целиком заменяется при горячей перезагрузке, поэтому все поля
 * final: раунд, начатый на старой конфигурации, доигрывается на своём снимке
 * параметров и не может быть изменён извне.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record GameConfig(
        int version,
        Map<String, ThemeConfig> themes,
        RewardConfig reward,
        UpsellConfig upsell,
        TournamentConfig tournament,
        SessionConfig session
) {

    public static final String THEME_GREEN = "green";
    public static final String THEME_RED = "red";

    /** Ожидаемое число уровней для каждой темы — проверяется валидатором. */
    public static final Map<String, Integer> EXPECTED_LEVELS =
            Map.of(THEME_GREEN, 9, THEME_RED, 12);

    @JsonIgnore
    public ThemeConfig theme(String key) {
        ThemeConfig theme = themes == null ? null : themes.get(key);
        if (theme == null) {
            throw new IllegalArgumentException("Неизвестная тема игры: " + key);
        }
        return theme;
    }

    @JsonIgnore
    public Map<String, ThemeConfig> orderedThemes() {
        Map<String, ThemeConfig> ordered = new LinkedHashMap<>();
        if (themes != null) {
            if (themes.containsKey(THEME_GREEN)) {
                ordered.put(THEME_GREEN, themes.get(THEME_GREEN));
            }
            if (themes.containsKey(THEME_RED)) {
                ordered.put(THEME_RED, themes.get(THEME_RED));
            }
            themes.forEach(ordered::putIfAbsent);
        }
        return ordered;
    }

    // ------------------------------------------------------------------ тема

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ThemeConfig(
            String gameId,
            String gameName,
            String gameType,
            boolean active,
            MathConfig math,
            List<Double> levelMultipliers,
            List<Double> lootProbabilities,
            List<Double> boostTierValues,
            List<BetOptionConfig> betOptions,
            PointsConfig points
    ) {
        @JsonIgnore
        public int levelCount() {
            return levelMultipliers == null ? 0 : levelMultipliers.size();
        }

        @JsonIgnore
        public BetOptionConfig betOption(int id) {
            if (betOptions != null) {
                for (BetOptionConfig option : betOptions) {
                    if (option.id() == id) {
                        return option;
                    }
                }
            }
            throw new IllegalArgumentException("Неизвестный вариант ставки: " + id);
        }

        /** Значение множителя бустера для уровня усиления (multiplier_tier_N_value). */
        @JsonIgnore
        public double boostValue(int tier) {
            if (boostTierValues == null || tier < 1 || tier > boostTierValues.size()) {
                return 1.0;
            }
            return boostTierValues.get(tier - 1);
        }

        /** Коэффициент, на котором считается пройденным уровень {@code level} (1-based). */
        @JsonIgnore
        public double levelThreshold(int level) {
            return levelMultipliers.get(level - 1);
        }
    }

    /**
     * Параметры математической модели.
     *
     * @param alpha                форма хвоста распределения точки краха
     * @param houseEdge            доля раундов с мгновенным крахом, задаёт базовый RTP
     * @param minCrashMultiplier   минимально возможная точка краха
     * @param maxMultiplier        потолок коэффициента
     * @param multiplierGrowthRate темп роста коэффициента, m(t) = exp(rate * t)
     * @param fps                  частота серверных тиков
     * @param delta                шаг округления коэффициента при выдаче наружу
     * @param maxFlightSeconds     предохранитель от бесконечного раунда
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record MathConfig(
            double alpha,
            double houseEdge,
            double minCrashMultiplier,
            double maxMultiplier,
            double multiplierGrowthRate,
            int fps,
            double delta,
            int maxFlightSeconds
    ) {
    }

    /**
     * Вариант ставки — «фрагмент пазла» на экране выбора.
     *
     * @param alphaShift надбавка к alpha, компенсирующая прирост RTP от бустера:
     *                   нагруженный шар лопается раньше
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record BetOptionConfig(
            int id,
            long cost,
            int boostTier,
            double alphaShift
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record PointsConfig(
            int perLine,
            int cashoutBonus,
            List<Integer> boostBonusPerTier
    ) {
        @JsonIgnore
        public int boostBonus(int tier) {
            if (boostBonusPerTier == null || tier < 1 || tier > boostBonusPerTier.size()) {
                return 0;
            }
            return boostBonusPerTier.get(tier - 1);
        }
    }

    // ------------------------------------------------------- прочие разделы

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record RewardConfig(
            boolean enabled,
            String collectionName,
            int collectionSize,
            double guaranteedNewChanceOnWin,
            double guaranteedNewChanceOnLoss,
            int duplicateCompensationPoints,
            int completionBonusPoints,
            long completionBonusBalance
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record UpsellConfig(
            boolean enabled,
            long minWinAmount,
            int popupTimeoutSeconds,
            long ticketPriceBonus,
            int maxTickets,
            double winShare
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record TournamentConfig(
            boolean enabled,
            String name,
            int durationDays,
            int liveRatingSize,
            boolean anonymizeNames,
            SimulationConfig simulation
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record SimulationConfig(
            boolean enabled,
            int botCount,
            int tickSeconds,
            int maxPointsPerTick
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record SessionConfig(
            int resultIdleTimeoutSeconds,
            int onboardingHintSeconds,
            int historySize,
            long demoBonusBalance
    ) {
    }
}
