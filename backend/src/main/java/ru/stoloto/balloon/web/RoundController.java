package ru.stoloto.balloon.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.stoloto.balloon.config.GameConfig;
import ru.stoloto.balloon.service.RoundService;
import ru.stoloto.balloon.web.dto.GameDtos;

@RestController
@RequestMapping("/api/rounds")
@Tag(name = "3. Раунд", description = "Ставка, полёт, фиксация выигрыша и результат")
public class RoundController {

    private final RoundService roundService;

    public RoundController(RoundService roundService) {
        this.roundService = roundService;
    }

    @PostMapping
    @Operation(summary = "Начать раунд",
            description = """
                    Проверяет баланс, списывает ставку и до первого кадра анимации определяет
                    точку краха и уровень бустера. В ответе нет ни точки краха, ни потенциального
                    максимума — только хеш серверного зерна как обязательство честности.

                    Поле `clientSeed` необязательно: если его передать, оно войдёт в вывод
                    случайных величин, и игрок сможет доказать, что раунд не был подобран под него.
                    """)
    public GameDtos.StartRoundResponse start(AuthContext context,
                                             @RequestBody GameDtos.StartRoundRequest request) {
        String theme = request.theme() == null ? GameConfig.THEME_GREEN : request.theme();
        if (request.betOptionId() == null && request.betAmount() == null) {
            throw new IllegalArgumentException("Укажите вариант ставки (betOptionId) или сумму (betAmount)");
        }
        return roundService.start(context.user(), theme, request.betOptionId(), request.betAmount(), request.clientSeed());
    }

    @GetMapping("/active")
    @Operation(summary = "Незавершённый раунд игрока",
            description = "Позволяет вернуться в полёт после перезагрузки страницы или обрыва связи")
    public ResponseEntity<GameDtos.RoundStateDto> active(AuthContext context) {
        return roundService.activeRound(context.user())
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/{roundId}/state")
    @Operation(summary = "Авторитетное состояние раунда",
            description = """
                    Тот же снимок состояния, который рассылается по WebSocket. Используется как
                    резервный канал: опрос этого метода раз в секунду полностью заменяет сокет.
                    """)
    public ResponseEntity<GameDtos.RoundStateDto> state(AuthContext context, @PathVariable long roundId) {
        return roundService.state(context.user(), roundId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping("/{roundId}/cashout")
    @Operation(summary = "Забрать выигрыш",
            description = """
                    Коэффициент берётся из серверного времени на момент обработки запроса, а не из
                    тела запроса. Доступно с ×1 и до краха. Шар после
                    фиксации продолжает лететь, но сумма выигрыша больше не меняется.
                    """)
    public GameDtos.CashoutResponse cashout(AuthContext context, @PathVariable long roundId) {
        return roundService.cashout(context.user(), roundId);
    }

    @GetMapping("/{roundId}/result")
    @Operation(summary = "Результат раунда",
            description = """
                    Доступен только после краха шара. Возвращает выигрыш, коэффициент краха,
                    потенциальный максимум, разбивку игровых очков, полученный фрагмент коллекции,
                    предложение апсейла и раскрытое серверное зерно для проверки честности.

                    До краха отвечает кодом 202 и статусом раунда.
                    """)
    public GameDtos.RoundResultDto result(AuthContext context, @PathVariable long roundId) {
        return roundService.result(context.token(), context.user(), roundId);
    }
}
