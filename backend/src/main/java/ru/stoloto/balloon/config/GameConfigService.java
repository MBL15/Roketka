package ru.stoloto.balloon.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.core.io.ClassPathResource;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.List;

/**
 * Загрузка, валидация, горячая перезагрузка и сохранение игровой конфигурации.
 *
 * <p>Реализована стратегия «последняя рабочая конфигурация»: если файл на диске
 * сломан или не проходит валидацию, в памяти остаётся предыдущая корректная
 * версия, а причина отказа доступна через {@link #status()}. Это исключает
 * ситуацию, когда опечатка в YAML останавливает игру.
 *
 * <p>Отслеживание изменений сделано опросом mtime/размера раз в секунду, а не
 * через WatchService: опрос одинаково надёжно работает на bind-монтированных
 * томах Docker, где события файловой системы часто не доходят до контейнера.
 */
@Service
public class GameConfigService {

    private static final Logger log = LoggerFactory.getLogger(GameConfigService.class);
    private static final String DEFAULT_RESOURCE = "default-game-config.yaml";

    private final ObjectMapper yaml = new ObjectMapper(new YAMLFactory())
            .findAndRegisterModules();

    private final BalloonProperties properties;
    private final GameConfigValidator validator;
    private final GameConfigYamlWriter writer;
    private final ApplicationEventPublisher events;

    private final Path configPath;

    private volatile GameConfig current;
    private volatile Instant loadedAt;
    private volatile List<String> lastErrors = List.of();
    private volatile String lastErrorAt;
    private volatile long reloadCount;

    private long observedModified;
    private long observedSize = -1;

    public GameConfigService(BalloonProperties properties,
                             GameConfigValidator validator,
                             GameConfigYamlWriter writer,
                             ApplicationEventPublisher events) {
        this.properties = properties;
        this.validator = validator;
        this.writer = writer;
        this.events = events;
        this.configPath = Paths.get(properties.configPath()).toAbsolutePath().normalize();
    }

    @PostConstruct
    void init() {
        log.info("Игровая конфигурация: {}", configPath);
        if (!Files.exists(configPath)) {
            log.warn("Файл конфигурации не найден, создаётся из значений по умолчанию");
            try {
                Files.createDirectories(configPath.getParent());
                Files.writeString(configPath, defaultYaml(), StandardCharsets.UTF_8);
            } catch (IOException e) {
                throw new IllegalStateException("Не удалось создать файл конфигурации: " + configPath, e);
            }
        }
        GameConfig loaded = readAndValidate();
        if (loaded == null) {
            throw new IllegalStateException(
                    "Стартовая конфигурация некорректна, запуск невозможен: " + String.join("; ", lastErrors));
        }
        apply(loaded, "startup");
        rememberFileStamp();
    }

    // ------------------------------------------------------------ публичное API

    public GameConfig current() {
        return current;
    }

    public Path configPath() {
        return configPath;
    }

    /** Текущее состояние конфигурации для админки и мониторинга. */
    public ConfigStatus status() {
        return new ConfigStatus(
                configPath.toString(),
                properties.configWritable(),
                loadedAt,
                reloadCount,
                lastErrors.isEmpty(),
                lastErrors,
                lastErrorAt
        );
    }

    /** Черновая проверка конфигурации без сохранения (кнопка «Проверить» в админке). */
    public List<String> dryRun(GameConfig candidate) {
        return validator.validate(candidate);
    }

