import { useCallback, useEffect, useState } from 'react';
import { ApiError, api } from '../api/client';
import type { AdminConfig, AdminTheme, ConfigStatus, RuntimeStats, SimulationReport } from '../api/types';
import { formatMultiplier, formatNumber, formatPercent } from '../utils/format';

/**
 * Административная панель.
 *
 * Правит тот же файл, что и текстовый редактор: панель отдаёт конфигурацию
 * на сервер, сервер её валидирует, сериализует обратно в YAML вместе с
 * комментариями и применяет. Поэтому «настроить руками» и «настроить в UI» —
 * не два разных механизма, а один.
 *
 * Три вещи, которые панель обязана делать честно:
 *  1. Не применять заведомо сломанные настройки. Ошибки приходят с сервера
 *     списком и показываются до сохранения.
 *  2. Показывать, что именно применено сейчас, — статус файла, номер ревизии
 *     и время загрузки.
 *  3. Позволять оценить последствия ДО сохранения. Для этого симулятор умеет
 *     считать по черновику, который ещё не записан на диск.
 */
export function AdminScreen({ onExit }: { onExit: () => void }): JSX.Element {
  const [draft, setDraft] = useState<AdminConfig | null>(null);
  const [saved, setSaved] = useState<AdminConfig | null>(null);
  const [status, setStatus] = useState<ConfigStatus | null>(null);
  const [stats, setStats] = useState<RuntimeStats | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'green' | 'red' | 'global' | 'sim'>('green');

  const reload = useCallback(async () => {
    const [config, configStatus, runtime] = await Promise.all([
      api.adminConfig(),
      api.adminStatus(),
      api.adminStats(),
    ]);
    setDraft(structuredClone(config));
    setSaved(config);
    setStatus(configStatus);
    setStats(runtime);
    setErrors(configStatus.errors);
  }, []);

  useEffect(() => {
    void reload().catch(() => setMessage('Не удалось загрузить конфигурацию'));
  }, [reload]);

  const dirty = draft !== null && saved !== null && JSON.stringify(draft) !== JSON.stringify(saved);

  const patchTheme = (key: string, patch: Partial<AdminTheme>) => {
    setDraft((current) =>
      current
        ? { ...current, themes: { ...current.themes, [key]: { ...current.themes[key], ...patch } } }
        : current,
    );
  };

  const validate = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      const response = await api.adminValidate(draft);
      setErrors(response.errors);
      setMessage(response.valid ? 'Конфигурация корректна, можно применять' : 'Найдены ошибки');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setMessage(null);
    try {
      const applied = await api.adminSave(draft);
      setSaved(applied);
      setDraft(structuredClone(applied));
      setErrors([]);
      setMessage('Сохранено и применено. Новые раунды используют эти параметры.');
      setStatus(await api.adminStatus());
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.details ?? [error.message]);
        setMessage('Изменения отклонены — действующая конфигурация не тронута');
      }
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    try {
      const applied = await api.adminReset();
      setSaved(applied);
      setDraft(structuredClone(applied));
      setErrors([]);
      setMessage('Восстановлены заводские параметры');
      setStatus(await api.adminStatus());
    } finally {
      setBusy(false);
    }
  };

  if (!draft) {
    return <div className="admin admin--loading">Загружаем конфигурацию…</div>;
  }

  return (
    <div className="admin">
      <header className="admin__head panel panel--pad">
        <div className="col grow">
          <span className="eyebrow">Административная панель</span>
          <h1 className="h2">Параметры игры</h1>
          {status && (
            <p className="text-xs muted">
              Файл: <span className="mono">{status.path}</span> ·{' '}
              {status.writable ? 'доступен для записи' : 'только чтение'} · применённых версий:{' '}
              {status.appliedRevisions}
              {stats ? ` · активных раундов: ${stats.activeRounds}` : ''}
            </p>
          )}
        </div>

        <div className="admin__head-actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => void reload()} disabled={busy}>
            Перечитать
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => void reset()} disabled={busy}>
            Сбросить к заводским
          </button>
          <button type="button" className="btn btn--sm" onClick={onExit}>
            К игре
          </button>
        </div>
      </header>

      {(errors.length > 0 || message) && (
        <div className={`admin__banner${errors.length > 0 ? ' admin__banner--error' : ''}`}>
          {message && <strong>{message}</strong>}
          {errors.length > 0 && (
            <ul className="admin__errors">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <nav className="admin__tabs">
        {(
          [
            ['green', 'Зелёная тема'],
            ['red', 'Красная тема'],
            ['global', 'Награды, апсейл, турнир'],
            ['sim', 'Симулятор RTP'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`admin__tab${tab === key ? ' admin__tab--active' : ''}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="admin__body">
        {(tab === 'green' || tab === 'red') && (
          <ThemeEditor
            themeKey={tab}
            theme={draft.themes[tab]}
            onChange={(patch) => patchTheme(tab, patch)}
          />
        )}

        {tab === 'global' && <GlobalEditor config={draft} onChange={setDraft} />}

        {tab === 'sim' && <Simulator draft={draft} dirty={dirty} />}
      </div>

      <footer className="admin__foot panel panel--pad">
        <span className="text-sm muted grow">
          {dirty
            ? 'Есть несохранённые изменения. Применятся только к новым раундам — уже летящие доигрываются на своих параметрах.'
            : 'Изменений нет.'}
        </span>
        <button type="button" className="btn" onClick={() => void validate()} disabled={busy || !dirty}>
          Проверить
        </button>
        <button type="button" className="btn btn--primary" onClick={() => void save()} disabled={busy || !dirty}>
          Сохранить и применить
        </button>
      </footer>
    </div>
  );
}

// ------------------------------------------------------------ редактор темы

function ThemeEditor({
  themeKey,
  theme,
  onChange,
}: {
  themeKey: string;
  theme: AdminTheme;
  onChange: (patch: Partial<AdminTheme>) => void;
}): JSX.Element {
  const expectedLevels = themeKey === 'green' ? 9 : 12;

  return (
    <div className="admin__grid">
      <Card title="Базовые параметры" hint="game_id, game_name, game_type, is_active">
        <Text label="gameId" value={theme.gameId} onChange={(value) => onChange({ gameId: value })} />
        <Text label="gameName" value={theme.gameName} onChange={(value) => onChange({ gameName: value })} />
        <Text label="gameType" value={theme.gameType} onChange={(value) => onChange({ gameType: value })} />
        <Toggle label="Тема доступна" value={theme.active} onChange={(value) => onChange({ active: value })} />
      </Card>

      <Card
        title="Математическая модель"
        hint="Определяет, как часто и на каком коэффициенте лопается шар"
      >
        <Num
          label="alpha"
          hint="Форма хвоста распределения. Больше — шар лопается раньше. При alpha = 1 RTP не зависит от момента выхода."
          value={theme.math.alpha}
          step={0.05}
          onChange={(value) => onChange({ math: { ...theme.math, alpha: value } })}
        />
        <Num
          label="houseEdge"
          hint="Доля раундов с мгновенным крахом. RTP базовой ставки = 1 − houseEdge."
          value={theme.math.houseEdge}
          step={0.01}
          onChange={(value) => onChange({ math: { ...theme.math, houseEdge: value } })}
        />
        <Num
          label="minCrashMultiplier"
          value={theme.math.minCrashMultiplier}
          step={0.01}
          onChange={(value) => onChange({ math: { ...theme.math, minCrashMultiplier: value } })}
        />
        <Num
          label="maxMultiplier"
          hint="Жёсткий потолок коэффициента: обрезает хвост распределения."
          value={theme.math.maxMultiplier}
          step={1}
          onChange={(value) => onChange({ math: { ...theme.math, maxMultiplier: value } })}
        />
        <Num
          label="multiplierGrowthRate"
          hint="Темп роста: m(t) = exp(rate · t). Больше — меньше времени на решение."
          value={theme.math.multiplierGrowthRate}
          step={0.01}
          onChange={(value) => onChange({ math: { ...theme.math, multiplierGrowthRate: value } })}
        />
        <Num
          label="fps"
          hint="Частота серверных тиков. Клиент рисует 60 кадров сам, независимо от этого значения."
          value={theme.math.fps}
          step={1}
          onChange={(value) => onChange({ math: { ...theme.math, fps: value } })}
        />
        <Num
          label="delta"
          hint="Шаг округления коэффициента. Округление всегда вниз."
          value={theme.math.delta}
          step={0.01}
          onChange={(value) => onChange({ math: { ...theme.math, delta: value } })}
        />
        <Num
          label="maxFlightSeconds"
          value={theme.math.maxFlightSeconds}
          step={1}
          onChange={(value) => onChange({ math: { ...theme.math, maxFlightSeconds: value } })}
        />
      </Card>

      <Card
        title={`Границы уровней (${theme.levelMultipliers.length} из ${expectedLevels})`}
        hint="Строго возрастающий список. Первый уровень разблокирует кнопку «Забрать»."
      >
        <NumberList
          values={theme.levelMultipliers}
          step={0.05}
          labelFor={(index) => `Уровень ${index + 1}`}
          onChange={(values) => onChange({ levelMultipliers: values })}
        />
      </Card>

      <Card
        title="Вероятность бустера по уровням"
        hint="line_N_loot_prob. Веса нормируются автоматически, сумма может быть любой."
      >
        <NumberList
          values={theme.lootProbabilities}
          step={0.01}
          labelFor={(index) => `Уровень ${index + 1}`}
          onChange={(values) => onChange({ lootProbabilities: values })}
        />
      </Card>

      <Card title="Множители бустеров" hint="multiplier_tier_N_value. Первый всегда 1.0 — вариант без усиления.">
        <NumberList
          values={theme.boostTierValues}
          step={0.5}
          labelFor={(index) => `tier ${index + 1}`}
          onChange={(values) => onChange({ boostTierValues: values })}
        />
      </Card>

      <Card
        title="Варианты ставки"
        hint="alphaShift компенсирует выгоду бустера: гружёный шар лопается раньше. Подбирается симулятором."
      >
        <div className="admin__options">
          {theme.betOptions.map((option, index) => (
            <div key={option.id} className="admin__option">
              <span className="eyebrow">Фрагмент {index + 1}</span>
              <Num
                label="cost"
                value={option.cost}
                step={10}
                onChange={(value) => {
                  const next = [...theme.betOptions];
                  next[index] = { ...option, cost: value };
                  onChange({ betOptions: next });
                }}
              />
              <Num
                label="boostTier"
                value={option.boostTier}
                step={1}
                onChange={(value) => {
                  const next = [...theme.betOptions];
                  next[index] = { ...option, boostTier: value };
                  onChange({ betOptions: next });
                }}
              />
              <Num
                label="alphaShift"
                value={option.alphaShift}
                step={0.01}
                onChange={(value) => {
                  const next = [...theme.betOptions];
                  next[index] = { ...option, alphaShift: value };
                  onChange({ betOptions: next });
                }}
              />
            </div>
          ))}
        </div>
      </Card>

      <Card title="Игровые очки" hint="points_per_line, points_cashout_bonus, points_xN_bonus">
        <Num
          label="perLine"
          value={theme.points.perLine}
          step={1}
          onChange={(value) => onChange({ points: { ...theme.points, perLine: value } })}
        />
        <Num
          label="cashoutBonus"
          value={theme.points.cashoutBonus}
          step={1}
          onChange={(value) => onChange({ points: { ...theme.points, cashoutBonus: value } })}
        />
        <NumberList
          values={theme.points.boostBonusPerTier}
          step={5}
          labelFor={(index) => `бонус за ×${index + 1}`}
          onChange={(values) => onChange({ points: { ...theme.points, boostBonusPerTier: values } })}
        />
      </Card>
    </div>
  );
}

// -------------------------------------------------- редактор общих настроек

function GlobalEditor({
  config,
  onChange,
}: {
  config: AdminConfig;
  onChange: (config: AdminConfig) => void;
}): JSX.Element {
  const patch = <K extends keyof AdminConfig>(key: K, value: AdminConfig[K]) =>
    onChange({ ...config, [key]: value });

  return (
    <div className="admin__grid">
      <Card title="Награда: коллекция" hint="Дополнительная игровая награда за каждый раунд">
        <Toggle
          label="Включена"
          value={config.reward.enabled}
          onChange={(value) => patch('reward', { ...config.reward, enabled: value })}
        />
        <Text
          label="collectionName"
          value={config.reward.collectionName}
          onChange={(value) => patch('reward', { ...config.reward, collectionName: value })}
        />
        <Num
          label="collectionSize"
          value={config.reward.collectionSize}
          step={1}
          onChange={(value) => patch('reward', { ...config.reward, collectionSize: value })}
        />
        <Num
          label="guaranteedNewChanceOnWin"
          value={config.reward.guaranteedNewChanceOnWin}
          step={0.05}
          onChange={(value) => patch('reward', { ...config.reward, guaranteedNewChanceOnWin: value })}
        />
        <Num
          label="guaranteedNewChanceOnLoss"
          value={config.reward.guaranteedNewChanceOnLoss}
          step={0.05}
          onChange={(value) => patch('reward', { ...config.reward, guaranteedNewChanceOnLoss: value })}
        />
        <Num
          label="duplicateCompensationPoints"
          value={config.reward.duplicateCompensationPoints}
          step={5}
          onChange={(value) => patch('reward', { ...config.reward, duplicateCompensationPoints: value })}
        />
        <Num
          label="completionBonusPoints"
          value={config.reward.completionBonusPoints}
          step={50}
          onChange={(value) => patch('reward', { ...config.reward, completionBonusPoints: value })}
        />
        <Num
          label="completionBonusBalance"
          value={config.reward.completionBonusBalance}
          step={50}
          onChange={(value) => patch('reward', { ...config.reward, completionBonusBalance: value })}
        />
      </Card>

      <Card title="Апсейл «Закрепи успех»" hint="MIN_WIN_AMOUNT и POPUP_TIMEOUT из постановки">
        <Toggle
          label="Включён"
          value={config.upsell.enabled}
          onChange={(value) => patch('upsell', { ...config.upsell, enabled: value })}
        />
        <Num
          label="minWinAmount"
          value={config.upsell.minWinAmount}
          step={10}
          onChange={(value) => patch('upsell', { ...config.upsell, minWinAmount: value })}
        />
        <Num
          label="popupTimeoutSeconds"
          value={config.upsell.popupTimeoutSeconds}
          step={1}
          onChange={(value) => patch('upsell', { ...config.upsell, popupTimeoutSeconds: value })}
        />
        <Num
          label="ticketPriceBonus"
          value={config.upsell.ticketPriceBonus}
          step={5}
          onChange={(value) => patch('upsell', { ...config.upsell, ticketPriceBonus: value })}
        />
        <Num
          label="maxTickets"
          value={config.upsell.maxTickets}
          step={1}
          onChange={(value) => patch('upsell', { ...config.upsell, maxTickets: value })}
        />
        <Num
          label="winShare"
          hint="Какую долю выигрыша предлагать обменять на билеты"
          value={config.upsell.winShare}
          step={0.05}
          onChange={(value) => patch('upsell', { ...config.upsell, winShare: value })}
        />
      </Card>

      <Card title="Турнир" hint="Живой рейтинг и таблица">
        <Toggle
          label="Включён"
          value={config.tournament.enabled}
          onChange={(value) => patch('tournament', { ...config.tournament, enabled: value })}
        />
        <Text
          label="name"
          value={config.tournament.name}
          onChange={(value) => patch('tournament', { ...config.tournament, name: value })}
        />
        <Num
          label="durationDays"
          value={config.tournament.durationDays}
          step={1}
          onChange={(value) => patch('tournament', { ...config.tournament, durationDays: value })}
        />
        <Num
          label="liveRatingSize"
          value={config.tournament.liveRatingSize}
          step={1}
          onChange={(value) => patch('tournament', { ...config.tournament, liveRatingSize: value })}
        />
        <Toggle
          label="Маскировать имена"
          value={config.tournament.anonymizeNames}
          onChange={(value) => patch('tournament', { ...config.tournament, anonymizeNames: value })}
        />
        <Toggle
          label="Симулировать соперников"
          value={config.tournament.simulation.enabled}
          onChange={(value) =>
            patch('tournament', {
              ...config.tournament,
              simulation: { ...config.tournament.simulation, enabled: value },
            })
          }
        />
        <Num
          label="botCount"
          value={config.tournament.simulation.botCount}
          step={1}
          onChange={(value) =>
            patch('tournament', {
              ...config.tournament,
              simulation: { ...config.tournament.simulation, botCount: value },
            })
          }
        />
      </Card>

      <Card title="Сессия и интерфейс">
        <Num
          label="resultIdleTimeoutSeconds"
          hint="Бездействие на экране результата до автоматического возврата"
          value={config.session.resultIdleTimeoutSeconds}
          step={1}
          onChange={(value) => patch('session', { ...config.session, resultIdleTimeoutSeconds: value })}
        />
        <Num
          label="onboardingHintSeconds"
          value={config.session.onboardingHintSeconds}
          step={1}
          onChange={(value) => patch('session', { ...config.session, onboardingHintSeconds: value })}
        />
        <Num
          label="historySize"
          value={config.session.historySize}
          step={5}
          onChange={(value) => patch('session', { ...config.session, historySize: value })}
        />
        <Num
          label="demoBonusBalance"
          value={config.session.demoBonusBalance}
          step={500}
          onChange={(value) => patch('session', { ...config.session, demoBonusBalance: value })}
        />
      </Card>
    </div>
  );
}

// ------------------------------------------------------------ симулятор RTP

function Simulator({ draft, dirty }: { draft: AdminConfig; dirty: boolean }): JSX.Element {
  const [theme, setTheme] = useState('green');
  const [strategy, setStrategy] = useState('LEVEL');
  const [rounds, setRounds] = useState(50_000);
  const [targetMultiplier, setTargetMultiplier] = useState(2);
  const [targetLevel, setTargetLevel] = useState(3);
  const [seed, setSeed] = useState<number | null>(2026);
  const [useDraft, setUseDraft] = useState(true);
  const [report, setReport] = useState<SimulationReport | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      setReport(
        await api.adminSimulate({
          config: useDraft ? draft : undefined,
          theme,
          strategy,
          rounds,
          targetMultiplier,
          targetLevel,
          seed,
        }),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin__sim">
      <Card
        title="Параметры прогона"
        hint="Влияние математических настроек нельзя оценить по одному раунду — только по серии"
      >
        <label className="field">
          <span className="field__label">Тема</span>
          <select className="input" value={theme} onChange={(event) => setTheme(event.target.value)}>
            <option value="green">Зелёная</option>
            <option value="red">Красная</option>
          </select>
        </label>

        <label className="field">
          <span className="field__label">Стратегия игрока</span>
          <select className="input" value={strategy} onChange={(event) => setStrategy(event.target.value)}>
            <option value="LEVEL">Забрать на уровне N</option>
            <option value="TARGET_MULTIPLIER">Забрать на коэффициенте</option>
            <option value="WAIT_FOR_BOOST">Оракул: дождаться бустера</option>
            <option value="HOLD_TO_CRASH">Не забирать никогда</option>
          </select>
        </label>

        {strategy === 'LEVEL' && (
          <Num label="Уровень выхода" value={targetLevel} step={1} onChange={setTargetLevel} />
        )}
        {strategy === 'TARGET_MULTIPLIER' && (
          <Num label="Коэффициент выхода" value={targetMultiplier} step={0.5} onChange={setTargetMultiplier} />
        )}

        <Num label="Раундов на вариант" value={rounds} step={10_000} onChange={setRounds} />
        <Num
          label="Seed (пусто — случайный)"
          hint="С фиксированным seed прогон воспроизводится в точности"
          value={seed ?? 0}
          step={1}
          onChange={(value) => setSeed(value || null)}
        />
        <Toggle
          label={dirty ? 'Считать по черновику (есть несохранённые правки)' : 'Считать по черновику'}
          value={useDraft}
          onChange={setUseDraft}
        />

        <button type="button" className="btn btn--primary btn--block" onClick={() => void run()} disabled={busy}>
          {busy ? 'Считаем…' : 'Запустить симуляцию'}
        </button>

        {strategy === 'WAIT_FOR_BOOST' && (
          <p className="text-xs muted">
            Эта стратегия требует знать позицию бустера заранее. Игра её не раскрывает, поэтому результат —
            верхняя оценка, а не достижимый RTP. Разрыв с «забрать на уровне N» показывает, сколько стоит
            скрытая информация.
          </p>
        )}
      </Card>

      <Card title="Результат" hint={report ? `${report.themeName}, ${formatNumber(report.roundsPerOption)} раундов на вариант` : undefined}>
        {!report ? (
          <p className="text-sm muted">Запустите прогон, чтобы увидеть RTP по каждому варианту ставки.</p>
        ) : (
          <>
            <p className="text-xs muted">
              alpha = {report.alpha}, houseEdge = {report.houseEdge}, теоретическая медиана краха ={' '}
              {formatMultiplier(report.theoreticalMedianCrash)}
            </p>
            <div className="admin__table-wrap">
              <table className="admin__table">
                <thead>
                  <tr>
                    <th>Ставка</th>
                    <th>Бустер</th>
                    <th>alpha</th>
                    <th>RTP</th>
                    <th>Теория</th>
                    <th>Побед</th>
                    <th>Бустер сработал</th>
                    <th>Ср. выход</th>
                    <th>Медиана краха</th>
                    <th>Очки/раунд</th>
                  </tr>
                </thead>
                <tbody>
                  {report.options.map((option) => (
                    <tr key={option.optionId} className={option.empiricalRtp >= 1 ? 'admin__row--warn' : ''}>
                      <td className="num">{formatNumber(option.cost)}</td>
                      <td className="num">×{option.boostValue.toFixed(0)}</td>
                      <td className="num">{option.effectiveAlpha.toFixed(2)}</td>
                      <td className="num">
                        <strong>{formatPercent(option.empiricalRtp)}</strong>
                      </td>
                      <td className="num muted">{formatPercent(option.theoreticalRtp)}</td>
                      <td className="num">{formatPercent(option.winRate)}</td>
                      <td className="num">{formatPercent(option.boostActivationRate)}</td>
                      <td className="num">{formatMultiplier(option.averageCashoutMultiplier)}</td>
                      <td className="num">{formatMultiplier(option.medianCrashMultiplier)}</td>
                      <td className="num">{option.averagePointsPerRound.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs muted">
              RTP выше 100% означает, что вариант ставки выгоден игроку — строка подсвечена. Обычно лечится
              увеличением alphaShift этого варианта.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}

// ----------------------------------------------------------- поля и обёртки

function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <section className="panel panel--pad admin__card">
      <header className="admin__card-head">
        <h3 className="h3">{title}</h3>
        {hint && <p className="text-xs muted">{hint}</p>}
      </header>
      <div className="admin__card-body">{children}</div>
    </section>
  );
}

function Num({
  label,
  value,
  step,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  hint?: string;
  onChange: (value: number) => void;
}): JSX.Element {
  return (
    <label className="field field--inline" title={hint}>
      <span className="field__label mono">{label}</span>
      <input
        className="input input--num num"
        type="number"
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {hint && <span className="field__hint text-xs muted">{hint}</span>}
    </label>
  );
}

function Text({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}): JSX.Element {
  return (
    <label className="field field--inline field--text">
      <span className="field__label mono">{label}</span>
      <input className="input" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}): JSX.Element {
  return (
    <label className="field field--toggle">
      <input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} />
      <span className="field__label">{label}</span>
    </label>
  );
}

function NumberList({
  values,
  step,
  labelFor,
  onChange,
}: {
  values: number[];
  step: number;
  labelFor: (index: number) => string;
  onChange: (values: number[]) => void;
}): JSX.Element {
  return (
    <div className="admin__list">
      {values.map((value, index) => (
        <label key={index} className="field field--compact">
          <span className="field__label text-xs">{labelFor(index)}</span>
          <input
            className="input input--num num"
            type="number"
            step={step}
            value={value}
            onChange={(event) => {
              const next = [...values];
              next[index] = Number(event.target.value);
              onChange(next);
            }}
          />
        </label>
      ))}
    </div>
  );
}
