package ru.stoloto.balloon.service;

import org.springframework.stereotype.Service;
import ru.stoloto.balloon.config.GameConfig;
import ru.stoloto.balloon.config.GameConfigService;
import ru.stoloto.balloon.domain.CollectionFragment;
import ru.stoloto.balloon.domain.UserAccount;
import ru.stoloto.balloon.repo.CollectionFragmentRepository;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Дополнительная игровая награда — коллекция фрагментов «Карта неба».
 *
 * <h2>Роль в продуктовом контуре</h2>
 * Награда не декоративная иконка: это третий контур прогресса рядом с
 * бонусными баллами (чем платят) и игровыми очками (чем соревнуются).
 * <ul>
 *   <li>каждый завершённый раунд — и выигрышный, и проигрышный — даёт фрагмент,
 *       поэтому проигрыш никогда не оказывается полностью пустым;</li>
 *   <li>выигрыш повышает шанс получить именно недостающий фрагмент, что делает
 *       успешный cashout ценным дважды;</li>
 *   <li>дубликат автоматически обменивается на игровые очки, то есть
 *       конвертируется в турнирную позицию;</li>
 *   <li>собранная коллекция возвращает бонусные баллы и открывает следующую —
 *       это и есть повод вернуться в игру завтра.</li>
 * </ul>
 */
@Service
public class RewardService {

    private final CollectionFragmentRepository fragments;
    private final GameConfigService configService;

    public RewardService(CollectionFragmentRepository fragments, GameConfigService configService) {
        this.fragments = fragments;
        this.configService = configService;
    }

    /**
     * Выдаёт награду за завершённый раунд.
     *
     * <p>Метод меняет состояние пользователя (очки, баланс, номер коллекции) и
     * поэтому вызывается только внутри транзакции расчёта раунда.
     */
    public RewardGrant grant(UserAccount user, Long roundId, boolean won) {
        GameConfig.RewardConfig config = configService.current().reward();
        if (!config.enabled()) {
            return RewardGrant.disabled();
        }

        int collectionLevel = user.getCollectionLevel();
        int size = config.collectionSize();
        Set<Integer> owned = ownedIndices(user.getId(), collectionLevel);

        List<Integer> missing = new ArrayList<>(size);
        for (int index = 1; index <= size; index++) {
            if (!owned.contains(index)) {
                missing.add(index);
            }
        }

        ThreadLocalRandom random = ThreadLocalRandom.current();
        double guaranteedNewChance = won
                ? config.guaranteedNewChanceOnWin()
                : config.guaranteedNewChanceOnLoss();

        int fragmentIndex;
        if (!missing.isEmpty() && random.nextDouble() < guaranteedNewChance) {
            fragmentIndex = missing.get(random.nextInt(missing.size()));
        } else {
            fragmentIndex = 1 + random.nextInt(size);
        }

        boolean duplicate = owned.contains(fragmentIndex);
        int pointsAwarded = 0;
        if (duplicate) {
            pointsAwarded = config.duplicateCompensationPoints();
        } else {
            fragments.save(new CollectionFragment(user.getId(), collectionLevel, fragmentIndex, roundId));
            owned.add(fragmentIndex);
        }

        boolean completed = owned.size() >= size;
        long bonusAwarded = 0;
        if (completed) {
            pointsAwarded += config.completionBonusPoints();
            bonusAwarded = config.completionBonusBalance();
            user.creditBonus(bonusAwarded);
            user.recordBonusEarned(bonusAwarded);
            user.nextCollection();
        }

        return new RewardGrant(true, config.collectionName(), collectionLevel, fragmentIndex,
                duplicate, completed, pointsAwarded, bonusAwarded,
                completed ? size : owned.size(), size);
    }

    /** Текущее состояние коллекции игрока для экрана выбора ставки и правил. */
    public CollectionState state(UserAccount user) {
        GameConfig.RewardConfig config = configService.current().reward();
        Set<Integer> owned = ownedIndices(user.getId(), user.getCollectionLevel());
        List<Integer> sorted = new ArrayList<>(owned);
        sorted.sort(Integer::compareTo);
        return new CollectionState(config.enabled(), config.collectionName(), user.getCollectionLevel(),
                config.collectionSize(), sorted, config.completionBonusPoints(), config.completionBonusBalance());
    }

    private Set<Integer> ownedIndices(Long userId, int collectionLevel) {
        Set<Integer> owned = new HashSet<>();
        for (CollectionFragment fragment : fragments.findByUserIdAndCollectionLevel(userId, collectionLevel)) {
            owned.add(fragment.getFragmentIndex());
        }
        return owned;
    }

    /** Что именно игрок получил за раунд. */
    public record RewardGrant(boolean enabled, String collectionName, int collectionLevel,
                              Integer fragmentIndex, boolean duplicate, boolean collectionCompleted,
                              int pointsAwarded, long bonusAwarded, int ownedAfter, int collectionSize) {

        static RewardGrant disabled() {
            return new RewardGrant(false, null, 0, null, false, false, 0, 0, 0, 0);
        }
    }

    public record CollectionState(boolean enabled, String collectionName, int collectionLevel,
                                  int collectionSize, List<Integer> ownedFragments,
                                  int completionBonusPoints, long completionBonusBalance) {
    }
}
