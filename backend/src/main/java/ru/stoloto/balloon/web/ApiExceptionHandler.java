package ru.stoloto.balloon.web;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import ru.stoloto.balloon.config.GameConfigService;
import ru.stoloto.balloon.domain.UserAccount;
import ru.stoloto.balloon.service.AuthService;
import ru.stoloto.balloon.service.RoundService;
import ru.stoloto.balloon.web.dto.GameDtos;

import java.util.List;

/**
 * Единый формат ошибок API.
 *
 * <p>Клиент различает ситуации по коду {@code error}, а не по тексту: так
 * интерфейс может, например, показать именно уведомление «Не хватает бонусов»
 * там, где постановка этого требует.
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(AuthContextResolver.UnauthorizedException.class)
    public ResponseEntity<GameDtos.ApiError> onUnauthorized(AuthContextResolver.UnauthorizedException e) {
        return error(HttpStatus.UNAUTHORIZED, "unauthorized", e.getMessage(), null);
    }

    @ExceptionHandler(AuthService.AuthenticationFailedException.class)
    public ResponseEntity<GameDtos.ApiError> onAuthFailed(AuthService.AuthenticationFailedException e) {
        return error(HttpStatus.UNAUTHORIZED, "authentication_failed", e.getMessage(), null);
    }

    @ExceptionHandler(AdminAccess.AccessDeniedException.class)
    public ResponseEntity<GameDtos.ApiError> onAdminDenied(AdminAccess.AccessDeniedException e) {
        return error(HttpStatus.FORBIDDEN, "forbidden", e.getMessage(), null);
    }

    @ExceptionHandler(UserAccount.InsufficientBalanceException.class)
    public ResponseEntity<GameDtos.ApiError> onInsufficientBalance(UserAccount.InsufficientBalanceException e) {
        return error(HttpStatus.CONFLICT, "insufficient_balance", "Не хватает бонусов",
                List.of(e.getMessage()));
    }

    @ExceptionHandler(RoundService.RoundRejectedException.class)
    public ResponseEntity<GameDtos.ApiError> onRoundRejected(RoundService.RoundRejectedException e) {
        return error(HttpStatus.CONFLICT, "round_rejected", e.getMessage(), null);
    }

    @ExceptionHandler(RoundService.RoundNotFinishedException.class)
    public ResponseEntity<GameDtos.ApiError> onRoundNotFinished(RoundService.RoundNotFinishedException e) {
        return error(HttpStatus.ACCEPTED, "round_in_flight", e.getMessage(),
                List.of("Экран результата открывается только после краха шара"));
    }

    @ExceptionHandler(GameConfigService.ConfigRejectedException.class)
    public ResponseEntity<GameDtos.ApiError> onConfigRejected(GameConfigService.ConfigRejectedException e) {
        return error(HttpStatus.UNPROCESSABLE_ENTITY, "config_rejected",
                "Конфигурация не сохранена: значения не прошли проверку", e.errors());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<GameDtos.ApiError> onIllegalArgument(IllegalArgumentException e) {
        return error(HttpStatus.BAD_REQUEST, "bad_request", e.getMessage(), null);
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<GameDtos.ApiError> onIllegalState(IllegalStateException e) {
        return error(HttpStatus.CONFLICT, "conflict", e.getMessage(), null);
    }

    /**
     * Обращение к несуществующему пути — это 404, а не сбой сервера. Без этого
     * обработчика такие запросы попадали бы в {@link #onUnexpected} и писали в
     * лог трассировку, из-за которой в журнале не видно настоящих ошибок.
     */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<GameDtos.ApiError> onNoResource(NoResourceFoundException e) {
        return error(HttpStatus.NOT_FOUND, "not_found", "Ресурс не найден: " + e.getResourcePath(), null);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<GameDtos.ApiError> onUnexpected(Exception e) {
        log.error("Необработанная ошибка API", e);
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "internal_error",
                "Внутренняя ошибка сервера", List.of(String.valueOf(e.getMessage())));
    }

    private ResponseEntity<GameDtos.ApiError> error(HttpStatus status, String code,
                                                    String message, List<String> details) {
        return ResponseEntity.status(status).body(new GameDtos.ApiError(code, message, details));
    }
}
