package ru.stoloto.balloon.config;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Сериализация конфигурации обратно в YAML с сохранением пояснений.
 *
 * <p>Обычный YAML-сериализатор выбросил бы комментарии, и после первого
 * сохранения из административной панели файл перестал бы быть понятным для
 * ручной правки. Поэтому файл собирается явно: значения берутся из объекта,
 * а комментарии восстанавливаются по фиксированному шаблону. В результате
 * конфигурация остаётся самодокументированной независимо от того, кто её
 * последним менял — человек в редакторе или админка.
 */
@Component
public class GameConfigYamlWriter {

    /**
     * Колонка, с которой начинаются пояснения к значениям. Значения, которые
     * сами по себе длиннее (списки вроде {@code boostBonusPerTier}), выходят за
     * неё — для них пояснение отделяется одним пробелом.
     */
    static final int COMMENT_COLUMN = 34;

    public String write(GameConfig config) {
        StringBuilder out = new StringBuilder(8192);
        header(out);
        out.append("version: ").append(config.version()).append("\n\n");

        out.append("""
                # -----------------------------------------------------------------------------
                #  ТЕМЫ (ВЕРСИИ) ИГРЫ
                #  Ровно два ключа: green (9 уровней, спокойный риск-профиль) и red
                #  (12 уровней, высокий риск). Количество уровней задаётся длиной списка
                #  levelMultipliers и проверяется валидатором: green -> 9, red -> 12.
                # -----------------------------------------------------------------------------
                themes:
                """);

        Map<String, GameConfig.ThemeConfig> themes = config.orderedThemes();
        themes.forEach((key, theme) -> theme(out, key, theme));

        reward(out, config.reward());
        upsell(out, config.upsell());
        tournament(out, config.tournament());
        session(out, config.session());
        return out.toString();
    }

    private void header(StringBuilder out) {
        out.append("""
                # =============================================================================
                #  «ВОЗДУШНЫЙ ШАР» — единый файл игровой конфигурации
                # =============================================================================
                #  Единственный источник правды для игровой экономики. Этот же файл читает и
                #  записывает административная панель, поэтому ручная правка и правка через UI
                #  полностью равнозначны.
                #
                #  ГОРЯЧАЯ ПЕРЕЗАГРУЗКА
                #  Backend опрашивает файл раз в секунду. После сохранения:
                #    * конфигурация корректна   -> применяется к каждому НОВОМУ раунду;
                #    * конфигурация некорректна -> остаётся предыдущая рабочая версия, текст
                #      ошибки виден в GET /api/admin/config/status и в админке.
                #  Летящие раунды доигрываются на снимке параметров, сделанном при их старте:
                #  настройка не может изменить исход уже начатого раунда.
                #
                #  ПРОВЕРКА ВЛИЯНИЯ НАСТРОЕК
                #  Математику нельзя проверять по одному случайному раунду. Используйте
                #  Monte-Carlo симулятор: админка -> «Симулятор RTP» или POST /api/admin/simulate.
                #
                #  Описание параметров: docs/CONFIGURATION.md
                #  Вывод формул:        docs/MATH_MODEL.md
                # =============================================================================

                """);
    }

