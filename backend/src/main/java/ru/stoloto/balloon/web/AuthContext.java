package ru.stoloto.balloon.web;

import ru.stoloto.balloon.domain.UserAccount;

/**
 * Аутентифицированный вызов: токен сессии и игрок.
 *
 * <p>Контроллеры принимают этот тип аргументом, поэтому ни один обработчик не
 * разбирает заголовки самостоятельно и не может случайно взять идентификатор
 * игрока из тела запроса.
 */
public record AuthContext(String token, UserAccount user) {

    public long userId() {
        return user.getId();
    }
}
