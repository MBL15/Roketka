package ru.stoloto.balloon.service;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Каталог достижений прототипа.
 *
 * <p>Определения зафиксированы в коде: их немного, они не меняются на лету и
 * должны быть одинаковы для всех окружений. Условия проверяются в
 * {@link AchievementService}.
 */
public final class AchievementCatalog {

    private AchievementCatalog() {
    }

    public record Definition(
            String id,
            String title,
            String description,
            String icon,
            String category
    ) {
    }

    public static final Definition FIRST_WIN = def(
            "first_win", "Первый забор",
            "Успешно зафиксируйте выигрыш до краха шара", "🎈", "flight");
    public static final Definition MULTIPLIER_X2 = def(
            "multiplier_x2", "Минимум ×2",
            "Заберите выигрыш с коэффициентом от 2×", "✌", "flight");
    public static final Definition MULTIPLIER_X5 = def(
            "multiplier_x5", "Высота ×5",
            "Заберите выигрыш с коэффициентом от 5×", "🚀", "flight");
    public static final Definition GREEN_X2_10 = def(
            "green_x2_10", "Зелёный пилот",
            "10 выигрышей с коэффициентом от 2× на зелёном шаре", "🟢", "flight");
    public static final Definition RED_X2_5 = def(
            "red_x2_5", "Красный пилот",
            "5 выигрышей с коэффициентом от 2× на красном шаре", "🔴", "flight");
    public static final Definition BOOST_FIRST = def(
            "boost_first", "Усиление!",
            "Активируйте бустер и заберите выигрыш", "⚡", "flight");
    public static final Definition BOOST_MAX = def(
            "boost_max", "На максимуме",
            "Выиграйте с вариантом ставки ×4 и сработавшим бустером", "💥", "flight");
    public static final Definition FRAGMENT_FIRST = def(
            "fragment_first", "Коллекционер",
            "Получите первый фрагмент коллекции", "🧩", "collection");
    public static final Definition COLLECTION_DONE = def(
            "collection_done", "Карта собрана",
            "Соберите полную коллекцию награды", "🗺", "collection");
    public static final Definition ROUNDS_10 = def(
            "rounds_10", "Десяточка",
            "Сыграйте 10 завершённых раундов", "🔟", "milestone");
    public static final Definition ROUNDS_50 = def(
            "rounds_50", "Небесный профи",
            "Сыграйте 50 завершённых раундов", "☁", "milestone");
    public static final Definition LEVEL_5 = def(
            "level_5", "Пятый этаж",
            "Достигните 5 уровня игрока", "⬆", "progression");
    public static final Definition LEVEL_10 = def(
            "level_10", "Ас неба",
            "Достигните 10 уровня игрока", "👑", "progression");
    public static final Definition PERFECT_FLIGHT = def(
            "perfect_flight", "До верха",
            "Пройдите все уровни темы и заберите выигрыш", "🏔", "flight");
    public static final Definition NEAR_MISS = def(
            "near_miss", "Почти!",
            "Проиграйте раунд, пройдя не менее 5 уровней", "😮", "flight");
    public static final Definition BIG_WIN = def(
            "big_win", "Крупный улов",
            "Зафиксируйте чистую прибыль от 500 бонусных баллов", "💰", "flight");

    public static final List<Definition> ALL = List.of(
            FIRST_WIN, MULTIPLIER_X2, MULTIPLIER_X5,
            GREEN_X2_10, RED_X2_5,
            BOOST_FIRST, BOOST_MAX,
            FRAGMENT_FIRST, COLLECTION_DONE,
            ROUNDS_10, ROUNDS_50,
            LEVEL_5, LEVEL_10,
            PERFECT_FLIGHT, NEAR_MISS, BIG_WIN
    );

    private static final Map<String, Definition> BY_ID = ALL.stream()
            .collect(Collectors.toMap(Definition::id, Function.identity(), (a, b) -> a, () -> new java.util.LinkedHashMap<>()));

    public static Optional<Definition> find(String id) {
        return Optional.ofNullable(BY_ID.get(id));
    }

    public static Definition require(String id) {
        return find(id).orElseThrow(() -> new IllegalArgumentException("Неизвестное достижение: " + id));
    }

    private static Definition def(String id, String title, String description, String icon, String category) {
        return new Definition(id, title, description, icon, category);
    }
}
