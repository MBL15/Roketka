package ru.stoloto.balloon.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

/**
 * Настройки самого приложения (не игровой экономики).
 * Игровая экономика живёт в {@link GameConfig} и читается из YAML-файла на лету.
 *
 * @param devSeed режим разработки: если задано, серверные зёрна выводятся
 *                детерминированно из этой строки, и последовательность раундов
 *                воспроизводится от запуска к запуску. В пустом значении
 *                (поведение по умолчанию) используется {@code SecureRandom}
 */
@ConfigurationProperties(prefix = "balloon")
public record BalloonProperties(
        String configPath,
        boolean configWritable,
        boolean simulationEnabled,
        String devSeed,
        List<String> demoUsers,
        List<String> corsOrigins
) {

    public boolean devSeedEnabled() {
        return devSeed != null && !devSeed.isBlank();
    }
}
