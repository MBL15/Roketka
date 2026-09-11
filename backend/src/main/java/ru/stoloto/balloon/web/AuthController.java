package ru.stoloto.balloon.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.stoloto.balloon.domain.AuthSession;
import ru.stoloto.balloon.domain.UserAccount;
import ru.stoloto.balloon.service.AuthService;
import ru.stoloto.balloon.service.SetupService;
import ru.stoloto.balloon.web.dto.GameDtos;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "1. Аккаунт", description = "Вход в игру, регистрация и пополнение демонстрационного баланса")
public class AuthController {

    private final AuthService authService;
    private final SetupService setupService;

    public AuthController(AuthService authService, SetupService setupService) {
        this.authService = authService;
        this.setupService = setupService;
    }

    @PostMapping("/login")
    @Operation(summary = "Вход",
            description = "Демонстрационные аккаунты: demo/demo, expert/expert, judge/judge")
    public GameDtos.AuthResponse login(@RequestBody GameDtos.LoginRequest request) {
        AuthSession session = authService.login(request.nickname(), request.password());
        UserAccount user = authService.resolve(session.getToken()).orElseThrow();
        return new GameDtos.AuthResponse(session.getToken(), setupService.toPlayerDto(user));
    }

    @PostMapping("/register")
    @Operation(summary = "Регистрация",
            description = "Новый игрок получает стартовый баланс из session.demoBonusBalance")
    public GameDtos.AuthResponse register(@RequestBody GameDtos.LoginRequest request) {
        AuthSession session = authService.register(request.nickname(), request.password());
        UserAccount user = authService.resolve(session.getToken()).orElseThrow();
        return new GameDtos.AuthResponse(session.getToken(), setupService.toPlayerDto(user));
    }

    @GetMapping("/me")
    @Operation(summary = "Текущий игрок")
    public GameDtos.PlayerDto me(AuthContext context) {
        return setupService.toPlayerDto(context.user());
    }

    @PostMapping("/logout")
    @Operation(summary = "Выход",
            description = "Завершает игровую сессию: после нового входа апсейл может быть показан снова")
    public void logout(AuthContext context) {
        authService.logout(context.token());
    }

    @PostMapping("/top-up")
    @Operation(summary = "Пополнить демонстрационный баланс",
            description = "Предусмотрено постановкой как сценарий пополнения бонусных баллов для проверки")
    public GameDtos.PlayerDto topUp(AuthContext context, @RequestBody(required = false) GameDtos.TopUpRequest request) {
        long amount = request == null || request.amount() == null ? 2000 : request.amount();
        return setupService.toPlayerDto(authService.topUp(context.user(), amount));
    }
}
