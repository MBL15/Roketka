package ru.stoloto.balloon.service;

import org.springframework.stereotype.Component;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Хеширование паролей PBKDF2-HMAC-SHA256 со случайной солью.
 *
 * <p>Пароли прототипа всё равно демонстрационные, но открытым текстом они не
 * хранятся: формат {@code iterations:salt:hash}, соль у каждого пользователя
 * своя, сравнение — в постоянное время. Использован только JDK, чтобы не
 * тянуть в зависимости ещё одну библиотеку ради одной функции.
 */
@Component
public class PasswordHasher {

    private static final String ALGORITHM = "PBKDF2WithHmacSHA256";
    private static final int ITERATIONS = 120_000;
    private static final int KEY_LENGTH_BITS = 256;
    private static final int SALT_BYTES = 16;

    private final SecureRandom random = new SecureRandom();

    public String hash(String rawPassword) {
        byte[] salt = new byte[SALT_BYTES];
        random.nextBytes(salt);
        byte[] key = derive(rawPassword, salt, ITERATIONS);
        return ITERATIONS + ":" + encode(salt) + ":" + encode(key);
    }

    public boolean matches(String rawPassword, String storedHash) {
        if (storedHash == null) {
            return false;
        }
        String[] parts = storedHash.split(":");
        if (parts.length != 3) {
            return false;
        }
        try {
            int iterations = Integer.parseInt(parts[0]);
            byte[] salt = decode(parts[1]);
            byte[] expected = decode(parts[2]);
            byte[] actual = derive(rawPassword, salt, iterations);
            return MessageDigest.isEqual(expected, actual);
        } catch (RuntimeException e) {
            return false;
        }
    }

    private byte[] derive(String rawPassword, byte[] salt, int iterations) {
        try {
            PBEKeySpec spec = new PBEKeySpec(rawPassword.toCharArray(), salt, iterations, KEY_LENGTH_BITS);
            return SecretKeyFactory.getInstance(ALGORITHM).generateSecret(spec).getEncoded();
        } catch (Exception e) {
            throw new IllegalStateException("Не удалось вычислить хеш пароля", e);
        }
    }

    private static String encode(byte[] bytes) {
        return Base64.getEncoder().withoutPadding().encodeToString(bytes);
    }

    private static byte[] decode(String value) {
        return Base64.getDecoder().decode(value);
    }
}
