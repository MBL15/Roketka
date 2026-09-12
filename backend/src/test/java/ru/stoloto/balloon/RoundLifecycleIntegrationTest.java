package ru.stoloto.balloon;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import ru.stoloto.balloon.config.GameConfig;
import ru.stoloto.balloon.config.GameConfigYamlWriter;
import ru.stoloto.balloon.config.TestConfigs;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * Сквозная проверка обязательных сценариев постановки на реальном приложении:
 * ставка и списание, успешный cashout, проигрыш по крах, активация бустера,
 * изменение параметров без правки кода.
 *
 * <h2>Как убран элемент случайности</h2>
 * Тест подменяет игровую конфигурацию на детерминированную:
 * {@code houseEdge = 0}, {@code minCrashMultiplier = 5.0} — шар гарантированно
 * доживает до первого уровня, поэтому cashout всегда достижим; вес лотереи
 * бустера целиком отдан первому уровню, поэтому бустер всегда срабатывает
 * сразу. Сама механика при этом не подменяется: работает тот же код, что и
 * в бою.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
class RoundLifecycleIntegrationTest {

    private static Path configPath;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper json;

    @DynamicPropertySource
    static void prepareEnvironment(DynamicPropertyRegistry registry) throws Exception {
        Path directory = Files.createTempDirectory("balloon-it");
        configPath = directory.resolve("game-config.yaml");
        Files.writeString(configPath, deterministicYaml(), StandardCharsets.UTF_8);

        registry.add("balloon.config-path", () -> configPath.toString());
        registry.add("spring.datasource.url", () ->
                "jdbc:h2:mem:balloon-it;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE");
        registry.add("balloon.simulation-enabled", () -> "false");
    }

    /** Конфигурация без случайности в тех местах, которые проверяет тест. */
    private static String deterministicYaml() {
        GameConfig defaults = TestConfigs.defaults();
        GameConfig prepared = defaults;
        for (String key : List.of(GameConfig.THEME_GREEN, GameConfig.THEME_RED)) {
            GameConfig.ThemeConfig theme = prepared.theme(key);
            GameConfig.MathConfig math = theme.math();
            GameConfig.MathConfig deterministic = new GameConfig.MathConfig(
                    math.alpha(), 0.0, 5.0, math.maxMultiplier(),
                    1.0, math.fps(), math.delta(), math.maxFlightSeconds());
            List<Double> loot = new java.util.ArrayList<>(
                    java.util.Collections.nCopies(theme.levelCount(), 0.0));
            loot.set(0, 1.0);
            prepared = TestConfigs.withTheme(prepared, key,
                    TestConfigs.withLoot(TestConfigs.withMath(theme, deterministic), loot));
        }
        return new GameConfigYamlWriter().write(prepared);
    }

    // ------------------------------------------------------------ сценарий 1

    @Test
    @DisplayName("Сценарий 1: выбор ставки списывает бонусы и открывает полёт")
    void scenarioOneStartsRoundAndDebitsBalance() throws Exception {
        String token = login("demo", "demo");

        JsonNode setup = readJson(get("/api/game/setup"), token);
        JsonNode themes = setup.get("themes");
        assertThat(themes).hasSize(2);
        assertThat(levelCountOf(themes, "green")).isEqualTo(9);
        assertThat(levelCountOf(themes, "red")).isEqualTo(12);

        long balanceBefore = readJson(get("/api/auth/me"), token).get("bonusBalance").asLong();
        JsonNode round = startRound(token, "green", 1);

        assertThat(round.get("roundId").asLong()).isPositive();
        assertThat(round.get("levelCount").asInt()).isEqualTo(9);
        assertThat(round.get("serverSeedHash").asText()).hasSize(64);
        // Точка краха клиенту не передаётся ни под каким именем.
        assertThat(round.has("crashMultiplier")).isFalse();

        long bet = round.get("betAmount").asLong();
        assertThat(round.get("balance").asLong()).isEqualTo(balanceBefore - bet);

        waitForRoundToFinish(token, round.get("roundId").asLong());
    }

