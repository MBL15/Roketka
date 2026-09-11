package ru.stoloto.balloon.web;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.MethodParameter;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;
import ru.stoloto.balloon.domain.UserAccount;
import ru.stoloto.balloon.service.AuthService;

/**
 * Подстановка {@link AuthContext} в аргументы контроллеров.
 * Токен читается из {@code Authorization: Bearer ...} либо из
 * {@code X-Session-Token} — второй вариант удобен при проверке через Swagger UI.
 */
@Component
public class AuthContextResolver implements HandlerMethodArgumentResolver {

    public static final String HEADER_AUTHORIZATION = "Authorization";
    public static final String HEADER_SESSION_TOKEN = "X-Session-Token";
    private static final String BEARER_PREFIX = "Bearer ";

    private final AuthService authService;

    public AuthContextResolver(AuthService authService) {
        this.authService = authService;
    }

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return AuthContext.class.equals(parameter.getParameterType());
    }

    @Override
    public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer container,
                                  NativeWebRequest webRequest, WebDataBinderFactory binderFactory) {
        HttpServletRequest request = webRequest.getNativeRequest(HttpServletRequest.class);
        String token = extractToken(request);
        UserAccount user = authService.resolve(token)
                .orElseThrow(() -> new UnauthorizedException("Требуется вход в игру"));
        return new AuthContext(token, user);
    }

    public static String extractToken(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        String header = request.getHeader(HEADER_AUTHORIZATION);
        if (header != null && header.startsWith(BEARER_PREFIX)) {
            return header.substring(BEARER_PREFIX.length()).trim();
        }
        String direct = request.getHeader(HEADER_SESSION_TOKEN);
        if (direct != null && !direct.isBlank()) {
            return direct.trim();
        }
        return request.getParameter("token");
    }

    public static class UnauthorizedException extends RuntimeException {
        public UnauthorizedException(String message) {
            super(message);
        }
    }
}