    /**
     * Сохранение конфигурации из административной панели.
     *
     * @throws ConfigRejectedException если значения не проходят валидацию — файл при этом не меняется
     */
    public GameConfig save(GameConfig candidate, String source) {
        List<String> errors = validator.validate(candidate);
        if (!errors.isEmpty()) {
            throw new ConfigRejectedException(errors);
        }
        if (!properties.configWritable()) {
            throw new ConfigRejectedException(List.of("Запись конфигурации запрещена настройкой balloon.config-writable"));
        }
        try {
            Files.writeString(configPath, writer.write(candidate), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new ConfigRejectedException(List.of("Не удалось записать файл: " + e.getMessage()));
        }
        apply(candidate, source);
        rememberFileStamp();
        return candidate;
    }

    /** Возврат к заводским значениям. */
    public GameConfig resetToDefaults() {
        try {
            GameConfig defaults = yaml.readValue(defaultYaml(), GameConfig.class);
            return save(defaults, "reset");
        } catch (IOException e) {
            throw new ConfigRejectedException(List.of("Не удалось прочитать значения по умолчанию: " + e.getMessage()));
        }
    }

    // -------------------------------------------------------- горячая перезагрузка

    @Scheduled(fixedDelay = 1000L)
    void pollForChanges() {
        try {
            if (!Files.exists(configPath)) {
                return;
            }
            long modified = Files.getLastModifiedTime(configPath).toMillis();
            long size = Files.size(configPath);
            if (modified == observedModified && size == observedSize) {
                return;
            }
            observedModified = modified;
            observedSize = size;

            GameConfig loaded = readAndValidate();
            if (loaded != null) {
                apply(loaded, "file");
                log.info("Конфигурация перезагружена с диска (применение №{})", reloadCount);
            } else {
                log.error("Изменения в {} отклонены, работает предыдущая версия: {}",
                        configPath.getFileName(), lastErrors);
            }
        } catch (IOException e) {
            log.warn("Не удалось проверить файл конфигурации: {}", e.getMessage());
        }
    }

    /** Читает файл и валидирует. Возвращает null, если конфигурацию применять нельзя. */
    private GameConfig readAndValidate() {
        GameConfig candidate;
        try {
            candidate = yaml.readValue(Files.readString(configPath, StandardCharsets.UTF_8), GameConfig.class);
        } catch (Exception e) {
            recordErrors(List.of("YAML не разобран: " + rootMessage(e)));
            return null;
        }
        List<String> errors = validator.validate(candidate);
        if (!errors.isEmpty()) {
            recordErrors(errors);
            return null;
        }
        return candidate;
    }

    private void apply(GameConfig config, String source) {
        this.current = config;
        this.loadedAt = Instant.now();
        this.lastErrors = List.of();
        this.reloadCount++;
        events.publishEvent(new GameConfigUpdatedEvent(config, source, reloadCount));
    }

    private void recordErrors(List<String> errors) {
        this.lastErrors = List.copyOf(errors);
        this.lastErrorAt = Instant.now().toString();
    }

    private void rememberFileStamp() {
        try {
            observedModified = Files.getLastModifiedTime(configPath).toMillis();
            observedSize = Files.size(configPath);
        } catch (IOException e) {
            observedSize = -1;
        }
    }

    private String defaultYaml() {
        try (InputStream in = new ClassPathResource(DEFAULT_RESOURCE).getInputStream()) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("В сборке отсутствует " + DEFAULT_RESOURCE, e);
        }
    }

    private static String rootMessage(Throwable e) {
        Throwable cause = e;
        while (cause.getCause() != null && cause.getCause() != cause) {
            cause = cause.getCause();
        }
        String message = cause.getMessage();
        return message == null ? cause.getClass().getSimpleName() : message.lines().findFirst().orElse(message);
    }

    // ----------------------------------------------------------------- типы

    public record ConfigStatus(
            String path,
            boolean writable,
            Instant loadedAt,
            long appliedRevisions,
            boolean valid,
            List<String> errors,
            String lastErrorAt
    ) {
    }

    /** Конфигурация отклонена валидацией: предыдущая версия продолжает работать. */
    public static class ConfigRejectedException extends RuntimeException {
        private final List<String> errors;

        public ConfigRejectedException(List<String> errors) {
            super("Конфигурация отклонена: " + String.join("; ", errors));
            this.errors = List.copyOf(errors);
        }

        public List<String> errors() {
            return errors;
        }
    }
}
