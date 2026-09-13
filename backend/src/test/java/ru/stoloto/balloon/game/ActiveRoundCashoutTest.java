package ru.stoloto.balloon.game;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import ru.stoloto.balloon.domain.GameRound;
import ru.stoloto.balloon.domain.RoundParameters;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ActiveRoundCashoutTest {

    private static final double DELTA = 0.01;
    private static final double GROWTH = 1.0;

    @Test
    @DisplayName("Автозабор 1.20x через targetSteps=120, даже если база уже 1.21")
    void autoCashoutUsesExactLevelMultiplier() throws Exception {
        long startedAt = Instant.now().toEpochMilli() - 500;
        GameRound round = new GameRound(
                1L, "demo", "green", 1, 50L,
                1, 1.0, null,
                50.0, 50.0,
                "seed", "hash", "client", 1L,
                new RoundParameters(
                        1.0, 0.04, 1.0, 100.0,
                        GROWTH, DELTA, 20, 120,
                        List.of(1.2, 1.35, 1.5), List.of(1.0),
                        10, 5, 0),
                Instant.ofEpochMilli(startedAt));
        setRoundId(round, 43L);

        ActiveRound active = new ActiveRound(round);
        long now = startedAt + (long) (CrashMath.secondsToReach(1.21, GROWTH) * 1000) + 50;

        ActiveRound.CashoutOutcome outcome = active.cashout(now, null, 120);

        assertThat(outcome.accepted()).isTrue();
        assertThat(outcome.multiplier()).isEqualTo(1.2);
        assertThat(outcome.payout()).isEqualTo(Math.round(50L * 1.2));
    }

    @Test
    @DisplayName("Автозабор с targetSteps фиксирует целевой коэффициент, а не текущий")
    void autoCashoutUsesTargetMultiplierWhenAlreadyPassed() throws Exception {
        long startedAt = Instant.now().toEpochMilli() - 500;
        GameRound round = new GameRound(
                1L, "demo", "green", 1, 100L,
                1, 1.0, null,
                50.0, 50.0,
                "seed", "hash", "client", 1L,
                new RoundParameters(
                        1.0, 0.04, 1.0, 100.0,
                        GROWTH, DELTA, 20, 120,
                        List.of(1.2, 1.35, 1.5), List.of(1.0),
                        10, 5, 0),
                Instant.ofEpochMilli(startedAt));
        setRoundId(round, 42L);

        ActiveRound active = new ActiveRound(round);
        long now = startedAt + (long) (CrashMath.secondsToReach(1.38, GROWTH) * 1000) + 200;

        ActiveRound.CashoutOutcome outcome = active.cashout(now, null, 135);

        assertThat(outcome.accepted()).isTrue();
        assertThat(outcome.multiplier()).isEqualTo(1.35);
        assertThat(outcome.payout()).isEqualTo(Math.round(100L * 1.35));
    }

    private static void setRoundId(GameRound round, long id) throws Exception {
        var field = GameRound.class.getDeclaredField("id");
        field.setAccessible(true);
        field.set(round, id);
    }
}
