import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { ApiError, api } from '../api/client';
import type { AdminConfig, AdminTheme, ConfigStatus, RuntimeStats, SimulationReport } from '../api/types';
import { formatMultiplier, formatNumber, formatPercent } from '../utils/format';
import { AdminSearch } from './AdminSearch';
import { TAB_GROUPS, type AdminSearchEntry, type AdminTab } from './adminSettingsSearch';

type ThemeSectionKind = 'general' | 'levels' | 'economy';

const AdminHighlightContext = createContext<string | null>(null);

function useFieldHighlighted(fieldId?: string): boolean {
  const active = useContext(AdminHighlightContext);
  return Boolean(fieldId && active === fieldId);
}

const TAB_HINTS: Record<AdminTab, string> = {
  'green-general': 'Название, доступность и математика зелёной темы — 9 уровней, умеренный риск.',
  'green-levels': 'Пороги коэффициентов, вероятности бустера и сила усиления для зелёного шара.',
  'green-economy': 'Четыре фрагмента ставки и начисление турнирных очков в зелёной теме.',
  'red-general': 'Название, доступность и математика красной темы — 12 уровней, повышенный риск.',
  'red-levels': 'Пороги коэффициентов, вероятности бустера и сила усиления для красного шара.',
  'red-economy': 'Четыре фрагмента ставки и начисление турнирных очков в красной теме.',
  rewards: 'Коллекционная награда «Карта неба»: фрагменты, шансы выпадения и бонусы за сбор.',
  upsell: 'Окно «Закрепи успех» после крупного выигрыша — обмен части бонусов на билеты.',
  tournament: 'Живой рейтинг, таблица лидеров, боты-соперники и длительность турнира.',
  interface: 'Таймауты экранов, подсказки новичкам, история раундов и демо-баланс.',
  sim: 'Monte-Carlo прогон: оцените RTP по каждому варианту ставки до сохранения.',
};

function isThemeTab(tab: AdminTab): tab is `${'green' | 'red'}-${ThemeSectionKind}` {
  return tab.startsWith('green-') || tab.startsWith('red-');
}

function themeKey(tab: AdminTab): 'green' | 'red' {
  return tab.startsWith('red-') ? 'red' : 'green';
}

function themeSection(tab: AdminTab): ThemeSectionKind {
  if (tab.endsWith('-levels')) return 'levels';
  if (tab.endsWith('-economy')) return 'economy';
  return 'general';
}

