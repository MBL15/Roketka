package ru.stoloto.balloon.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Административная панель перезаписывает тот же файл, который правят руками.
 * Эти тесты защищают главное свойство такого решения: сохранение из UI не
 * должно ни терять значения, ни лишать файл пояснений.
 */
class GameConfigYamlWriterTest {

    private final ObjectMapper yaml = new ObjectMapper(new YAMLFactory()).findAndRegisterModules();
    private final GameConfigYamlWriter writer = new GameConfigYamlWriter();
    private final GameConfigValidator validator = new GameConfigValidator();

    @Test
    @DisplayName("Запись и повторное чтение не меняют конфигурацию")
    void roundTripPreservesValues() throws Exception {
        GameConfig original = TestConfigs.defaults();
        GameConfig reparsed = yaml.readValue(writer.write(original), GameConfig.class);

        assertThat(validator.validate(reparsed)).isEmpty();
        assertThat(reparsed.version()).isEqualTo(original.version());
        assertThat(reparsed.themes().keySet()).isEqualTo(original.themes().keySet());

        original.themes().forEach((key, theme) -> {
            GameConfig.ThemeConfig actual = reparsed.theme(key);
            assertThat(actual.gameName()).isEqualTo(theme.gameName());
            assertThat(actual.levelMultipliers()).isEqualTo(theme.levelMultipliers());
            assertThat(actual.lootProbabilities()).isEqualTo(theme.lootProbabilities());
            assertThat(actual.boostTierValues()).isEqualTo(theme.boostTierValues());
            assertThat(actual.points().perLine()).isEqualTo(theme.points().perLine());
            assertThat(actual.points().boostBonusPerTier()).isEqualTo(theme.points().boostBonusPerTier());
            assertThat(actual.betOptions()).hasSameSizeAs(theme.betOptions());
            for (int i = 0; i < theme.betOptions().size(); i++) {
                assertThat(actual.betOptions().get(i).cost())
                        .isEqualTo(theme.betOptions().get(i).cost());
                assertThat(actual.betOptions().get(i).alphaShift())
                        .isCloseTo(theme.betOptions().get(i).alphaShift(),
                                org.assertj.core.data.Offset.offset(1e-6));
            }
        });

        assertThat(reparsed.upsell()).isEqualTo(original.upsell());
        assertThat(reparsed.session()).isEqualTo(original.session());
        assertThat(reparsed.reward()).isEqualTo(original.reward());
        assertThat(reparsed.tournament()).isEqualTo(original.tournament());
    }

    @Test
    @DisplayName("Сохранённый файл остаётся самодокументированным")
    void writtenFileKeepsComments() {
        String written = writer.write(TestConfigs.defaults());

        assertThat(written)
                .contains("ГОРЯЧАЯ ПЕРЕЗАГРУЗКА")
                .contains("docs/CONFIGURATION.md")
                .contains("points_per_line")
                .contains("multiplier_tier_N_value")
                .contains("line_N_loot_prob")
                .contains("MIN_WIN_AMOUNT");
    }

    @Test
    @DisplayName("В файле остаются пояснения, объясняющие нетривиальные решения модели")
    void writtenFileExplainsTheTrickyDecisions() {
        String written = writer.write(TestConfigs.defaults());

        // Почему позиция бустера скрыта и почему у усиленных ставок своя alpha —
        // это ровно те два места, где значение параметра невозможно понять из
        // его имени. Если пояснения пропадут, файл перестанет быть пригодным
        // для настройки без чтения исходников.
        assertThat(written)
                .contains("НЕ раскрывается")
                .contains("docs/MATH_MODEL.md")
                .contains("alphaShift")
                .contains("0.92..0.94")
                .contains("пересчитать симулятором");
    }

    @Test
    @DisplayName("Пояснения выровнены по колонке независимо от длины значения")
    void commentsAreAlignedRegardlessOfValueWidth() {
        // maxMultiplier отличается между темами (60.0 и 250.0), а alphaShift —
        // между вариантами ставки (0.0 и 0.43). Если выравнивание сломается,
        // разъедется именно здесь.
        String written = writer.write(TestConfigs.defaults());

        written.lines()
                .filter(line -> !line.stripLeading().startsWith("#"))
                .filter(line -> line.contains(": ") && line.contains("# "))
                .forEach(line -> {
                    int hash = line.indexOf('#');
                    int valueEnd = line.substring(0, hash).stripTrailing().length();
                    if (valueEnd < GameConfigYamlWriter.COMMENT_COLUMN) {
                        assertThat(hash).as("выровнено: %s", line)
                                .isEqualTo(GameConfigYamlWriter.COMMENT_COLUMN);
                    } else {
                        assertThat(hash).as("длинное значение, один пробел: %s", line)
                                .isEqualTo(valueEnd + 1);
                    }
                });
    }

    @Test
    @DisplayName("Изменённое значение действительно попадает в файл")
    void changedValueIsSerialized() throws Exception {
        GameConfig config = TestConfigs.defaults();
        GameConfig.ThemeConfig green = config.theme(GameConfig.THEME_GREEN);
        GameConfig updated = TestConfigs.withTheme(config, GameConfig.THEME_GREEN,
                TestConfigs.withPoints(green, new GameConfig.PointsConfig(
                        77, green.points().cashoutBonus(), green.points().boostBonusPerTier())));

        String written = writer.write(updated);
        GameConfig reparsed = yaml.readValue(written, GameConfig.class);

        assertThat(reparsed.theme(GameConfig.THEME_GREEN).points().perLine()).isEqualTo(77);
    }
}
