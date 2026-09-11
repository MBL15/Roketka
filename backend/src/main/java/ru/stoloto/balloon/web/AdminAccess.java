package ru.stoloto.balloon.web;

/**
 * Доступ к админ-панели ограничен аккаунтом {@code expert}: демо- и judge-профили
 * играют, но не могут менять конфигурацию и запускать симуляции.
 */
public final class AdminAccess {

    private AdminAccess() {
    }

    public static void requireExpert(AuthContext context) {
        if (!"expert".equalsIgnoreCase(context.user().getNickname())) {
            throw new AccessDeniedException("Админ-панель доступна только аккаунту expert");
        }
    }

    public static class AccessDeniedException extends RuntimeException {
        public AccessDeniedException(String message) {
            super(message);
        }
    }
}