function themeTone(tab: AdminTab): 'green' | 'red' | 'global' {
  if (tab.startsWith('green-')) return 'green';
  if (tab.startsWith('red-')) return 'red';
  return 'global';
}

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
  const [tab, setTab] = useState<AdminTab>('green-general');
  const [highlightFieldId, setHighlightFieldId] = useState<string | null>(null);

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

  const tabHint = TAB_HINTS[tab];

  const navigateToSetting = (entry: AdminSearchEntry) => {
    setTab(entry.tab);
    setHighlightFieldId(entry.id);
  };

  useEffect(() => {
    if (!highlightFieldId) {
      return undefined;
    }
    const focusTimer = window.setTimeout(() => {
      const node = document.getElementById(`admin-field-${highlightFieldId}`);
      node?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const focusable = node?.querySelector('input, select, textarea') as HTMLElement | null;
      focusable?.focus({ preventScroll: true });
    }, 80);
    const clearTimer = window.setTimeout(() => setHighlightFieldId(null), 2600);
    return () => {
      window.clearTimeout(focusTimer);
      window.clearTimeout(clearTimer);
    };
  }, [highlightFieldId, tab]);

  if (!draft) {
    return <div className="admin admin--loading">Загружаем конфигурацию…</div>;
  }

  return (
    <div className="admin">
      <header className="admin__head panel panel--pad">
        <div className="col grow">
          <span className="eyebrow">Административная панель</span>
          <h1 className="h2">Настройки игры</h1>
          <p className="text-sm muted admin__lead">
            Меняйте экономику, уровни и награды — изменения применяются к новым раундам без перезапуска сервера.
          </p>

          {status && (
            <div className="admin__status">
              <span className={`admin__pill${dirty ? ' admin__pill--draft' : ' admin__pill--ok'}`}>
                {dirty ? 'Есть несохранённые правки' : 'Все настройки сохранены'}
              </span>
              <span className="admin__pill">Версия {status.appliedRevisions}</span>
              {stats && stats.activeRounds > 0 && (
                <span className="admin__pill admin__pill--live">
                  Сейчас в игре: {stats.activeRounds} {stats.activeRounds === 1 ? 'раунд' : 'раунда'}
                </span>
              )}
              {!status.writable && <span className="admin__pill admin__pill--warn">Только чтение</span>}
            </div>
          )}

          {status && (
            <details className="admin__meta">
              <summary>Техническая информация</summary>
              <p className="text-xs muted">
                Файл конфигурации: <span className="mono">{status.path}</span>
              </p>
            </details>
          )}
        </div>

        <div className="admin__head-actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => void reload()} disabled={busy}>
            Обновить
          </button>
          <button type="button" className="btn btn--danger btn--sm" onClick={() => void reset()} disabled={busy}>
            Сбросить настройки
          </button>
          <button type="button" className="btn btn--primary btn--sm" onClick={onExit}>
            Вернуться к игре
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

      <AdminSearch onNavigate={navigateToSetting} />

      <div className="admin__nav">
        {TAB_GROUPS.map((group) => (
          <section key={group.label} className="admin__nav-group">
            <span className="admin__nav-label">{group.label}</span>
            <nav className="admin__tabs" aria-label={group.label}>
              {group.tabs.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`admin__tab admin__tab--${themeTone(key)}${tab === key ? ' admin__tab--active' : ''}`}
                  onClick={() => setTab(key)}
                >
                  {label}
                </button>
              ))}
            </nav>
          </section>
        ))}
      </div>

      <p className="admin__tab-hint text-sm muted">{tabHint}</p>

      <AdminHighlightContext.Provider value={highlightFieldId}>
        <div className="admin__body">
          {isThemeTab(tab) && (
            <ThemeSection
              section={themeSection(tab)}
              themeKey={themeKey(tab)}
              theme={draft.themes[themeKey(tab)]}
              onChange={(patch) => patchTheme(themeKey(tab), patch)}
            />
          )}

          {tab === 'rewards' && <RewardEditor config={draft} onChange={setDraft} />}
          {tab === 'upsell' && <UpsellEditor config={draft} onChange={setDraft} />}
          {tab === 'tournament' && <TournamentEditor config={draft} onChange={setDraft} />}
          {tab === 'interface' && <SessionEditor config={draft} onChange={setDraft} />}
          {tab === 'sim' && <Simulator draft={draft} dirty={dirty} />}
        </div>
      </AdminHighlightContext.Provider>

      <footer className="admin__foot panel panel--pad">
        <div className="admin__foot-copy grow">
          <strong>{dirty ? 'Есть несохранённые изменения' : 'Все изменения сохранены'}</strong>
          <span className="text-sm muted">
            {dirty
              ? 'Нажмите «Проверить», затем «Сохранить». Новые раунды возьмут обновлённые параметры, текущие полёты не прервутся.'
              : 'Можно безопасно вернуться к игре или изменить другой раздел.'}
          </span>
        </div>
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

