package ru.stoloto.balloon.game;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import ru.stoloto.balloon.config.BalloonProperties;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Схема «provably fair»: доказуемая неизменность исхода раунда.
 *
 * <p>Порядок работы:
 * <ol>
 *   <li>перед полётом сервер генерирует случайное зерно {@code serverSeed}
 *       (32 байта из {@link SecureRandom}) и вычисляет точку краха;</li>
 *   <li>клиенту отдаётся только {@code SHA-256(serverSeed)} — обязательство,
 *       по которому нельзя восстановить сам исход;</li>
 *   <li>после краха зерно раскрывается, и любой может пересчитать результат:
 *       {@code GET /api/fairness/verify}.</li>
 * </ol>
 *
 * <p>Случайность выводится детерминированно из зерна, а не берётся из
 * генератора повторно, поэтому проверка воспроизводит и точку краха, и
 * положение бустера. Разные «пространства имён» ({@code crash}, {@code loot})
 * гарантируют, что две величины одного раунда независимы.
 *
 * <p>Полная верификация цепочки зёрен (commit-chain) в MVP не реализована —
 * см. раздел ограничений в docs/FEATURES.md.
 *
 * <h2>Режим разработки</h2>
 * Настройка {@code balloon.dev-seed} заменяет {@link SecureRandom} на
 * детерминированный вывод из заданной строки. Последовательность раундов при
 * этом воспроизводится от запуска к запуску — это нужно, чтобы отлаживать
 * анимации и проверять сценарии на одних и тех же исходах. В рабочем режиме
 * настройка пуста, и предсказать зерно невозможно.
 */
@Service
public class FairnessService {

    private static final Logger log = LoggerFactory.getLogger(FairnessService.class);

    public static final String NAMESPACE_CRASH = "crash";
    public static final String NAMESPACE_LOOT = "loot";

    /** 2^53 — предел целых чисел, представимых в double без потери точности. */
    private static final double UNIFORM_DENOMINATOR = 9007199254740992.0;
    private static final int UNIFORM_BITS = 53;
    private static final char[] HEX = "0123456789abcdef".toCharArray();

    private final SecureRandom random = new SecureRandom();
    private final String devSeed;
    private final AtomicLong devCounter = new AtomicLong();

    public FairnessService(BalloonProperties properties) {
        this.devSeed = properties.devSeedEnabled() ? properties.devSeed() : null;
        if (devSeed != null) {
            log.warn("Включён режим фиксированного зерна (balloon.dev-seed): "
                    + "исходы раундов предсказуемы. Не использовать вне разработки.");
        }
    }

    public boolean isDevSeedEnabled() {
        return devSeed != null;
    }

    public String newServerSeed() {
        if (devSeed != null) {
            return sha256(devSeed + ":server:" + devCounter.incrementAndGet());
        }
        byte[] seed = new byte[32];
        random.nextBytes(seed);
        return toHex(seed);
    }

    public String newClientSeed() {
        if (devSeed != null) {
            return sha256(devSeed + ":client:" + devCounter.get()).substring(0, 16);
        }
        byte[] seed = new byte[8];
        random.nextBytes(seed);
        return toHex(seed);
    }

    public String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return toHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 недоступен", e);
        }
    }

    /**
     * Детерминированная равномерная величина из [0;1).
     *
     * <p>Из HMAC берутся 53 старших бита — ровно столько целых значений double
     * представляет точно, поэтому деление на 2^53 не теряет разрядов и не
     * создаёт перекоса распределения.
     *
     * @param namespace разделяет независимые случайные величины одного раунда
     */
    public double uniform(String serverSeed, String clientSeed, long nonce, String namespace) {
        byte[] mac = hmacSha256(serverSeed, namespace + ':' + clientSeed + ':' + nonce);
        long bits = 0;
        for (int i = 0; i < 7; i++) {                 // 7 байт = 56 бит
            bits = (bits << 8) | (mac[i] & 0xFFL);
        }
        bits >>>= (56 - UNIFORM_BITS);                // оставляем 53 старших бита
        return bits / UNIFORM_DENOMINATOR;
    }

    private byte[] hmacSha256(String key, String message) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return mac.doFinal(message.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException("HmacSHA256 недоступен", e);
        }
    }

    private static String toHex(byte[] bytes) {
        char[] chars = new char[bytes.length * 2];
        for (int i = 0; i < bytes.length; i++) {
            int value = bytes[i] & 0xFF;
            chars[i * 2] = HEX[value >>> 4];
            chars[i * 2 + 1] = HEX[value & 0x0F];
        }
        return new String(chars);
    }
}
