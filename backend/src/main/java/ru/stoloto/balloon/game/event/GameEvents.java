package ru.stoloto.balloon.game.event;

import ru.stoloto.balloon.game.ActiveRound;

import java.util.List;

/**
 * События игрового цикла.
 *
 * <p>Игровой движок ничего не знает о транспорте: он публикует эти события
 * через {@code ApplicationEventPublisher}, а слушатели решают, куда их
 * отправить. Сейчас слушатель один — WebSocket-рассылка, но добавить, скажем,
 * журнал событий или внешнюю аналитику можно не трогая движок.
 *
 * <p>Слушатели обязаны возвращать управление немедленно: они вызываются из
 * потока игрового цикла, который должен успевать за частотой тиков.
 */
public final class GameEvents {

    private GameEvents() {
    }

    /** Регулярное состояние полёта. Допустимо терять промежуточные тики. */
    public record RoundTick(long roundId, long userId, ActiveRound.Snapshot snapshot, long livePoints) {
    }

    /** Пересечён уровень: «+X» очков. */
    public record LevelCrossed(long roundId, long userId, int level, int levelCount,
                               int pointsAwarded, int totalPoints, long livePoints) {
    }

    /** Сработал бустер: коэффициент скачком умножен. */
    public record BoostActivated(long roundId, long userId, int level, double boostValue,
                                 double multiplier, int pointsAwarded, int totalPoints, long livePoints) {
    }

    /**
     * Игрок зафиксировал выигрыш; шар продолжает лететь.
     *
     * <p>Потенциального максимума здесь намеренно нет: он равен точке краха,
     * и раскрыть его до самого краха означало бы выдать клиенту исход раунда.
     */
    public record CashoutAccepted(long roundId, long userId, double multiplier, long payout,
                                  long balance, int totalPoints) {
    }

    /** Шар лопнул: раунд стал терминальным. */
    public record RoundCrashed(long roundId, long userId, double crashMultiplier, boolean won) {
    }

    /** Раунд полностью рассчитан: можно запрашивать экран результата. */
    public record RoundSettled(long roundId, long userId) {
    }

    /** Общая история завершённых раундов обновилась. */
    public record HistoryUpdated(long roundId) {
    }

    /** Живой рейтинг турнира: отсортированный срез очков участников. */
    public record RatingUpdated(List<RatingEntry> entries) {
    }

    public record RatingEntry(long userId, String displayName, long points, int position, boolean bot) {
    }

    /** Применена новая игровая конфигурация. */
    public record ConfigApplied(long revision, String source) {
    }

    /** Игрок разблокировал достижение. */
    public record AchievementUnlocked(long userId, String achievementId, String title,
                                      String description, String icon) {
    }
}
