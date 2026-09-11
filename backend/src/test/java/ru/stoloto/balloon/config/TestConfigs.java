package ru.stoloto.balloon.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import org.springframework.core.io.ClassPathResource;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Загрузка заводской конфигурации и точечные мутации для тестов. */
public final class TestConfigs {

    private static final ObjectMapper YAML = new ObjectMapper(new YAMLFactory()).findAndRegisterModules();

    private TestConfigs() {
    }

    public static String defaultYaml() {
        try (InputStream in = new ClassPathResource("default-game-config.yaml").getInputStream()) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    public static GameConfig defaults() {
        try {
            return YAML.readValue(defaultYaml(), GameConfig.class);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    public static GameConfig withTheme(GameConfig config, String key, GameConfig.ThemeConfig theme) {
        Map<String, GameConfig.ThemeConfig> themes = new LinkedHashMap<>(config.themes());
        themes.put(key, theme);
        return new GameConfig(config.version(), themes, config.reward(), config.upsell(),
                config.tournament(), config.session());
    }

    public static GameConfig.ThemeConfig withMath(GameConfig.ThemeConfig theme, GameConfig.MathConfig math) {
        return new GameConfig.ThemeConfig(theme.gameId(), theme.gameName(), theme.gameType(), theme.active(),
                math, theme.levelMultipliers(), theme.lootProbabilities(), theme.boostTierValues(),
                theme.betOptions(), theme.points());
    }

    public static GameConfig.ThemeConfig withLevels(GameConfig.ThemeConfig theme, List<Double> levels) {
        return new GameConfig.ThemeConfig(theme.gameId(), theme.gameName(), theme.gameType(), theme.active(),
                theme.math(), levels, theme.lootProbabilities(), theme.boostTierValues(),
                theme.betOptions(), theme.points());
    }

    public static GameConfig.ThemeConfig withLoot(GameConfig.ThemeConfig theme, List<Double> loot) {
        return new GameConfig.ThemeConfig(theme.gameId(), theme.gameName(), theme.gameType(), theme.active(),
                theme.math(), theme.levelMultipliers(), loot, theme.boostTierValues(),
                theme.betOptions(), theme.points());
    }

    public static GameConfig.ThemeConfig withPoints(GameConfig.ThemeConfig theme, GameConfig.PointsConfig points) {
        return new GameConfig.ThemeConfig(theme.gameId(), theme.gameName(), theme.gameType(), theme.active(),
                theme.math(), theme.levelMultipliers(), theme.lootProbabilities(), theme.boostTierValues(),
                theme.betOptions(), points);
    }

    /** Меняет alpha одной темы, не трогая остальную конфигурацию. */
    public static GameConfig withAlpha(GameConfig config, String themeKey, double alpha) {
        GameConfig.ThemeConfig theme = config.theme(themeKey);
        return withTheme(config, themeKey, withMath(theme, withAlpha(theme.math(), alpha)));
    }

    public static GameConfig.MathConfig withAlpha(GameConfig.MathConfig math, double alpha) {
        return new GameConfig.MathConfig(alpha, math.houseEdge(), math.minCrashMultiplier(),
                math.maxMultiplier(), math.multiplierGrowthRate(), math.fps(), math.delta(),
                math.maxFlightSeconds());
    }
}
