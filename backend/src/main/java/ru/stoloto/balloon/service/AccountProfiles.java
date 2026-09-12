package ru.stoloto.balloon.service;

import ru.stoloto.balloon.domain.UserAccount;

/**
 * Три служебных профиля прототипа: {@code demo}, {@code judge}, {@code expert}.
 * Остальные зарегистрированные игроки — {@code player}.
 */
public final class AccountProfiles {

    public static final long JUDGE_STARTING_BALANCE = 500;

    public enum Kind {
        DEMO, JUDGE, ADMIN, PLAYER
    }

    private AccountProfiles() {
    }

    public static Kind kindOf(UserAccount user) {
        return kindOf(user.getNickname());
    }

    public static Kind kindOf(String nickname) {
        if (nickname == null) {
            return Kind.PLAYER;
        }
        return switch (nickname.trim().toLowerCase()) {
            case "demo" -> Kind.DEMO;
            case "judge" -> Kind.JUDGE;
            case "expert" -> Kind.ADMIN;
            default -> Kind.PLAYER;
        };
    }

    public static String kindCode(Kind kind) {
        return switch (kind) {
            case DEMO -> "demo";
            case JUDGE -> "judge";
            case ADMIN -> "admin";
            case PLAYER -> "player";
        };
    }

    /** Автопополнение при старте сервера (BootstrapService). */
    public static boolean autoRefillOnBootstrap(Kind kind) {
        return kind == Kind.DEMO || kind == Kind.ADMIN;
    }

    /** Кнопка «+2000» и POST /api/auth/top-up. */
    public static boolean manualTopUpAllowed(Kind kind) {
        return kind != Kind.JUDGE;
    }

    public static long startingBonus(Kind kind, long demoBalance) {
        return kind == Kind.JUDGE ? JUDGE_STARTING_BALANCE : demoBalance;
    }
}
