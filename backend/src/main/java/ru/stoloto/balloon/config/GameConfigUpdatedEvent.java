package ru.stoloto.balloon.config;

/**
 * Публикуется после успешного применения новой игровой конфигурации.
 * Слушатели: рассылка события клиентам по WebSocket и пересоздание набора
 * симулируемых соперников по турниру.
 *
 * @param source откуда пришло изменение: startup | file | admin | reset
 */
public record GameConfigUpdatedEvent(GameConfig config, String source, long revision) {
}
