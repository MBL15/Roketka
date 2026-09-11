package ru.stoloto.balloon.ws;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import ru.stoloto.balloon.config.GameConfigUpdatedEvent;
import ru.stoloto.balloon.domain.UserAccount;
import ru.stoloto.balloon.game.event.GameEvents;
import ru.stoloto.balloon.service.AuthService;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Передача состояния игры в реальном времени.
 *
 * <h2>Почему WebSocket, а не опрос</h2>
 * Коэффициент растёт непрерывно, а события уровней и бустера должны доходить
 * без задержки. Постоянное соединение даёт это дешевле опроса. Полный
 * резервный канал на REST при этом сохранён: {@code GET /api/rounds/{id}/state}
 * и {@code GET /api/tournament/live} отдают те же данные, поэтому интерфейс
 * работает и там, где сокеты недоступны.
 *
 * <h2>Почему отправка не блокирует игровой цикл</h2>
 * Слушатели событий вызываются из потока игрового цикла, поэтому они только
 * складывают сообщение в очередь клиента и сразу возвращают управление.
 * Фактическая запись в сокет идёт в отдельном пуле. Тики при этом
 * «склеиваются»: если клиент не успевает читать, он получит последнее
 * состояние, а не отставшую очередь из сотни кадров. События уровней,
 * бустера, cashout и краха складываются в надёжную очередь и не теряются.
 */