    @Test
    @DisplayName("Произвольная сумма ставки принимается без бустера")
    void customBetAmountStartsRound() throws Exception {
        String token = login("judge", "judge");
        long balanceBefore = readJson(get("/api/auth/me"), token).get("bonusBalance").asLong();

        JsonNode round = startRoundWithAmount(token, "green", 175);
        assertThat(round.get("betAmount").asLong()).isEqualTo(175);
        assertThat(round.get("boostTier").asInt()).isEqualTo(1);
        assertThat(round.get("boostValue").asDouble()).isEqualTo(1.0);
        assertThat(round.get("balance").asLong()).isEqualTo(balanceBefore - 175);

        waitForRoundToFinish(token, round.get("roundId").asLong());
    }

    @Test
    @DisplayName("История завершённых раундов доступна и пополняется")
    void sharedHistoryIsPopulated() throws Exception {
        String token = login("demo", "demo");
        long roundId = startRound(token, "green", 1).get("roundId").asLong();
        waitForRoundToFinish(token, roundId);

        JsonNode history = readJson(get("/api/game/history"), token);
        assertThat(history.isArray()).isTrue();
        boolean containsRound = false;
        for (JsonNode entry : history) {
            if (entry.get("roundId").asLong() == roundId) {
                containsRound = true;
                assertThat(entry.get("crashMultiplier").asDouble()).isGreaterThanOrEqualTo(5.0);
            }
        }
        assertThat(containsRound).isTrue();
    }

    // ------------------------------------------------- сценарии 2 и 4 вместе

    @Test
    @DisplayName("Сценарии 2 и 4: бустер умножает коэффициент, cashout фиксирует выплату, результат приходит после краха")
    void scenarioTwoAndFourCashoutWithBoost() throws Exception {
        String token = login("expert", "expert");

        JsonNode round = startRound(token, "green", 4);
        long roundId = round.get("roundId").asLong();
        assertThat(round.get("boostValue").asDouble()).isEqualTo(4.0);
        // Позиция бустера до полёта не раскрывается — клиент получает только
        // распределение вероятностей по уровням.
        assertThat(round.has("boostLevel")).isFalse();
        assertThat(round.get("boostLevelChances")).hasSize(9);

        // Первый уровень (1.20) достигается за ln(1.2) / 1.0 ≈ 0.19 с.
        Thread.sleep(700);

        JsonNode state = readJson(get("/api/rounds/" + roundId + "/state"), token);
        assertThat(state.get("boostApplied").asBoolean()).isTrue();
        // ...а после срабатывания — раскрывается.
        assertThat(state.get("boostLevel").asInt()).isEqualTo(1);
        assertThat(state.get("multiplier").asDouble())
                .isCloseTo(state.get("baseMultiplier").asDouble() * 4.0,
                        org.assertj.core.data.Offset.offset(0.05));

        JsonNode cashout = readJson(post("/api/rounds/" + roundId + "/cashout"), token);
        double multiplier = cashout.get("multiplier").asDouble();
        long payout = cashout.get("payout").asLong();
        long bet = round.get("betAmount").asLong();

        assertThat(multiplier).isGreaterThan(4.0);
        assertThat(payout).isEqualTo(Math.round(bet * multiplier));
        assertThat(cashout.get("message").asText()).isEqualTo("Могли бы забрать больше");

        // До краха экран результата недоступен: шар ещё летит.
        mockMvc.perform(authorized(get("/api/rounds/" + roundId + "/result"), token))
                .andExpect(result -> assertThat(result.getResponse().getStatus()).isEqualTo(202));

        JsonNode result = waitForRoundToFinish(token, roundId);
        assertThat(result.get("won").asBoolean()).isTrue();
        assertThat(result.get("status").asText()).isEqualTo("WON");
        // Выплата после краха не пересматривается.
        assertThat(result.get("payout").asLong()).isEqualTo(payout);
        assertThat(result.get("cashoutMultiplier").asDouble()).isEqualTo(multiplier);
        assertThat(result.get("boostApplied").asBoolean()).isTrue();
        assertThat(result.get("crashMultiplier").asDouble()).isGreaterThanOrEqualTo(5.0);
        assertThat(result.get("potentialMaxMultiplier").asDouble()).isGreaterThan(multiplier);

        JsonNode points = result.get("points");
        assertThat(points.get("total").asInt()).isPositive();
        assertThat(points.get("fromLevels").asInt()).isPositive();
        assertThat(points.get("fromCashout").asInt()).isPositive();
        assertThat(points.get("fromBoost").asInt()).isPositive();

        assertThat(result.get("reward").get("enabled").asBoolean()).isTrue();
        assertThat(result.get("reward").get("fragmentIndex").asInt()).isBetween(1, 6);
    }

