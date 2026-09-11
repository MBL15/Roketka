package ru.stoloto.balloon.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.stoloto.balloon.config.GameConfig;
import ru.stoloto.balloon.config.GameConfigService;
import ru.stoloto.balloon.domain.AuthSession;
import ru.stoloto.balloon.domain.GameRound;
import ru.stoloto.balloon.domain.RoundStatus;
import ru.stoloto.balloon.domain.UserAccount;
import ru.stoloto.balloon.repo.AuthSessionRepository;
import ru.stoloto.balloon.repo.UserAccountRepository;
import ru.stoloto.balloon.web.dto.GameDtos;

/**
 * Всплывающее окно «Закрепи успех»: продажа лотерейных билетов за бонусные
 * баллы после удачного раунда.
 *
 * <p>Правила показа, требуемые постановкой, проверяются на сервере, а не в
 * интерфейсе: сумма выигрыша не ниже порога, раунд завершён с cashout,
 * и за одну игровую сессию окно предлагается не более одного раза. Флаг
 * показа хранится в сессии, поэтому выход из игры открывает возможность
 * показать предложение снова.
 *
 * <p>Персонализация: чем крупнее выигрыш, тем больше билетов предлагается,
 * но предложение никогда не превышает фактический баланс игрока.
 */
@Service
public class UpsellService {

    private final GameConfigService configService;
    private final AuthSessionRepository sessions;
    private final UserAccountRepository users;

    public UpsellService(GameConfigService configService,
                         AuthSessionRepository sessions,
                         UserAccountRepository users) {
        this.configService = configService;
        this.sessions = sessions;
        this.users = users;
    }

    /**
     * Готовит предложение для экрана результата и, если оно доступно,
     * помечает сессию как уже увидевшую апсейл.
     */
    @Transactional
    public GameDtos.UpsellOfferDto prepareOffer(String sessionToken, UserAccount user, GameRound round) {
        GameConfig.UpsellConfig config = configService.current().upsell();
        if (!config.enabled()) {
            return unavailable(config, "Модуль апсейла выключен в конфигурации");
        }
        if (round.getStatus() != RoundStatus.WON) {
            return unavailable(config, "Предложение показывается только после успешного cashout");
        }
        if (round.getPayout() < config.minWinAmount()) {
            return unavailable(config, "Выигрыш меньше порога MIN_WIN_AMOUNT");
        }

        AuthSession session = sessions.findById(sessionToken).orElse(null);
        if (session == null) {
            return unavailable(config, "Сессия не найдена");
        }
        if (session.isUpsellShown()) {
            return unavailable(config, "В этой игровой сессии предложение уже показывалось");
        }

        int tickets = ticketsFor(round.getPayout(), user.getBonusBalance(), config);
        if (tickets <= 0) {
            return unavailable(config, "Баланса не хватает даже на один билет");
        }
        session.markUpsellShown();

        return new GameDtos.UpsellOfferDto(true, tickets, tickets * config.ticketPriceBonus(),
                config.minWinAmount(), config.popupTimeoutSeconds(), null);
    }

    /**
     * Количество билетов в предложении.
     * {@code tickets = clamp(round(win * winShare / price), 1, maxTickets)},
     * затем предложение урезается по балансу.
     */
    int ticketsFor(long payout, long balance, GameConfig.UpsellConfig config) {
        long price = Math.max(1, config.ticketPriceBonus());
        int desired = (int) Math.round(payout * config.winShare() / price);
        desired = Math.max(1, Math.min(desired, config.maxTickets()));
        int affordable = (int) (balance / price);
        return Math.min(desired, affordable);
    }

    @Transactional
    public GameDtos.PurchaseTicketsResponse purchase(UserAccount user, int requestedTickets) {
        GameConfig.UpsellConfig config = configService.current().upsell();
        if (!config.enabled()) {
            throw new IllegalStateException("Модуль апсейла выключен в конфигурации");
        }
        int tickets = Math.max(1, Math.min(requestedTickets, config.maxTickets()));
        long price = tickets * config.ticketPriceBonus();

        UserAccount stored = users.findById(user.getId()).orElseThrow();
        stored.debitBonus(price);
        stored.addLotteryTickets(tickets);

        return new GameDtos.PurchaseTicketsResponse(tickets, price,
                stored.getBonusBalance(), stored.getLotteryTickets());
    }

    private GameDtos.UpsellOfferDto unavailable(GameConfig.UpsellConfig config, String reason) {
        return new GameDtos.UpsellOfferDto(false, 0, 0,
                config.minWinAmount(), config.popupTimeoutSeconds(), reason);
    }
}