@Component
public class GameSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(GameSocketHandler.class);

    private final AuthService authService;
    private final ObjectMapper json;

    private final Map<String, Client> clients = new ConcurrentHashMap<>();
    private final ExecutorService outbound = Executors.newFixedThreadPool(4, runnable -> {
        Thread thread = new Thread(runnable, "balloon-ws-out");
        thread.setDaemon(true);
        return thread;
    });

    public GameSocketHandler(AuthService authService, ObjectMapper json) {
        this.authService = authService;
        this.json = json;
    }

    @PreDestroy
    void shutdown() {
        outbound.shutdown();
    }

    // ------------------------------------------------------------ соединение

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws IOException {
        String token = tokenOf(session);
        UserAccount user = authService.resolve(token).orElse(null);
        if (user == null) {
            session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Недействительный токен сессии"));
            return;
        }
        Client client = new Client(session, user.getId());
        clients.put(session.getId(), client);
        send(client, message("connected", Map.of(
                "userId", user.getId(),
                "nickname", user.getNickname(),
                "serverTimeMillis", System.currentTimeMillis())), false);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        clients.remove(session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        Client client = clients.get(session.getId());
        if (client == null) {
            return;
        }
        // Единственное, что клиент присылает, — проверка живости соединения.
        // Никаких игровых команд через сокет: ставка и cashout идут только
        // через REST, где есть транзакции и авторитетная проверка.
        send(client, message("pong", Map.of("serverTimeMillis", System.currentTimeMillis())), false);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        log.debug("Ошибка транспорта WebSocket: {}", exception.getMessage());
        clients.remove(session.getId());
    }

    // -------------------------------------------------------- игровые события

    @EventListener
    public void onTick(GameEvents.RoundTick event) {
        sendToUser(event.userId(), message("round.tick", Map.of(
                "roundId", event.roundId(),
                "multiplier", event.snapshot().multiplier(),
                "baseMultiplier", event.snapshot().baseMultiplier(),
                "levelsPassed", event.snapshot().levelsPassed(),
                "boostApplied", event.snapshot().boostApplied(),
                "points", event.snapshot().points(),
                "elapsedSeconds", event.snapshot().elapsedSeconds(),
                "livePoints", event.livePoints(),
                "serverTimeMillis", System.currentTimeMillis())), true);
    }

    @EventListener
    public void onLevel(GameEvents.LevelCrossed event) {
        sendToUser(event.userId(), message("round.level", Map.of(
                "roundId", event.roundId(),
                "level", event.level(),
                "levelCount", event.levelCount(),
                "pointsAwarded", event.pointsAwarded(),
                "totalPoints", event.totalPoints(),
                "livePoints", event.livePoints())), false);
    }

    @EventListener
    public void onBoost(GameEvents.BoostActivated event) {
        sendToUser(event.userId(), message("round.boost", Map.of(
                "roundId", event.roundId(),
                "level", event.level(),
                "boostValue", event.boostValue(),
                "multiplier", event.multiplier(),
                "pointsAwarded", event.pointsAwarded(),
                "totalPoints", event.totalPoints(),
                "livePoints", event.livePoints())), false);
    }

    @EventListener
    public void onCashout(GameEvents.CashoutAccepted event) {
        sendToUser(event.userId(), message("round.cashout", Map.of(
                "roundId", event.roundId(),
                "multiplier", event.multiplier(),
                "payout", event.payout(),
                "balance", event.balance(),
                "totalPoints", event.totalPoints())), false);
    }

    @EventListener
    public void onCrash(GameEvents.RoundCrashed event) {
        sendToUser(event.userId(), message("round.crash", Map.of(
                "roundId", event.roundId(),
                "crashMultiplier", event.crashMultiplier(),
                "won", event.won())), false);
    }

    @EventListener
    public void onSettled(GameEvents.RoundSettled event) {
        sendToUser(event.userId(), message("round.settled", Map.of(
                "roundId", event.roundId())), false);
    }

    @EventListener
    public void onHistory(GameEvents.HistoryUpdated event) {
        broadcast(message("history.updated", Map.of("roundId", event.roundId())), false);
    }

    @EventListener
    public void onRating(GameEvents.RatingUpdated event) {
        List<Map<String, Object>> entries = event.entries().stream()
                .map(entry -> Map.<String, Object>of(
                        "userId", entry.userId(),
                        "displayName", entry.displayName(),
                        "points", entry.points(),
                        "position", entry.position(),
                        "bot", entry.bot()))
                .toList();
        broadcast(message("rating.updated", Map.of("entries", entries)), true);
    }

    @EventListener
    public void onConfigUpdated(GameConfigUpdatedEvent event) {
        broadcast(message("config.updated", Map.of(
                "revision", event.revision(),
                "source", event.source())), false);
    }

    // ------------------------------------------------------------- отправка

    private void sendToUser(long userId, String payload, boolean coalesce) {
        for (Client client : clients.values()) {
            if (client.userId == userId) {
                send(client, payload, coalesce);
            }
        }
    }

    private void broadcast(String payload, boolean coalesce) {
        for (Client client : clients.values()) {
            send(client, payload, coalesce);
        }
    }

    /**
     * @param coalesce для потоковых сообщений: новое состояние заменяет
     *                 неотправленное предыдущее вместо накопления очереди
     */
    private void send(Client client, String payload, boolean coalesce) {
        if (coalesce) {
            client.pending.set(payload);
        } else {
            client.queue.offer(payload);
        }
        if (client.flushing.compareAndSet(false, true)) {
            outbound.execute(() -> flush(client));
        }
    }

    private void flush(Client client) {
        try {
            String payload;
            while ((payload = client.queue.poll()) != null) {
                write(client, payload);
            }
            String tick = client.pending.getAndSet(null);
            if (tick != null) {
                write(client, tick);
            }
        } finally {
            client.flushing.set(false);
            // Пока мы отправляли, могли прийти новые сообщения — дозабираем их.
            if ((!client.queue.isEmpty() || client.pending.get() != null)
                    && client.flushing.compareAndSet(false, true)) {
                outbound.execute(() -> flush(client));
            }
        }
    }

    private void write(Client client, String payload) {
        if (!client.session.isOpen()) {
            clients.remove(client.session.getId());
            return;
        }
        try {
            synchronized (client.session) {
                client.session.sendMessage(new TextMessage(payload));
            }
        } catch (Exception e) {
            log.debug("Клиент отключился во время отправки: {}", e.getMessage());
            clients.remove(client.session.getId());
        }
    }

    private String message(String type, Map<String, ?> body) {
        Map<String, Object> envelope = new LinkedHashMap<>();
        envelope.put("type", type);
        envelope.putAll(body);
        try {
            return json.writeValueAsString(envelope);
        } catch (Exception e) {
            throw new IllegalStateException("Не удалось сериализовать сообщение " + type, e);
        }
    }

    private static String tokenOf(WebSocketSession session) {
        String query = session.getUri() == null ? null : session.getUri().getQuery();
        if (query == null) {
            return null;
        }
        for (String pair : query.split("&")) {
            int separator = pair.indexOf('=');
            if (separator > 0 && "token".equals(pair.substring(0, separator))) {
                return java.net.URLDecoder.decode(pair.substring(separator + 1),
                        java.nio.charset.StandardCharsets.UTF_8);
            }
        }
        return null;
    }

    public int connectionCount() {
        return clients.size();
    }

    private static final class Client {
        private final WebSocketSession session;
        private final long userId;
        private final ConcurrentLinkedQueue<String> queue = new ConcurrentLinkedQueue<>();
        private final AtomicReference<String> pending = new AtomicReference<>();
        private final AtomicBoolean flushing = new AtomicBoolean();

        private Client(WebSocketSession session, long userId) {
            this.session = session;
            this.userId = userId;
        }
    }
}
