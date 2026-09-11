package ru.stoloto.balloon.ws;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

/**
 * Точка подключения: {@code ws://<host>/ws/game?token=<токен сессии>}.
 *
 * <p>Использован «сырой» WebSocket без STOMP: сообщений немного, они
 * односторонние (сервер -> клиент), и простой JSON-конверт проще
 * документировать и проверять вручную, чем брокерский протокол.
 */
@Configuration
@EnableWebSocket
public class WebSocketConfiguration implements WebSocketConfigurer {

    private final GameSocketHandler handler;

    public WebSocketConfiguration(GameSocketHandler handler) {
        this.handler = handler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(handler, "/ws/game").setAllowedOriginPatterns("*");
    }
}
