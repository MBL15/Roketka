package ru.stoloto.balloon.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import ru.stoloto.balloon.config.BalloonProperties;
import ru.stoloto.balloon.config.GameConfig;
import ru.stoloto.balloon.config.GameConfigService;
import ru.stoloto.balloon.domain.GameRound;
import ru.stoloto.balloon.domain.RoundStatus;
import ru.stoloto.balloon.domain.UserAccount;
import ru.stoloto.balloon.game.ActiveRound;
import ru.stoloto.balloon.game.RoundEngine;
import ru.stoloto.balloon.repo.GameRoundRepository;
import ru.stoloto.balloon.repo.UserAccountRepository;

import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Подготовка прототипа к проверке экспертом.
 *
 * <ol>
 *   <li>создаёт демонстрационные аккаунты с ненулевым балансом бонусных
 *       баллов — по постановке они должны быть доступны без обращения к команде;</li>
 *   <li>наполняет турнир симулированными соперниками, чтобы рейтинг и таблица
 *       были содержательными сразу после запуска;</li>
 *   <li>восстанавливает раунды, не успевшие завершиться до перезапуска сервера.</li>
 * </ol>
 *
 * <p>Восстановление раундов не требует отдельного хранилища состояния: полёт
 * полностью определяется временем старта и снимком параметров, поэтому раунд
 * достаточно вернуть в игровой цикл — он продолжится точно с того места,
 * где должен быть по времени, либо сразу завершится, если время вышло.
 */
@Component
public class BootstrapService implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(BootstrapService.class);

    private static final List<String> BOT_NAMES = List.of(
            "Аэронавт", "Небоход", "Стратонавт", "Ветролов", "Облакогон", "Пилот_Ку",
            "Высотник", "Зефир", "Бореас", "Тропопауза", "Кучевой", "Перистый",
            "Альтимётр", "Гелий", "Термик", "Циррус", "Муссон", "Бриз",
            "Гондола", "Балласт", "Фал", "Такелаж", "Азимут", "Румб",
            "Восходящий", "Нисходящий", "Кумулус", "Нимбус", "Стратус", "Мистраль"
    );

    private final UserAccountRepository users;
    private final GameRoundRepository rounds;
    private final PasswordHasher passwordHasher;
    private final GameConfigService configService;
    private final BalloonProperties properties;
    private final TournamentService tournamentService;
    private final RoundEngine engine;

    public BootstrapService(UserAccountRepository users,
                            GameRoundRepository rounds,
                            PasswordHasher passwordHasher,
                            GameConfigService configService,
                            BalloonProperties properties,
                            TournamentService tournamentService,
                            RoundEngine engine) {
        this.users = users;
        this.rounds = rounds;
        this.passwordHasher = passwordHasher;
        this.configService = configService;
        this.properties = properties;
        this.tournamentService = tournamentService;
        this.engine = engine;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        seedDemoUsers();
        seedOpponents();
        tournamentService.ensureActiveTournament();
        recoverInterruptedRounds();
    }

    private void seedDemoUsers() {
        long demoBalance = configService.current().session().demoBonusBalance();
        for (String entry : properties.demoUsers()) {
            String[] parts = entry.split(":", 2);
            if (parts.length != 2) {
                continue;
            }
            String nickname = parts[0].trim();
            String password = parts[1].trim();
            AccountProfiles.Kind kind = AccountProfiles.kindOf(nickname);
            long startingBalance = AccountProfiles.startingBonus(kind, demoBalance);
            users.findByNicknameIgnoreCase(nickname).ifPresentOrElse(
                    existing -> {
                        if (kind == AccountProfiles.Kind.JUDGE) {
                            // Судья стартует с 500 при запуске сервера; во время сессии пополнение отключено.
                            existing.setBonusBalance(AccountProfiles.JUDGE_STARTING_BALANCE);
                        } else if (AccountProfiles.autoRefillOnBootstrap(kind)
                                && existing.getBonusBalance() < demoBalance / 10) {
                            existing.creditBonus(demoBalance);
                            log.info("Демо-аккаунт {} пополнен до {} бонусов",
                                    nickname, existing.getBonusBalance());
                        }
                        tournamentService.track(existing);
                    },
                    () -> {
                        UserAccount created = users.save(new UserAccount(
                                nickname, passwordHasher.hash(password), startingBalance, false));
                        tournamentService.track(created);
                        log.info("Создан аккаунт {} / {} ({}) с балансом {}",
                                nickname, password, AccountProfiles.kindCode(kind), startingBalance);
                    });
        }
    }

    private void seedOpponents() {
        GameConfig.SimulationConfig simulation = configService.current().tournament().simulation();
        long existing = users.countByBotTrue();
        int target = Math.min(simulation.botCount(), BOT_NAMES.size());
        if (existing >= target) {
            users.findByBotTrue().forEach(tournamentService::track);
            return;
        }
        ThreadLocalRandom random = ThreadLocalRandom.current();
        for (int i = (int) existing; i < target; i++) {
            String nickname = BOT_NAMES.get(i);
            if (users.findByNicknameIgnoreCase(nickname).isPresent()) {
                continue;
            }
            UserAccount bot = new UserAccount(nickname, passwordHasher.hash("bot"), 0, true);
            bot.addGamePoints(random.nextInt(120, 2600));
            tournamentService.track(users.save(bot));
        }
        log.info("Турнир наполнен соперниками: {} участников", target);
    }

    private void recoverInterruptedRounds() {
        List<GameRound> interrupted = rounds.findByStatusIn(
                List.of(RoundStatus.FLYING, RoundStatus.CASHED_OUT));
        if (interrupted.isEmpty()) {
            return;
        }
        long now = System.currentTimeMillis();
        int resumed = 0;
        int settled = 0;
        for (GameRound round : interrupted) {
            ActiveRound activeRound = engine.register(round);
            if (activeRound.crashReached(now)) {
                engine.forceSettle(activeRound);
                settled++;
            } else {
                resumed++;
            }
        }
        log.info("Восстановление раундов после перезапуска: продолжено {}, закрыто {}", resumed, settled);
    }
}