function ThemeSection({
  section,
  themeKey,
  theme,
  onChange,
}: {
  section: ThemeSectionKind;
  themeKey: string;
  theme: AdminTheme;
  onChange: (patch: Partial<AdminTheme>) => void;
}): JSX.Element {
  const expectedLevels = themeKey === 'green' ? 9 : 12;
  const pid = themeKey;

  if (section === 'general') {
    return (
      <div className="admin__grid">
      <Card
        title="Основное"
        hint="Как тема называется в интерфейсе и доступна ли игрокам."
      >
        <Text
          fieldId={`${pid}.gameName`}
          label="Название для игроков"
          code="gameName"
          value={theme.gameName}
          onChange={(value) => onChange({ gameName: value })}
        />
        <Text
          fieldId={`${pid}.gameId`}
          label="Системный идентификатор"
          code="gameId"
          hint="Используется в API и логах. Меняйте только если понимаете последствия."
          value={theme.gameId}
          onChange={(value) => onChange({ gameId: value })}
        />
        <Text
          fieldId={`${pid}.gameType`}
          label="Тип игры"
          code="gameType"
          value={theme.gameType}
          onChange={(value) => onChange({ gameType: value })}
        />
        <Toggle
          fieldId={`${pid}.active`}
          label="Тема доступна игрокам"
          hint="Если выключить, тему нельзя будет выбрать на экране входа."
          value={theme.active}
          onChange={(value) => onChange({ active: value })}
        />
      </Card>

      <Card
        title="Математика раунда"
        hint="Определяет, как часто шар лопается и как быстро растёт коэффициент."
        wide
      >
        <Num
          fieldId={`${pid}.alpha`}
          label="Крутизна распределения"
          code="alpha"
          hint="Чем выше значение, тем раньше в среднем лопается шар. При 1.0 RTP не зависит от момента выхода."
          value={theme.math.alpha}
          step={0.05}
          onChange={(value) => onChange({ math: { ...theme.math, alpha: value } })}
        />
        <Num
          fieldId={`${pid}.houseEdge`}
          label="Преимущество заведения"
          code="houseEdge"
          hint="Доля мгновенных крахов. Базовый RTP ставки ≈ 100% минус это значение."
          value={theme.math.houseEdge}
          step={0.01}
          onChange={(value) => onChange({ math: { ...theme.math, houseEdge: value } })}
        />
        <Num
          fieldId={`${pid}.minCrashMultiplier`}
          label="Минимальный коэффициент краха"
          code="minCrashMultiplier"
          value={theme.math.minCrashMultiplier}
          step={0.01}
          suffix="×"
          onChange={(value) => onChange({ math: { ...theme.math, minCrashMultiplier: value } })}
        />
        <Num
          fieldId={`${pid}.maxMultiplier`}
          label="Максимальный коэффициент"
          code="maxMultiplier"
          hint="Жёсткий потолок: выше этого значения шар не долетит."
          value={theme.math.maxMultiplier}
          step={1}
          suffix="×"
          onChange={(value) => onChange({ math: { ...theme.math, maxMultiplier: value } })}
        />
        <Num
          fieldId={`${pid}.multiplierGrowthRate`}
          label="Скорость роста множителя"
          code="multiplierGrowthRate"
          hint="Больше — коэффициент растёт быстрее, у игрока меньше времени на решение."
          value={theme.math.multiplierGrowthRate}
          step={0.01}
          onChange={(value) => onChange({ math: { ...theme.math, multiplierGrowthRate: value } })}
        />
        <Num
          fieldId={`${pid}.delta`}
          label="Шаг отображения коэффициента"
          code="delta"
          hint="Насколько «ступеньками» меняется число на экране. Округление всегда вниз."
          value={theme.math.delta}
          step={0.01}
          onChange={(value) => onChange({ math: { ...theme.math, delta: value } })}
        />
        <Num
          fieldId={`${pid}.maxFlightSeconds`}
          label="Максимальная длительность полёта"
          code="maxFlightSeconds"
          value={theme.math.maxFlightSeconds}
          step={1}
          suffix="с"
          onChange={(value) => onChange({ math: { ...theme.math, maxFlightSeconds: value } })}
        />
        <Num
          fieldId={`${pid}.fps`}
          label="Частота серверных тиков"
          code="fps"
          hint="Технический параметр. На плавность анимации в браузере не влияет."
          value={theme.math.fps}
          step={1}
          suffix="Гц"
          onChange={(value) => onChange({ math: { ...theme.math, fps: value } })}
        />
      </Card>
      </div>
    );
  }

  if (section === 'levels') {
    return (
      <div className="admin__grid">
      <Card
        title={`Коэффициенты уровней (${theme.levelMultipliers.length} из ${expectedLevels})`}
        hint="Каждый уровень — порог коэффициента. Первый уровень открывает кнопку «Забрать». Значения должны расти."
        wide
      >
        <NumberList
          fieldId={`${pid}.levelMultipliers`}
          values={theme.levelMultipliers}
          step={0.05}
          variant="level"
          suffix="×"
          onChange={(values) => onChange({ levelMultipliers: values })}
        />
      </Card>

      <Card
        title="Где чаще выпадает бустер"
        hint="Относительные веса для каждого уровня. Сумма может быть любой — система нормирует их сама."
        wide
      >
        <NumberList
          fieldId={`${pid}.lootProbabilities`}
          values={theme.lootProbabilities}
          step={0.01}
          variant="level"
          onChange={(values) => onChange({ lootProbabilities: values })}
        />
      </Card>

      <Card
        title="Сила бустера"
        hint="Множители для каждого уровня усиления. Первый всегда ×1 — это вариант без бустера."
      >
        <NumberList
          fieldId={`${pid}.boostTierValues`}
          values={theme.boostTierValues}
          step={0.5}
          variant="boost"
          suffix="×"
          onChange={(values) => onChange({ boostTierValues: values })}
        />
      </Card>
      </div>
    );
  }

  return (
    <div className="admin__grid">
      <Card
        title="Варианты ставки"
        hint="Четыре фрагмента на экране выбора ставки. Компенсация риска делает «тяжёлые» варианты чуть опаснее."
        wide
      >
        <div className="admin__options">
          {theme.betOptions.map((option, index) => (
            <div key={option.id} className="admin__option">
              <div className="admin__option-head">
                <strong>Фрагмент {index + 1}</strong>
                <span className="text-xs muted">id: {option.id}</span>
              </div>
              <Num
                fieldId={`${pid}.bet.${index}.cost`}
                label="Стоимость"
                code="cost"
                value={option.cost}
                step={10}
                suffix="б"
                onChange={(value) => {
                  const next = [...theme.betOptions];
                  next[index] = { ...option, cost: value };
                  onChange({ betOptions: next });
                }}
              />
              <Num
                fieldId={`${pid}.bet.${index}.boostTier`}
                label="Уровень бустера"
                code="boostTier"
                hint="Какой tier множителя предлагается вместе с этой ставкой."
                value={option.boostTier}
                step={1}
                onChange={(value) => {
                  const next = [...theme.betOptions];
                  next[index] = { ...option, boostTier: value };
                  onChange({ betOptions: next });
                }}
              />
              <Num
                fieldId={`${pid}.bet.${index}.alphaShift`}
                label="Компенсация риска"
                code="alphaShift"
                hint="Насколько раньше лопается шар с бустером. Подбирается через симулятор RTP."
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

      <Card
        title="Турнирные очки"
        hint="Сколько очков начисляется за действия в раунде. Очки идут в рейтинг и турнирную таблицу."
        wide
      >
        <Num
          fieldId={`${pid}.perLine`}
          label="За каждый пройденный уровень"
          code="perLine"
          value={theme.points.perLine}
          step={1}
          onChange={(value) => onChange({ points: { ...theme.points, perLine: value } })}
        />
        <Num
          fieldId={`${pid}.cashoutBonus`}
          label="За фиксацию выигрыша"
          code="cashoutBonus"
          value={theme.points.cashoutBonus}
          step={1}
          onChange={(value) => onChange({ points: { ...theme.points, cashoutBonus: value } })}
        />
        <p className="text-xs muted admin__section-label">Дополнительно за срабатывание бустера</p>
        <NumberList
          fieldId={`${pid}.boostBonusPerTier`}
          values={theme.points.boostBonusPerTier}
          step={5}
          variant="boost"
          onChange={(values) => onChange({ points: { ...theme.points, boostBonusPerTier: values } })}
        />
      </Card>
    </div>
  );
}

// -------------------------------------------------- редактор общих настроек

function useConfigPatch(config: AdminConfig, onChange: (config: AdminConfig) => void) {
  return <K extends keyof AdminConfig>(key: K, value: AdminConfig[K]) =>
    onChange({ ...config, [key]: value });
}

function RewardEditor({
  config,
  onChange,
}: {
  config: AdminConfig;
  onChange: (config: AdminConfig) => void;
}): JSX.Element {
  const patch = useConfigPatch(config, onChange);

  return (
    <div className="admin__grid admin__grid--single">
      <Card
        title="Коллекционная награда"
        hint="Игрок собирает фрагменты «Карты неба» и получает бонусы за полную коллекцию."
        wide
      >
        <Toggle
          fieldId="reward.enabled"
          label="Награда включена"
          value={config.reward.enabled}
          onChange={(value) => patch('reward', { ...config.reward, enabled: value })}
        />
        <Text
          fieldId="reward.collectionName"
          label="Название коллекции"
          code="collectionName"
          value={config.reward.collectionName}
          onChange={(value) => patch('reward', { ...config.reward, collectionName: value })}
        />
        <Num
          fieldId="reward.collectionSize"
          label="Сколько фрагментов в коллекции"
          code="collectionSize"
          value={config.reward.collectionSize}
          step={1}
          onChange={(value) => patch('reward', { ...config.reward, collectionSize: value })}
        />
        <Num
          fieldId="reward.guaranteedNewChanceOnWin"
          label="Шанс нового фрагмента при победе"
          code="guaranteedNewChanceOnWin"
          value={config.reward.guaranteedNewChanceOnWin}
          step={0.05}
          onChange={(value) => patch('reward', { ...config.reward, guaranteedNewChanceOnWin: value })}
        />
        <Num
          fieldId="reward.guaranteedNewChanceOnLoss"
          label="Шанс нового фрагмента при проигрыше"
          code="guaranteedNewChanceOnLoss"
          value={config.reward.guaranteedNewChanceOnLoss}
          step={0.05}
          onChange={(value) => patch('reward', { ...config.reward, guaranteedNewChanceOnLoss: value })}
        />
        <Num
          fieldId="reward.duplicateCompensationPoints"
          label="Очки за повторный фрагмент"
          code="duplicateCompensationPoints"
          value={config.reward.duplicateCompensationPoints}
          step={5}
          onChange={(value) => patch('reward', { ...config.reward, duplicateCompensationPoints: value })}
        />
        <Num
          fieldId="reward.completionBonusPoints"
          label="Очки за сбор всей коллекции"
          code="completionBonusPoints"
          value={config.reward.completionBonusPoints}
          step={50}
          onChange={(value) => patch('reward', { ...config.reward, completionBonusPoints: value })}
        />
        <Num
          fieldId="reward.completionBonusBalance"
          label="Бонусные баллы за сбор коллекции"
          code="completionBonusBalance"
          value={config.reward.completionBonusBalance}
          step={50}
          suffix="б"
          onChange={(value) => patch('reward', { ...config.reward, completionBonusBalance: value })}
        />
      </Card>
    </div>
  );
}

function UpsellEditor({
  config,
  onChange,
}: {
  config: AdminConfig;
  onChange: (config: AdminConfig) => void;
}): JSX.Element {
  const patch = useConfigPatch(config, onChange);

  return (
    <div className="admin__grid admin__grid--single">
      <Card
        title="Апсейл «Закрепи успех»"
        hint="После крупного выигрыша игроку предлагают обменять часть бонусов на лотерейные билеты."
        wide
      >
        <Toggle
          fieldId="upsell.enabled"
          label="Предложение включено"
          value={config.upsell.enabled}
          onChange={(value) => patch('upsell', { ...config.upsell, enabled: value })}
        />
        <Num
          fieldId="upsell.minWinAmount"
          label="Минимальный выигрыш для показа"
          code="minWinAmount"
          value={config.upsell.minWinAmount}
          step={10}
          suffix="б"
          onChange={(value) => patch('upsell', { ...config.upsell, minWinAmount: value })}
        />
        <Num
          fieldId="upsell.popupTimeoutSeconds"
          label="Время на решение"
          code="popupTimeoutSeconds"
          value={config.upsell.popupTimeoutSeconds}
          step={1}
          suffix="с"
          onChange={(value) => patch('upsell', { ...config.upsell, popupTimeoutSeconds: value })}
        />
        <Num
          fieldId="upsell.ticketPriceBonus"
          label="Цена одного билета"
          code="ticketPriceBonus"
          value={config.upsell.ticketPriceBonus}
          step={5}
          suffix="б"
          onChange={(value) => patch('upsell', { ...config.upsell, ticketPriceBonus: value })}
        />
        <Num
          fieldId="upsell.maxTickets"
          label="Максимум билетов в предложении"
          code="maxTickets"
          value={config.upsell.maxTickets}
          step={1}
          onChange={(value) => patch('upsell', { ...config.upsell, maxTickets: value })}
        />
        <Num
          fieldId="upsell.winShare"
          label="Доля выигрыша в предложении"
          code="winShare"
          hint="Какую часть выигрыша предлагать обменять на билеты (0.5 = половина)."
          value={config.upsell.winShare}
          step={0.05}
          onChange={(value) => patch('upsell', { ...config.upsell, winShare: value })}
        />
      </Card>
    </div>
  );
}

function TournamentEditor({
  config,
  onChange,
}: {
  config: AdminConfig;
  onChange: (config: AdminConfig) => void;
}): JSX.Element {
  const patch = useConfigPatch(config, onChange);

  return (
    <div className="admin__grid admin__grid--single">
      <Card title="Турнир" hint="Живой рейтинг над игровым экраном и таблица лидеров." wide>
        <Toggle
          fieldId="tournament.enabled"
          label="Турнир включён"
          value={config.tournament.enabled}
          onChange={(value) => patch('tournament', { ...config.tournament, enabled: value })}
        />
        <Text
          fieldId="tournament.name"
          label="Название турнира"
          code="name"
          value={config.tournament.name}
          onChange={(value) => patch('tournament', { ...config.tournament, name: value })}
        />
        <Num
          fieldId="tournament.durationDays"
          label="Длительность"
          code="durationDays"
          value={config.tournament.durationDays}
          step={1}
          suffix="дн."
          onChange={(value) => patch('tournament', { ...config.tournament, durationDays: value })}
        />
        <Num
          fieldId="tournament.liveRatingSize"
          label="Игроков в живом рейтинге"
          code="liveRatingSize"
          value={config.tournament.liveRatingSize}
          step={1}
          onChange={(value) => patch('tournament', { ...config.tournament, liveRatingSize: value })}
        />
        <Toggle
          fieldId="tournament.anonymizeNames"
          label="Скрывать имена соперников"
          hint="В рейтинге будут показаны только части ников."
          value={config.tournament.anonymizeNames}
          onChange={(value) => patch('tournament', { ...config.tournament, anonymizeNames: value })}
        />
        <Toggle
          fieldId="tournament.simulation.enabled"
          label="Добавлять ботов в таблицу"
          hint="Чтобы турнир выглядел живым даже с одним игроком."
          value={config.tournament.simulation.enabled}
          onChange={(value) =>
            patch('tournament', {
              ...config.tournament,
              simulation: { ...config.tournament.simulation, enabled: value },
            })
          }
        />
        <Num
          fieldId="tournament.botCount"
          label="Количество ботов"
          code="botCount"
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
    </div>
  );
}

function SessionEditor({
  config,
  onChange,
}: {
  config: AdminConfig;
  onChange: (config: AdminConfig) => void;
}): JSX.Element {
  const patch = useConfigPatch(config, onChange);

  return (
    <div className="admin__grid admin__grid--single">
      <Card title="Интерфейс и демо" hint="Таймауты, подсказки и стартовый баланс для демо-аккаунтов." wide>
        <Num
          fieldId="session.resultIdleTimeoutSeconds"
          label="Автовозврат с экрана результата"
          code="resultIdleTimeoutSeconds"
          hint="Через сколько секунд без действий вернуть игрока к выбору темы."
          value={config.session.resultIdleTimeoutSeconds}
          step={1}
          suffix="с"
          onChange={(value) => patch('session', { ...config.session, resultIdleTimeoutSeconds: value })}
        />
        <Num
          fieldId="session.onboardingHintSeconds"
          label="Длительность подсказки новичку"
          code="onboardingHintSeconds"
          value={config.session.onboardingHintSeconds}
          step={1}
          suffix="с"
          onChange={(value) => patch('session', { ...config.session, onboardingHintSeconds: value })}
        />
        <Num
          fieldId="session.historySize"
          label="Раундов в истории"
          code="historySize"
          value={config.session.historySize}
          step={5}
          onChange={(value) => patch('session', { ...config.session, historySize: value })}
        />
        <Num
          fieldId="session.demoBonusBalance"
          label="Стартовый баланс демо-игроков"
          code="demoBonusBalance"
          value={config.session.demoBonusBalance}
          step={500}
          suffix="б"
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
        fieldId="sim.run"
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
          label="Seed для воспроизводимости"
          code="seed"
          hint="Оставьте 0 для случайного прогона. С фиксированным seed результат повторится один в один."
          value={seed ?? 0}
          step={1}
          onChange={(value) => setSeed(value || null)}
        />
        <Toggle
          label="Использовать несохранённые правки"
          hint={
            dirty
              ? 'Сейчас в форме есть изменения, которые ещё не записаны на сервер.'
              : 'Черновик совпадает с сохранённой конфигурацией.'
          }
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
            <div className="admin__report-meta">
              <span>α = {report.alpha}</span>
              <span>Преимущество заведения = {report.houseEdge}</span>
              <span>Медиана краха ≈ {formatMultiplier(report.theoreticalMedianCrash)}</span>
            </div>
            <div className="admin__table-wrap">
              <table className="admin__table">
                <thead>
                  <tr>
                    <th>Ставка</th>
                    <th>Бустер</th>
                    <th>α эфф.</th>
                    <th>RTP факт</th>
                    <th>RTP теор.</th>
                    <th>Побед</th>
                    <th>Бустер</th>
                    <th>Ср. выход</th>
                    <th>Крах мед.</th>
                    <th>Очки</th>
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
  wide = false,
  fieldId,
  children,
}: {
  title: string;
  hint?: string;
  wide?: boolean;
  fieldId?: string;
  children: React.ReactNode;
}): JSX.Element {
  const highlighted = useFieldHighlighted(fieldId);
  return (
    <section
      id={fieldId ? `admin-field-${fieldId}` : undefined}
      className={`panel panel--pad admin__card${wide ? ' admin__card--wide' : ''}${highlighted ? ' field--highlight' : ''}`}
    >
      <header className="admin__card-head">
        <h3 className="h3">{title}</h3>
        {hint && <p className="text-xs muted">{hint}</p>}
      </header>
      <div className="admin__card-body">{children}</div>
    </section>
  );
}

function Num({
  fieldId,
  label,
  code,
  value,
  step,
  hint,
  suffix,
  onChange,
}: {
  fieldId?: string;
  label: string;
  code?: string;
  value: number;
  step: number;
  hint?: string;
  suffix?: string;
  onChange: (value: number) => void;
}): JSX.Element {
  const highlighted = useFieldHighlighted(fieldId);
  return (
    <label
      id={fieldId ? `admin-field-${fieldId}` : undefined}
      className={`field field--admin${highlighted ? ' field--highlight' : ''}`}
    >
      <div className="field__head">
        <span className="field__label">{label}</span>
        {code && <span className="field__code">{code}</span>}
      </div>
      <div className="field__control">
        <input
          className="input input--num num"
          type="number"
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        {suffix && <span className="field__suffix">{suffix}</span>}
      </div>
      {hint && <span className="field__hint text-xs muted">{hint}</span>}
    </label>
  );
}

function Text({
  fieldId,
  label,
  code,
  value,
  hint,
  onChange,
}: {
  fieldId?: string;
  label: string;
  code?: string;
  value: string;
  hint?: string;
  onChange: (value: string) => void;
}): JSX.Element {
  const highlighted = useFieldHighlighted(fieldId);
  return (
    <label
      id={fieldId ? `admin-field-${fieldId}` : undefined}
      className={`field field--admin${highlighted ? ' field--highlight' : ''}`}
    >
      <div className="field__head">
        <span className="field__label">{label}</span>
        {code && <span className="field__code">{code}</span>}
      </div>
      <input className="input" value={value} onChange={(event) => onChange(event.target.value)} />
      {hint && <span className="field__hint text-xs muted">{hint}</span>}
    </label>
  );
}

function Toggle({
  fieldId,
  label,
  value,
  hint,
  onChange,
}: {
  fieldId?: string;
  label: string;
  value: boolean;
  hint?: string;
  onChange: (value: boolean) => void;
}): JSX.Element {
  const highlighted = useFieldHighlighted(fieldId);
  return (
    <label
      id={fieldId ? `admin-field-${fieldId}` : undefined}
      className={`field field--toggle field--toggle-card${highlighted ? ' field--highlight' : ''}`}
    >
      <div className="field__toggle-copy">
        <span className="field__label">{label}</span>
        {hint && <span className="field__hint text-xs muted">{hint}</span>}
      </div>
      <input
        className="field__switch"
        type="checkbox"
        role="switch"
        checked={value}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

function NumberList({
  fieldId,
  values,
  step,
  variant = 'level',
  suffix,
  onChange,
}: {
  fieldId?: string;
  values: number[];
  step: number;
  variant?: 'level' | 'boost';
  suffix?: string;
  onChange: (values: number[]) => void;
}): JSX.Element {
  const highlighted = useFieldHighlighted(fieldId);
  return (
    <div
      id={fieldId ? `admin-field-${fieldId}` : undefined}
      className={`admin__list admin__list--${variant}${highlighted ? ' field--highlight' : ''}`}
    >
      {values.map((value, index) => (
        <label key={index} className="admin__level-cell">
          <span className="admin__level-badge">
            {variant === 'boost' ? `×${index + 1}` : index + 1}
          </span>
          <div className="field__control">
            <input
              className="input input--num num"
              type="number"
              step={step}
              value={value}
              aria-label={variant === 'boost' ? `Множитель ×${index + 1}` : `Уровень ${index + 1}`}
              onChange={(event) => {
                const next = [...values];
                next[index] = Number(event.target.value);
                onChange(next);
              }}
            />
            {suffix && <span className="field__suffix">{suffix}</span>}
          </div>
        </label>
      ))}
    </div>
  );
}