    private void theme(StringBuilder out, String key, GameConfig.ThemeConfig theme) {
        out.append("\n  # ===========================================================================\n");
        out.append("  #  ").append(theme.gameName().toUpperCase(Locale.ROOT))
                .append(" — ").append(theme.levelCount()).append(" уровней\n");
        out.append("  # ===========================================================================\n");
        out.append("  ").append(key).append(":\n");

        out.append("    # --- Базовые параметры (game_id, game_name, game_type, is_active) ------\n");
        line(out, "    ", "gameId", theme.gameId(), null);
        line(out, "    ", "gameName", quote(theme.gameName()), null);
        line(out, "    ", "gameType", theme.gameType(), null);
        line(out, "    ", "active", String.valueOf(theme.active()),
                "false -> тема недоступна для новых раундов");

        GameConfig.MathConfig math = theme.math();
        out.append("""

                    # --- Параметры математической модели ----------------------------------
                    # Точка краха: P(crash >= m) = (1 - houseEdge) * m^(-alpha), m >= 1.
                    # При alpha = 1.0 RTP стратегии «забрать на коэффициенте m» не зависит
                    # от m и равен (1 - houseEdge).
                    math:
                """);
        line(out, "      ", "alpha", num(math.alpha()),
                "0.5..3.0   больше -> шар лопается раньше");
        line(out, "      ", "houseEdge", num(math.houseEdge()),
                "0..0.30    доля мгновенных крахов; RTP = 1 - houseEdge");
        line(out, "      ", "minCrashMultiplier", num(math.minCrashMultiplier()),
                ">= 1.0     минимально возможная точка краха");
        line(out, "      ", "maxMultiplier", num(math.maxMultiplier()),
                "> min      потолок коэффициента");
        line(out, "      ", "multiplierGrowthRate", num(math.multiplierGrowthRate()),
                "> 0        темп роста: m(t) = exp(rate * t), t в секундах");
        line(out, "      ", "fps", String.valueOf(math.fps()),
                "5..60      частота серверных тиков");
        line(out, "      ", "delta", num(math.delta()),
                "> 0        шаг округления коэффициента");
        line(out, "      ", "maxFlightSeconds", String.valueOf(math.maxFlightSeconds()),
                "предохранитель против «вечного» раунда");

        out.append("""

                    # --- Границы уровней --------------------------------------------------
                    # Уровень N пройден, когда базовый коэффициент достиг levelMultipliers[N-1].
                    # Список должен строго возрастать; первый элемент > 1.0.
                """);
        out.append("    levelMultipliers: ").append(doubles(theme.levelMultipliers())).append('\n');

        out.append("""

                    # --- Положение бустера (line_1_loot_prob … line_N_loot_prob) ----------
                    # Вес уровня в лотерее «где будет ждать бустер». Нормируется
                    # автоматически, поэтому сумма не обязана равняться 1. Длина списка
                    # должна совпадать с числом уровней.
                    #
                    # Конкретный уровень раунда игроку НЕ раскрывается до срабатывания
                    # бустера: зная его заранее, игрок выбирал бы момент выхода так, что
                    # RTP превышал бы единицу (разбор — в docs/MATH_MODEL.md). Клиент
                    # получает только это распределение и подсвечивает им лестницу уровней.
                """);
        out.append("    lootProbabilities: ").append(doubles(theme.lootProbabilities())).append('\n');

        out.append("""

                    # --- Значения множителей бустеров (multiplier_tier_N_value) -----------
                    # Индекс = tier - 1. Tier 1 всегда 1.0 (вариант «без усиления»).
                """);
        out.append("    boostTierValues: ").append(doubles(theme.boostTierValues())).append('\n');

        out.append("""

                    # --- Четыре варианта ставки (фрагменты пазла на экране выбора) --------
                    # cost       — стоимость в бонусных баллах;
                    # boostTier  — ссылка на boostTierValues;
                    # alphaShift — надбавка к alpha именно для этого варианта.
                    #
                    # Зачем alphaShift: бустер умножает выплату, то есть сам по себе
                    # повышает RTP в B раз. Чтобы усиленные варианты не были «бесплатными
                    # деньгами», шар с грузом бустера физически хрупче — распределение
                    # точки краха у него агрессивнее.
                    #
                    # Как подбирать значения: перебором стратегий «долететь до уровня k и
                    # забрать» для каждого k. Максимум RTP по k должен попадать в коридор
                    # 0.92..0.94 — тогда ни один вариант ставки не выгоднее остальных и ни
                    # одна стратегия не обыгрывает заведение. Проверяется тестом
                    # RtpSimulatorTest.noThresholdStrategyBeatsTheHouse и симулятором в
                    # админке (POST /api/admin/simulate).
                    #
                    # ВАЖНО: при изменении alpha, houseEdge, levelMultipliers или
                    # lootProbabilities эти значения нужно пересчитать симулятором.
                    betOptions:
                """);
        for (GameConfig.BetOptionConfig option : theme.betOptions()) {
            out.append("      - id: ").append(option.id()).append('\n');
            line(out, "        ", "cost", String.valueOf(option.cost()), null);
            line(out, "        ", "boostTier", String.valueOf(option.boostTier()),
                    "множитель x" + num(theme.boostValue(option.boostTier())));
            line(out, "        ", "alphaShift", num(option.alphaShift()),
                    "итоговая alpha = " + num(math.alpha() + option.alphaShift()));
        }

        GameConfig.PointsConfig points = theme.points();
        out.append("""

                    # --- Начисление игровых очков -----------------------------------------
                    # Игровые очки — отдельная валюта: идут в турнир и не конвертируются
                    # в бонусные баллы. Начисляются и при выигрыше, и при проигрыше.
                    points:
                """);
        line(out, "      ", "perLine", String.valueOf(points.perLine()),
                "points_per_line      — за каждый пройденный уровень");
        line(out, "      ", "cashoutBonus", String.valueOf(points.cashoutBonus()),
                "points_cashout_bonus — разово за успешный cashout");
        line(out, "      ", "boostBonusPerTier", ints(points.boostBonusPerTier()),
                "points_xN_bonus — за активацию бустера tier N");
    }

