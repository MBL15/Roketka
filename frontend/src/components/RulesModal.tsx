import type { GameSetup, ThemeSetup } from '../api/types';
import { formatMultiplier, formatNumber } from '../utils/format';
import { Modal } from './Modal';

/**
 * Правила игры.
 *
 * Текст собирается из действующей конфигурации, а не записан константами.
 * Это принципиально: постановка требует, чтобы правила соответствовали
 * реализованной механике и выбранной математической модели, а параметры игры
 * меняются на ходу. Поменяли очки за уровень в админке — правила перечитают
 * новое значение сами.
 */

interface RulesModalProps {
  open: boolean;
  onClose: () => void;
  setup: GameSetup;
  theme: ThemeSetup;
}

export function RulesModal({ open, onClose, setup, theme }: RulesModalProps): JSX.Element {
  const unlock = theme.levelMultipliers[0] ?? 1.2;
  const boostValues = theme.betOptions.filter((option) => option.boostTier > 1).map((option) => option.boostValue);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Правила игры"
      subtitle={`${theme.gameName} · ${theme.levelCount} уровней`}
      width={720}
      footer={
        <button type="button" className="btn btn--primary" onClick={onClose}>
          Понятно
        </button>
      }
    >
      <div className="rules">
        <Section index={1} title="Ставка">
          <p>
            Выберите один из четырёх фрагментов пазла. Стоимость фрагмента сразу списывается с бонусного
            баланса — это и есть ваша ставка. Доступные суммы в этой версии:{' '}
            <strong className="num">{theme.betOptions.map((option) => formatNumber(option.cost)).join(' · ')}</strong>{' '}
            бонусных баллов. Если баланса не хватает, фрагмент помечен и ставку сделать нельзя.
          </p>
        </Section>

        <Section index={2} title="Полёт и коэффициент">
          <p>
            После подтверждения шар начинает подниматься, а коэффициент выигрыша растёт со временем полёта по
            формуле <code>коэффициент = e^({theme.growthRate.toFixed(2)} · секунды)</code>. Потолок
            коэффициента — {formatMultiplier(theme.maxMultiplier)}.
          </p>
          <p>
            В случайный момент, определённый сервером <strong>до начала полёта</strong>, шар лопается. Повлиять
            на этот момент нельзя ни вам, ни нам: до конца раунда вы видите только хеш серверного зерна, а
            после краха зерно раскрывается и результат можно пересчитать.
          </p>
        </Section>

        <Section index={3} title="Забрать выигрыш">
          <p>
            Кнопка «Забрать» становится активной после прохождения первого уровня — с коэффициента{' '}
            <strong className="num">{formatMultiplier(unlock)}</strong>. Выигрыш считается как{' '}
            <strong>ставка × текущий коэффициент</strong> и зачисляется сразу.
          </p>
          <p>
            После фиксации шар продолжает лететь до краха, но сумма больше не меняется — ни в плюс, ни в минус.
            Если не нажать «Забрать» до краха, ставка теряется.
          </p>
        </Section>

        <Section index={4} title="Бустер">
          <p>
            Фрагменты с усилением ×{boostValues.map((value) => value.toFixed(0)).join(', ×')} прячут бустер на
            одном из {theme.levelCount} уровней. Уровень выбирается сервером перед каждым раундом и остаётся
            скрытым до срабатывания — вы видите только вероятности по уровням, подсвеченные на лестнице.
            Знай вы точный уровень заранее, выбор момента выхода стал бы гарантированно выигрышной
            стратегией, и игра перестала бы быть игрой.
          </p>
          <p>
            Если шар долетит до уровня с бустером <strong>раньше</strong>, чем вы нажали «Забрать», текущий
            коэффициент умножится на значение бустера. После нажатия «Забрать» бустер уже не срабатывает —
            в этом и состоит главное решение раунда: зафиксировать сейчас или дотянуть до усиления.
          </p>
          <p className="muted">
            Чем сильнее бустер, тем тяжелее гружёный шар и тем раньше он в среднем лопается. Так усиление
            остаётся выбором риска, а не бесплатной выгодой.
          </p>
        </Section>

        <Section index={5} title="Игровые очки">
          <p>
            Очки — отдельная валюта, они не конвертируются в бонусные баллы и идут в турнирный зачёт.
            Начисляются и при выигрыше, и при проигрыше:
          </p>
          <ul className="rules__list">
            <li>
              <strong className="num">+{theme.points.perLine}</strong> за каждый пройденный уровень;
            </li>
            <li>
              <strong className="num">+{theme.points.cashoutBonus}</strong> за успешную фиксацию выигрыша;
            </li>
            <li>
              <strong className="num">
                +{theme.points.boostBonusPerTier.filter((value) => value > 0).join(' / +')}
              </strong>{' '}
              за активацию бустера ×2 / ×3 / ×4.
            </li>
          </ul>
          <p className="muted">
            Очки за уровни начисляются, пока выигрыш не зафиксирован. Остаться в полёте дольше — это способ
            подняться в турнире, даже если вы в итоге потеряете ставку.
          </p>
        </Section>

        {setup.reward.enabled && (
          <Section index={6} title={`Награда: коллекция «${setup.reward.collectionName}»`}>
            <p>
              За каждый завершённый раунд вы получаете один из {setup.reward.collectionSize} фрагментов
              коллекции. Выигрыш повышает шанс получить именно недостающий фрагмент. Дубликат автоматически
              обменивается на игровые очки, поэтому награда никогда не бывает пустой.
            </p>
            <p>
              Полная коллекция приносит <strong className="num">{formatNumber(setup.reward.completionBonusBalance)}</strong>{' '}
              бонусных баллов и <strong className="num">{formatNumber(setup.reward.completionBonusPoints)}</strong>{' '}
              игровых очков, после чего открывается следующая.
            </p>
          </Section>
        )}

        {setup.upsell.enabled && (
          <Section index={7} title="Закрепи успех">
            <p>
              После раунда с выигрышем от{' '}
              <strong className="num">{formatNumber(setup.upsell.minWinAmount)}</strong> бонусных баллов может
              появиться предложение обменять часть выигрыша на лотерейные билеты по{' '}
              {formatNumber(setup.upsell.ticketPriceBonus)} баллов за билет. Предложение показывается не более
              одного раза за игровую сессию. В прототипе покупка имитируется.
            </p>
          </Section>
        )}

        <Section index={setup.upsell.enabled ? 8 : 7} title="Честность">
          <p>
            Точка краха, положение бустера, начисление очков и расчёт выигрыша выполняются на сервере. Клиент
            получает время старта и темп роста, чтобы рисовать анимацию, но не может изменить исход.
            На экране результата видны серверное зерно и ссылка на его независимую проверку.
          </p>
        </Section>
      </div>
    </Modal>
  );
}

function Section({
  index,
  title,
  children,
}: {
  index: number;
  title: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <section className="rules__section">
      <h3 className="rules__title">
        <span className="rules__badge num">{index}</span>
        {title}
      </h3>
      <div className="rules__text text-sm">{children}</div>
    </section>
  );
}
