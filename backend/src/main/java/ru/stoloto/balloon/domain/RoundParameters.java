package ru.stoloto.balloon.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Снимок параметров, с которыми был создан раунд.
 *
 * <p>Раунд хранит копию значимых настроек, а не ссылку на текущую
 * конфигурацию. Это даёт два свойства, важных и для честности, и для
 * проверяемости: правка конфигурации не может изменить исход уже летящего
 * раунда, а по записи в БД всегда можно пересчитать раунд «как тогда».
 */
@Embeddable
public class RoundParameters {

    /** Итоговая alpha раунда: math.alpha темы + alphaShift выбранного варианта ставки. */
    @Column(name = "param_alpha", nullable = false)
    private double alpha;

    @Column(name = "param_house_edge", nullable = false)
    private double houseEdge;

    @Column(name = "param_min_crash", nullable = false)
    private double minCrashMultiplier;

    @Column(name = "param_max_multiplier", nullable = false)
    private double maxMultiplier;

    @Column(name = "param_growth_rate", nullable = false)
    private double growthRate;

    @Column(name = "param_delta", nullable = false)
    private double delta;

    @Column(name = "param_fps", nullable = false)
    private int fps;

    @Column(name = "param_max_flight_seconds", nullable = false)
    private int maxFlightSeconds;

    /** Границы уровней, сохранённые строкой «1.2,1.5,1.9,…» для читаемости в БД. */
    @Column(name = "param_levels", nullable = false, length = 1024)
    private String levels;

    /**
     * Веса лотереи положения бустера на момент старта.
     * Хранятся вместе с раундом, иначе проверка честности не смогла бы
     * воспроизвести выбранный уровень после правки конфигурации.
     */
    @Column(name = "param_loot_weights", nullable = false, length = 1024)
    private String lootWeights;

    @Column(name = "param_points_per_line", nullable = false)
    private int pointsPerLine;

    @Column(name = "param_points_cashout", nullable = false)
    private int pointsCashoutBonus;

    @Column(name = "param_points_boost", nullable = false)
    private int pointsBoostBonus;

    protected RoundParameters() {
    }

    public RoundParameters(double alpha, double houseEdge, double minCrashMultiplier, double maxMultiplier,
                           double growthRate, double delta, int fps, int maxFlightSeconds,
                           List<Double> levelMultipliers, List<Double> lootProbabilities,
                           int pointsPerLine, int pointsCashoutBonus, int pointsBoostBonus) {
        this.alpha = alpha;
        this.houseEdge = houseEdge;
        this.minCrashMultiplier = minCrashMultiplier;
        this.maxMultiplier = maxMultiplier;
        this.growthRate = growthRate;
        this.delta = delta;
        this.fps = fps;
        this.maxFlightSeconds = maxFlightSeconds;
        this.levels = join(levelMultipliers);
        this.lootWeights = join(lootProbabilities);
        this.pointsPerLine = pointsPerLine;
        this.pointsCashoutBonus = pointsCashoutBonus;
        this.pointsBoostBonus = pointsBoostBonus;
    }

    public List<Double> levelMultipliers() {
        return split(levels);
    }

    public List<Double> lootProbabilities() {
        return split(lootWeights);
    }

    public int levelCount() {
        return levelMultipliers().size();
    }

    private static List<Double> split(String packed) {
        List<Double> values = new ArrayList<>();
        if (packed == null) {
            return values;
        }
        for (String part : packed.split(",")) {
            if (!part.isBlank()) {
                values.add(Double.parseDouble(part.trim()));
            }
        }
        return values;
    }

    public double alpha() {
        return alpha;
    }

    public double houseEdge() {
        return houseEdge;
    }

    public double minCrashMultiplier() {
        return minCrashMultiplier;
    }

    public double maxMultiplier() {
        return maxMultiplier;
    }

    public double growthRate() {
        return growthRate;
    }

    public double delta() {
        return delta;
    }

    public int fps() {
        return fps;
    }

    public int maxFlightSeconds() {
        return maxFlightSeconds;
    }

    public int pointsPerLine() {
        return pointsPerLine;
    }

    public int pointsCashoutBonus() {
        return pointsCashoutBonus;
    }

    public int pointsBoostBonus() {
        return pointsBoostBonus;
    }

    private static String join(List<Double> values) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < values.size(); i++) {
            if (i > 0) {
                sb.append(',');
            }
            sb.append(String.format(Locale.ROOT, "%.4f", values.get(i)));
        }
        return sb.toString();
    }
}