    private void reward(StringBuilder out, GameConfig.RewardConfig reward) {
        out.append("""

                # -----------------------------------------------------------------------------
                #  ДОПОЛНИТЕЛЬНАЯ ИГРОВАЯ НАГРАДА — коллекция фрагментов
                #  Каждый завершённый раунд (и выигрыш, и проигрыш) даёт один фрагмент.
                #  Собранная коллекция закрывается, выдаёт награду и открывает следующую.
                #  Дубликат автоматически обменивается на игровые очки, поэтому награда
                #  никогда не бывает пустой.
                # -----------------------------------------------------------------------------
                reward:
                """);
        line(out, "  ", "enabled", String.valueOf(reward.enabled()), null);
        line(out, "  ", "collectionName", quote(reward.collectionName()), null);
        line(out, "  ", "collectionSize", String.valueOf(reward.collectionSize()),
                "фрагментов в одной коллекции");
        line(out, "  ", "guaranteedNewChanceOnWin", num(reward.guaranteedNewChanceOnWin()),
                "шанс нового фрагмента после выигрыша");
        line(out, "  ", "guaranteedNewChanceOnLoss", num(reward.guaranteedNewChanceOnLoss()),
                "то же после проигрыша");
        line(out, "  ", "duplicateCompensationPoints", String.valueOf(reward.duplicateCompensationPoints()),
                "игровые очки за дубликат");
        line(out, "  ", "completionBonusPoints", String.valueOf(reward.completionBonusPoints()),
                "игровые очки за собранную коллекцию");
        line(out, "  ", "completionBonusBalance", String.valueOf(reward.completionBonusBalance()),
                "бонусные баллы за собранную коллекцию");
    }

    private void upsell(StringBuilder out, GameConfig.UpsellConfig upsell) {
        out.append("""

                # -----------------------------------------------------------------------------
                #  АПСЕЙЛ «ЗАКРЕПИ УСПЕХ» — лотерейные билеты за бонусные баллы
                #  Не более одного показа за игровую сессию и только после успешного cashout.
                #  tickets = clamp(round(win * winShare / ticketPriceBonus), 1, maxTickets),
                #  затем предложение урезается по фактическому балансу игрока.
                # -----------------------------------------------------------------------------
                upsell:
                """);
        line(out, "  ", "enabled", String.valueOf(upsell.enabled()), null);
        line(out, "  ", "minWinAmount", String.valueOf(upsell.minWinAmount()),
                "MIN_WIN_AMOUNT — порог показа");
        line(out, "  ", "popupTimeoutSeconds", String.valueOf(upsell.popupTimeoutSeconds()),
                "POPUP_TIMEOUT — автозакрытие без реакции");
        line(out, "  ", "ticketPriceBonus", String.valueOf(upsell.ticketPriceBonus()),
                "цена одного билета в бонусных баллах");
        line(out, "  ", "maxTickets", String.valueOf(upsell.maxTickets()), null);
        line(out, "  ", "winShare", num(upsell.winShare()),
                "какая доля выигрыша конвертируется в билеты");
    }

