package ru.stoloto.balloon.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import ru.stoloto.balloon.service.RoundService;
import ru.stoloto.balloon.service.SetupService;
import ru.stoloto.balloon.web.dto.GameDtos;

import java.util.List;

@RestController
@RequestMapping("/api/game")
@Tag(name = "2. Игра", description = "Публичные параметры игры и история завершённых раундов")
public class GameController {

    private final SetupService setupService;
    private final RoundService roundService;

    public GameController(SetupService setupService, RoundService roundService) {
        this.setupService = setupService;
        this.roundService = roundService;
    }

    @GetMapping("/setup")
    @Operation(summary = "Параметры игры для интерфейса",
            description = """
                    Темы с количеством уровней и их границами, четыре варианта ставки с ценой и
                    множителем бустера, правила начисления очков, состояние коллекции награды и
                    заголовок турнира. Параметры распределения точки краха сюда не входят.
                    """)
    public GameDtos.GameSetupDto setup(AuthContext context) {
        return setupService.setupFor(context.user());
    }

    @GetMapping("/history")
    @Operation(summary = "История завершённых раундов всех игроков",
            description = "Обязательный элемент экрана выбора ставки: результаты и достигнутые коэффициенты")
    public List<GameDtos.HistoryEntryDto> history(AuthContext context,
                                                  @RequestParam(defaultValue = "0") int limit) {
        return roundService.sharedHistory(context.userId(), limit);
    }

    @GetMapping("/history/my")
    @Operation(summary = "История раундов текущего игрока")
    public List<GameDtos.HistoryEntryDto> myHistory(AuthContext context,
                                                    @RequestParam(defaultValue = "0") int limit) {
        return roundService.personalHistory(context.user(), limit);
    }
}
