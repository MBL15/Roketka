package ru.stoloto.balloon.game;

import java.util.List;

/**
 * Математическая модель игры. Чистые функции без состояния и без обращений
 * к БД — за счёт этого модель покрывается тестами и прогоняется симулятором
 * миллионы раз без побочных эффектов.
 *
 * <h2>Распределение точки краха</h2>
 * Функция выживания задана степенным законом:
 * <pre>
 *   P(crash &gt;= m) = (1 - houseEdge) * m^(-alpha),   m &gt;= 1
 * </pre>
 * То есть с вероятностью {@code houseEdge} шар лопается мгновенно (на
 * минимальном коэффициенте), а в остальных случаях точка краха имеет
 * распределение Парето с показателем {@code alpha}.
 *
 * <p>Отсюда RTP стратегии «забрать ровно на коэффициенте m»:
 * <pre>
 *   RTP(m) = m * P(crash &gt;= m) = (1 - houseEdge) * m^(1 - alpha)
 * </pre>
 * При {@code alpha = 1} множитель {@code m^0 = 1}, поэтому RTP не зависит от
 * выбранного момента выхода и равен {@code 1 - houseEdge}. Это делает модель
 * честной: не существует «правильного» коэффициента, на котором выгоднее
 * забирать, и игрок выбирает только желаемую волатильность.
 *
 * <h2>Компенсация бустера</h2>
 * Бустер умножает выплату на B, что само по себе умножило бы RTP на B.
 * Поэтому у усиленных вариантов ставки {@code alpha} увеличена на
 * {@code alphaShift}: шар с грузом бустера объективно хрупче. Подбор
 * {@code alphaShift} проверяется Monte-Carlo симулятором.
 *
 * <h2>Рост коэффициента</h2>
 * <pre>
 *   m(t) = exp(growthRate * t),  t — секунды с начала полёта
 * </pre>
 * Формула аналитически обратима, поэтому сервер знает точное время краха ещё
 * до старта, а клиент рисует те же 60 FPS локально, не опрашивая сервер на
 * каждом кадре.
 */
public final class CrashMath {

    private CrashMath() {
    }

    /**
     * Превращает равномерное {@code u} из [0;1) в точку краха.
     *
     * @param u          равномерная величина, полученная из серверного зерна
     * @param alpha      итоговый показатель распределения (alpha темы + alphaShift варианта)
     * @param houseEdge  вероятность мгновенного краха
     * @param minCrash   минимально возможная точка краха
     * @param maxCrash   потолок коэффициента
     * @param delta      шаг округления (округление всегда вниз, чтобы
     *                   отображаемый коэффициент не мог превысить точку краха)
     */
    public static double sampleCrashPoint(double u, double alpha, double houseEdge,
                                          double minCrash, double maxCrash, double delta) {
        if (u < houseEdge) {
            return quantizeDown(minCrash, delta);
        }
        // Перенормировка остатка в равномерную величину на (0;1].
        double v = (u - houseEdge) / (1.0 - houseEdge);
        v = Math.max(v, 1e-12);

        double crash = Math.pow(v, -1.0 / alpha);
        crash = Math.max(crash, minCrash);
        crash = Math.min(crash, maxCrash);
        return quantizeDown(crash, delta);
    }

    /** Базовый коэффициент через {@code seconds} секунд полёта. */
    public static double multiplierAt(double seconds, double growthRate) {
        if (seconds <= 0) {
            return 1.0;
        }
        return Math.exp(growthRate * seconds);
    }

    /** Момент, в который базовый коэффициент достигает {@code multiplier}. */
    public static double secondsToReach(double multiplier, double growthRate) {
        if (multiplier <= 1.0) {
            return 0.0;
        }
        return Math.log(multiplier) / growthRate;
    }

    /** Теоретическая вероятность дожить до коэффициента {@code m}. */
    public static double survivalProbability(double m, double alpha, double houseEdge) {
        if (m <= 1.0) {
            return 1.0 - houseEdge;
        }
        return (1.0 - houseEdge) * Math.pow(m, -alpha);
    }

    /** Теоретический RTP стратегии «забрать ровно на коэффициенте m», без бустера. */
    public static double theoreticalRtp(double m, double alpha, double houseEdge) {
        return m * survivalProbability(m, alpha, houseEdge);
    }

    /** Медиана точки краха — понятная метрика «типичного» раунда для админки. */
    public static double medianCrashPoint(double alpha, double houseEdge) {
        if (houseEdge >= 0.5) {
            return 1.0;
        }
        // Решение уравнения (1 - edge) * m^(-alpha) = 0.5
        return Math.pow(2.0 * (1.0 - houseEdge), 1.0 / alpha);
    }

    /**
     * Сколько уровней пройдено при базовом коэффициенте {@code multiplier}.
     * Уровень считается пройденным, когда коэффициент достиг его границы.
     */
    public static int levelsPassed(double multiplier, List<Double> levelMultipliers) {
        int passed = 0;
        for (Double threshold : levelMultipliers) {
            if (multiplier + 1e-9 >= threshold) {
                passed++;
            } else {
                break;
            }
        }
        return passed;
    }

    /**
     * Выбор уровня, на котором будет ждать бустер, по весам {@code weights}.
     * Веса нормируются, поэтому конфигурация не обязана давать сумму 1.
     *
     * @return номер уровня от 1 до weights.size()
     */
    public static int pickBoostLevel(double u, List<Double> weights) {
        double total = 0;
        for (Double weight : weights) {
            total += Math.max(0, weight);
        }
        if (total <= 0) {
            return 1;
        }
        double threshold = Math.min(Math.max(u, 0), 0.999999999) * total;
        double cumulative = 0;
        for (int i = 0; i < weights.size(); i++) {
            cumulative += Math.max(0, weights.get(i));
            if (threshold < cumulative) {
                return i + 1;
            }
        }
        return weights.size();
    }

    /** Округление вниз до шага {@code delta}: 2.3749 при delta=0.01 даёт 2.37. */
    public static double quantizeDown(double value, double delta) {
        if (delta <= 0) {
            return value;
        }
        double steps = Math.floor(value / delta + 1e-9);
        return Math.round(steps * delta * 1e6) / 1e6;
    }
}