    // ------------------------------------------------------------ сценарий 3

    @Test
    @DisplayName("Сценарий 3: без нажатия «Забрать» ставка теряется, но очки и награда начисляются")
    void scenarioThreeCrashLosesBetButGrantsProgress() throws Exception {
        String token = login("judge", "judge");

        JsonNode round = startRound(token, "red", 1);
        long roundId = round.get("roundId").asLong();
        long bet = round.get("betAmount").asLong();

        JsonNode result = waitForRoundToFinish(token, roundId);

        assertThat(result.get("won").asBoolean()).isFalse();
        assertThat(result.get("status").asText()).isEqualTo("LOST");
        assertThat(result.get("payout").asLong()).isZero();
        assertThat(result.get("netResult").asLong()).isEqualTo(-bet);
        assertThat(result.get("cashoutMultiplier").isNull()).isTrue();
        assertThat(result.get("points").get("total").asInt()).isPositive();
        assertThat(result.get("reward").get("fragmentIndex").asInt()).isPositive();
    }

    // ------------------------------------------------------------ сценарий 5

    @Test
    @DisplayName("Сценарий 5: очки за уровень меняются через API конфигурации без правки кода")
    void scenarioFiveChangesPointsPerLineWithoutCodeChanges() throws Exception {
        String token = login("expert", "expert");

        JsonNode config = readJson(get("/api/admin/config"), token);
        int originalPerLine = config.get("themes").get("green").get("points").get("perLine").asInt();
        int updatedPerLine = originalPerLine + 137;

        Map<String, Object> mutated = json.convertValue(config, LinkedHashMap.class);
        pointsOf(mutated).put("perLine", updatedPerLine);

        readJson(put("/api/admin/config")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(mutated)), token);

        // Изменение видно и в API, и в файле на диске.
        JsonNode reloaded = readJson(get("/api/admin/config"), token);
        assertThat(reloaded.get("themes").get("green").get("points").get("perLine").asInt())
                .isEqualTo(updatedPerLine);
        assertThat(Files.readString(configPath, StandardCharsets.UTF_8))
                .contains("perLine: " + updatedPerLine);

        JsonNode status = readJson(get("/api/admin/config/status"), token);
        assertThat(status.get("valid").asBoolean()).isTrue();