    private void tournament(StringBuilder out, GameConfig.TournamentConfig tournament) {
        out.append("""

                # -----------------------------------------------------------------------------
                #  ТУРНИР И ЖИВОЙ РЕЙТИНГ
                # -----------------------------------------------------------------------------
                tournament:
                """);
        line(out, "  ", "enabled", String.valueOf(tournament.enabled()), null);
        line(out, "  ", "name", quote(tournament.name()), null);
        line(out, "  ", "durationDays", String.valueOf(tournament.durationDays()), null);
        line(out, "  ", "liveRatingSize", String.valueOf(tournament.liveRatingSize()),
                "элементов в строке рейтинга над игрой");
        line(out, "  ", "anonymizeNames", String.valueOf(tournament.anonymizeNames()),
                "маскировать первые 3 символа чужих имён");
        GameConfig.SimulationConfig simulation = tournament.simulation();
        out.append("  simulation:\n");
        line(out, "    ", "enabled", String.valueOf(simulation.enabled()),
                "живые соперники-боты");
        line(out, "    ", "botCount", String.valueOf(simulation.botCount()), null);
        line(out, "    ", "tickSeconds", String.valueOf(simulation.tickSeconds()), null);
        line(out, "    ", "maxPointsPerTick", String.valueOf(simulation.maxPointsPerTick()), null);
    }

    private void session(StringBuilder out, GameConfig.SessionConfig session) {
        out.append("""

                # -----------------------------------------------------------------------------
                #  СЕССИЯ И ИНТЕРФЕЙС
                # -----------------------------------------------------------------------------
                session:
                """);
        line(out, "  ", "resultIdleTimeoutSeconds", String.valueOf(session.resultIdleTimeoutSeconds()),
                "бездействие на экране результата -> возврат");
        line(out, "  ", "onboardingHintSeconds", String.valueOf(session.onboardingHintSeconds()),
                "длительность подсказки «Нажми Забрать»");
        line(out, "  ", "historySize", String.valueOf(session.historySize()),
                "длина общей истории завершённых раундов");
        line(out, "  ", "demoBonusBalance", String.valueOf(session.demoBonusBalance()),
                "стартовый баланс демо-аккаунтов");
    }

    // --------------------------------------------------------------- helpers

    /**
     * Строка «ключ: значение» с пояснением, выровненным по общей колонке.
     *
     * <p>Без выравнивания колонка комментариев съезжает, как только значение
     * меняет длину (60.0 против 250.0), и сгенерированный файл выглядит
     * небрежнее написанного руками. Файл читают люди — выравнивание не
     * косметика, а часть его пригодности к ручной правке.
     */
    private static void line(StringBuilder out, String indent, String key,
                             String value, String comment) {
        String text = indent + key + ": " + value;
        out.append(text);
        if (comment != null && !comment.isEmpty()) {
            out.append(" ".repeat(Math.max(1, COMMENT_COLUMN - text.length())))
                    .append("# ").append(comment);
        }
        out.append('\n');
    }

    private static String doubles(List<Double> values) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < values.size(); i++) {
            if (i > 0) {
                sb.append(", ");
            }
            sb.append(num(values.get(i)));
        }
        return sb.append(']').toString();
    }

    private static String ints(List<Integer> values) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < values.size(); i++) {
            if (i > 0) {
                sb.append(", ");
            }
            sb.append(values.get(i));
        }
        return sb.append(']').toString();
    }

    /** Компактная запись числа: целые без дробной части, остальные без хвостовых нулей. */
    private static String num(double value) {
        if (value == Math.rint(value) && Math.abs(value) < 1e9) {
            return String.format(Locale.ROOT, "%.1f", value);
        }
        String text = String.format(Locale.ROOT, "%.6f", value);
        text = text.replaceAll("0+$", "");
        return text.endsWith(".") ? text + '0' : text;
    }

    private static String quote(String value) {
        return value == null ? "''" : "\"" + value.replace("\"", "\\\"") + "\"";
    }
}
