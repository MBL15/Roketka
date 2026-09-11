package ru.stoloto.balloon.game;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import ru.stoloto.balloon.config.BalloonProperties;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class FairnessServiceTest {

    private final FairnessService fairness = new FairnessService(properties(null));

    private static BalloonProperties properties(String devSeed) {
        return new BalloonProperties("config.yaml", false, false, devSeed, List.of(), List.of());
    }

    @Test
    @DisplayName("Одно и то же зерно всегда даёт один и тот же исход")
    void uniformIsDeterministic() {
        String serverSeed = fairness.newServerSeed();
        double first = fairness.uniform(serverSeed, "client", 7, FairnessService.NAMESPACE_CRASH);
        double second = fairness.uniform(serverSeed, "client", 7, FairnessService.NAMESPACE_CRASH);
        assertThat(first).isEqualTo(second);
    }

    @Test
    @DisplayName("Точка краха и положение бустера независимы: разные пространства имён")
    void namespacesProduceIndependentValues() {
        String serverSeed = fairness.newServerSeed();
        double crash = fairness.uniform(serverSeed, "client", 1, FairnessService.NAMESPACE_CRASH);
        double loot = fairness.uniform(serverSeed, "client", 1, FairnessService.NAMESPACE_LOOT);
        assertThat(crash).isNotEqualTo(loot);
    }

    @Test
    @DisplayName("Смена nonce меняет исход при том же зерне")
    void nonceChangesOutcome() {
        String serverSeed = fairness.newServerSeed();
        assertThat(fairness.uniform(serverSeed, "c", 1, FairnessService.NAMESPACE_CRASH))
                .isNotEqualTo(fairness.uniform(serverSeed, "c", 2, FairnessService.NAMESPACE_CRASH));
    }

    @Test
    @DisplayName("Клиентское зерно влияет на исход: раунд нельзя подобрать под игрока")
    void clientSeedAffectsOutcome() {
        String serverSeed = fairness.newServerSeed();
        assertThat(fairness.uniform(serverSeed, "alice", 1, FairnessService.NAMESPACE_CRASH))
                .isNotEqualTo(fairness.uniform(serverSeed, "bob", 1, FairnessService.NAMESPACE_CRASH));
    }

    @Test
    @DisplayName("Равномерная величина лежит в [0;1) и распределена ровно")
    void uniformIsWellDistributed() {
        int rounds = 100_000;
        int[] buckets = new int[10];
        for (int i = 0; i < rounds; i++) {
            double value = fairness.uniform(fairness.newServerSeed(), "client", i,
                    FairnessService.NAMESPACE_CRASH);
            assertThat(value).isGreaterThanOrEqualTo(0.0).isLessThan(1.0);
            buckets[(int) (value * 10)]++;
        }
        for (int count : buckets) {
            assertThat((double) count / rounds).isCloseTo(0.1, org.assertj.core.data.Offset.offset(0.01));
        }
    }

    @Test
    @DisplayName("Хеш обязательства воспроизводим и не совпадает с зерном")
    void commitmentHashIsStable() {
        String serverSeed = fairness.newServerSeed();
        String hash = fairness.sha256(serverSeed);
        assertThat(hash).hasSize(64).isNotEqualTo(serverSeed);
        assertThat(fairness.sha256(serverSeed)).isEqualTo(hash);
    }

    @Test
    @DisplayName("Каждое серверное зерно уникально")
    void serverSeedsAreUnique() {
        java.util.Set<String> seeds = new java.util.HashSet<>();
        for (int i = 0; i < 5_000; i++) {
            seeds.add(fairness.newServerSeed());
        }
        assertThat(seeds).hasSize(5_000);
    }

    @Test
    @DisplayName("По умолчанию режим фиксированного зерна выключен")
    void devSeedIsDisabledByDefault() {
        assertThat(fairness.isDevSeedEnabled()).isFalse();
    }

    @Test
    @DisplayName("balloon.dev-seed делает последовательность раундов воспроизводимой")
    void devSeedMakesSequenceReproducible() {
        List<String> first = seedSequence(new FairnessService(properties("чемпионат-2026")));
        List<String> second = seedSequence(new FairnessService(properties("чемпионат-2026")));
        List<String> other = seedSequence(new FairnessService(properties("другое-зерно")));

        assertThat(first).isEqualTo(second);
        assertThat(first).isNotEqualTo(other);
        // Внутри одной серии зёрна всё равно различаются — повторяется серия, а не раунд.
        assertThat(first).doesNotHaveDuplicates();
    }

    private static List<String> seedSequence(FairnessService service) {
        assertThat(service.isDevSeedEnabled()).isTrue();
        return java.util.stream.IntStream.range(0, 20)
                .mapToObj(i -> service.newServerSeed())
                .toList();
    }
}