        // Новый раунд начисляет уже новое количество очков за уровень.
        JsonNode round = startRound(token, "green", 1);
        JsonNode result = waitForRoundToFinish(token, round.get("roundId").asLong());
        int levelsPassed = result.get("levelsPassed").asInt();
        assertThat(levelsPassed).isPositive();
        assertThat(result.get("points").get("fromLevels").asInt())
                .isEqualTo(levelsPassed * updatedPerLine);
    }

    @Test
    @DisplayName("Некорректная конфигурация отклоняется, а игра продолжает работать на предыдущей")
    void invalidConfigIsRejected() throws Exception {
        String token = login("expert", "expert");

        JsonNode config = readJson(get("/api/admin/config"), token);
        Map<String, Object> mutated = json.convertValue(config, LinkedHashMap.class);
        // Зелёная тема обязана иметь 9 уровней.
        themeOf(mutated).put("levelMultipliers", List.of(1.2, 1.5));

        mockMvc.perform(authorized(put("/api/admin/config")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(json.writeValueAsString(mutated)), token))
                .andExpect(result -> assertThat(result.getResponse().getStatus()).isEqualTo(422));

        JsonNode intact = readJson(get("/api/admin/config"), token);
        assertThat(intact.get("themes").get("green").get("levelMultipliers")).hasSize(9);
    }

    // --------------------------------------------------------- проверяемость

    @Test
    @DisplayName("Исход раунда воспроизводится по раскрытому зерну")
    void fairnessVerificationReproducesOutcome() throws Exception {
        String token = login("demo", "demo");
        long roundId = startRound(token, "green", 3).get("roundId").asLong();
        JsonNode result = waitForRoundToFinish(token, roundId);

        JsonNode fairness = result.get("fairness");
        assertThat(fairness.get("serverSeed").asText()).hasSize(64);

        JsonNode verification = readJson(get("/api/fairness/verify?roundId=" + roundId), token);
        assertThat(verification.get("matches").asBoolean()).isTrue();
        assertThat(verification.get("expectedCrashMultiplier").asDouble())
                .isEqualTo(verification.get("storedCrashMultiplier").asDouble());
        assertThat(verification.get("expectedBoostLevel").asInt())
                .isEqualTo(verification.get("storedBoostLevel").asInt());
    }

    @Test
    @DisplayName("Monte-Carlo симулятор воспроизводим при фиксированном seed")
    void simulatorIsReproducibleWithSeed() throws Exception {
        String token = login("expert", "expert");
        String body = """
                {"theme":"green","strategy":"TARGET_MULTIPLIER","rounds":20000,"targetMultiplier":2.0,"seed":2026}
                """;

        JsonNode first = readJson(post("/api/admin/simulate")
                .contentType(MediaType.APPLICATION_JSON).content(body), token);
        JsonNode second = readJson(post("/api/admin/simulate")
                .contentType(MediaType.APPLICATION_JSON).content(body), token);

        assertThat(first.toString()).isEqualTo(second.toString());

        // Тестовая конфигурация детерминирована: minCrashMultiplier = 5.0, поэтому
        // выход на 2.0x успешен всегда. Симулятор обязан это показать — так
        // проверяется, что он действительно считает по текущей конфигурации, а не
        // по зашитым значениям. Сходимость RTP к теории на боевых параметрах
        // проверяется отдельно в RtpSimulatorTest.
        JsonNode baseOption = first.get("options").get(0);
        assertThat(baseOption.get("boostTier").asInt()).isEqualTo(1);
        assertThat(baseOption.get("winRate").asDouble()).isEqualTo(1.0);
        assertThat(baseOption.get("empiricalRtp").asDouble()).isEqualTo(2.0);
    }

    @Test
    @DisplayName("Без токена игровые методы недоступны")
    void apiRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/game/setup"))
                .andExpect(result -> assertThat(result.getResponse().getStatus()).isEqualTo(401));
    }

    // ------------------------------------------------------------ инструменты

    private String login(String nickname, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nickname\":\"" + nickname + "\",\"password\":\"" + password + "\"}"))
                .andReturn();
        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        return json.readTree(body(result)).get("token").asText();
    }

    private JsonNode startRound(String token, String theme, int betOptionId) throws Exception {
        return readJson(post("/api/rounds")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"theme\":\"" + theme + "\",\"betOptionId\":" + betOptionId + "}"), token);
    }

    private JsonNode startRoundWithAmount(String token, String theme, long betAmount) throws Exception {
        return readJson(post("/api/rounds")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"theme\":\"" + theme + "\",\"betAmount\":" + betAmount + "}"), token);
    }

    /** Ждёт крах шара и возвращает экран результата. */
    private JsonNode waitForRoundToFinish(String token, long roundId) throws Exception {
        long deadline = System.currentTimeMillis() + 30_000;
        while (System.currentTimeMillis() < deadline) {
            MvcResult result = mockMvc.perform(
                    authorized(get("/api/rounds/" + roundId + "/result"), token)).andReturn();
            if (result.getResponse().getStatus() == 200) {
                return json.readTree(body(result));
            }
            Thread.sleep(150);
        }
        throw new AssertionError("Раунд " + roundId + " не завершился за отведённое время");
    }

    private JsonNode readJson(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request,
                              String token) throws Exception {
        MvcResult result = mockMvc.perform(authorized(request, token)).andReturn();
        assertThat(result.getResponse().getStatus())
                .as("ответ %s", body(result))
                .isEqualTo(200);
        return json.readTree(body(result));
    }

    private static org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder authorized(
            org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request, String token) {
        return request.header("Authorization", "Bearer " + token);
    }

    private static String body(MvcResult result) throws Exception {
        result.getResponse().setCharacterEncoding(StandardCharsets.UTF_8.name());
        return result.getResponse().getContentAsString(StandardCharsets.UTF_8);
    }

    private static int levelCountOf(JsonNode themes, String key) {
        for (JsonNode theme : themes) {
            if (key.equals(theme.get("key").asText())) {
                return theme.get("levelCount").asInt();
            }
        }
        throw new AssertionError("Тема " + key + " отсутствует в setup");
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> themeOf(Map<String, Object> config) {
        Map<String, Object> themes = (Map<String, Object>) config.get("themes");
        return (Map<String, Object>) themes.get("green");
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> pointsOf(Map<String, Object> config) {
        return (Map<String, Object>) themeOf(config).get("points");
    }
}
