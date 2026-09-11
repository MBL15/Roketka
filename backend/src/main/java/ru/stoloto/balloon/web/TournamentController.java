package ru.stoloto.balloon.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.stoloto.balloon.config.GameConfigService;
import ru.stoloto.balloon.game.event.GameEvents;
import ru.stoloto.balloon.service.TournamentService;
import ru.stoloto.balloon.web.dto.GameDtos;

import java.util.List;

@RestController
@RequestMapping("/api/tournament")
@Tag(name = "4. Турнир", description = "Живой рейтинг и турнирная таблица (дополнительная возможность)")
public class TournamentController {

    private final TournamentService tournamentService;
    private final GameConfigService configService;

    public TournamentController(TournamentService tournamentService, GameConfigService configService) {
        this.tournamentService = tournamentService;
        this.configService = configService;
    }

    @GetMapping("/live")
    @Operation(summary = "Строка живого рейтинга",
            description = """
                    Срез очков участников для строки над игровым экраном. Те же данные приходят
                    по WebSocket; этот метод — резервный канал с опросом раз в секунду.
                    """)
    public List<GameDtos.RatingEntryDto> live(AuthContext context) {
        return tournamentService.liveRating(context.userId()).stream()
                .map(entry -> toDto(entry, context.userId()))
                .toList();
    }

    @GetMapping
    @Operation(summary = "Турнирная таблица",
            description = """
                    Топ-3 закреплены отдельным списком, остальные участники — прокручиваемым.
                    Текущий игрок возвращается отдельным полем, чтобы интерфейс мог закрепить его
                    внизу, если он не попал в видимую часть. Имена чужих участников маскируются,
                    если включён параметр tournament.anonymizeNames.
                    """)
    public GameDtos.TournamentTableDto table(AuthContext context) {
        TournamentService.TournamentInfo info = tournamentService.info();
        List<GameEvents.RatingEntry> full = tournamentService.fullRating(context.userId());

        List<GameDtos.RatingEntryDto> all = full.stream()
                .map(entry -> toDto(entry, context.userId()))
                .toList();
        List<GameDtos.RatingEntryDto> top = all.subList(0, Math.min(3, all.size()));
        List<GameDtos.RatingEntryDto> rest = all.size() > 3 ? all.subList(3, all.size()) : List.of();
        GameDtos.RatingEntryDto current = all.stream()
                .filter(GameDtos.RatingEntryDto::current)
                .findFirst()
                .orElse(null);

        return new GameDtos.TournamentTableDto(
                new GameDtos.TournamentHeaderDto(
                        configService.current().tournament().enabled(), info.active(), info.name(),
                        info.endsAt(), info.secondsLeft(), info.participants()),
                List.copyOf(top), List.copyOf(rest), current);
    }

    private GameDtos.RatingEntryDto toDto(GameEvents.RatingEntry entry, long currentUserId) {
        return new GameDtos.RatingEntryDto(entry.userId(), entry.displayName(), entry.points(),
                entry.position(), entry.bot(), entry.userId() == currentUserId);
    }
}
