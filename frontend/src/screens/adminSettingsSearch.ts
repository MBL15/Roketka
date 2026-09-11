export type AdminTab =
  | 'green-general'
  | 'green-levels'
  | 'green-economy'
  | 'red-general'
  | 'red-levels'
  | 'red-economy'
  | 'rewards'
  | 'upsell'
  | 'tournament'
  | 'interface'
  | 'sim';

export interface AdminSearchEntry {
  id: string;
  tab: AdminTab;
  group: string;
  section: string;
  label: string;
  code?: string;
  keywords: string[];
}

export const TAB_GROUPS: Array<{ label: string; tabs: Array<[AdminTab, string]> }> = [
  {
    label: 'Зелёный шар',
    tabs: [
      ['green-general', 'Основное'],
      ['green-levels', 'Уровни и бустеры'],
      ['green-economy', 'Ставки и очки'],
    ],
  },
  {
    label: 'Красный шар',
    tabs: [
      ['red-general', 'Основное'],
      ['red-levels', 'Уровни и бустеры'],
      ['red-economy', 'Ставки и очки'],
    ],
  },
  {
    label: 'Общие настройки',
    tabs: [
      ['rewards', 'Коллекция'],
      ['upsell', 'Апсейл'],
      ['tournament', 'Турнир'],
      ['interface', 'Интерфейс'],
      ['sim', 'Симулятор RTP'],
    ],
  },
];

function entry(
  tab: AdminTab,
  section: string,
  label: string,
  id: string,
  code?: string,
  extraKeywords: string[] = [],
): AdminSearchEntry {
  const group = TAB_GROUPS.find((item) => item.tabs.some(([key]) => key === tab))?.label ?? '';
  return {
    id,
    tab,
    group,
    section,
    label,
    code,
    keywords: [label, section, group, code ?? '', ...extraKeywords].filter(Boolean),
  };
}

function themeEntries(prefix: 'green' | 'red', themeLabel: string): AdminSearchEntry[] {
  const general = `${prefix}-general` as AdminTab;
  const levels = `${prefix}-levels` as AdminTab;
  const economy = `${prefix}-economy` as AdminTab;

  return [
    entry(general, 'Основное', 'Название для игроков', `${prefix}.gameName`, 'gameName', [themeLabel, 'название']),
    entry(general, 'Основное', 'Системный идентификатор', `${prefix}.gameId`, 'gameId', ['id']),
    entry(general, 'Основное', 'Тип игры', `${prefix}.gameType`, 'gameType', ['crash']),
    entry(general, 'Основное', 'Тема доступна игрокам', `${prefix}.active`, 'active', ['включить', 'доступ']),
    entry(general, 'Математика раунда', 'Крутизна распределения', `${prefix}.alpha`, 'alpha', ['rtp', 'математика', 'распределение']),
    entry(general, 'Математика раунда', 'Преимущество заведения', `${prefix}.houseEdge`, 'houseEdge', ['rtp', 'edge', 'заведение']),
    entry(general, 'Математика раунда', 'Минимальный коэффициент краха', `${prefix}.minCrashMultiplier`, 'minCrashMultiplier', ['крах', 'минимум']),
    entry(general, 'Математика раунда', 'Максимальный коэффициент', `${prefix}.maxMultiplier`, 'maxMultiplier', ['потолок', 'максимум']),
    entry(general, 'Математика раунда', 'Скорость роста множителя', `${prefix}.multiplierGrowthRate`, 'multiplierGrowthRate', ['рост', 'скорость']),
    entry(general, 'Математика раунда', 'Шаг отображения коэффициента', `${prefix}.delta`, 'delta', ['округление']),
    entry(general, 'Математика раунда', 'Максимальная длительность полёта', `${prefix}.maxFlightSeconds`, 'maxFlightSeconds', ['время', 'полёт']),
    entry(general, 'Математика раунда', 'Частота серверных тиков', `${prefix}.fps`, 'fps', ['сервер', 'тики']),
    entry(levels, 'Коэффициенты уровней', 'Пороги коэффициентов по уровням', `${prefix}.levelMultipliers`, 'levelMultipliers', ['уровни', 'лестница']),
    entry(levels, 'Где чаще выпадает бустер', 'Вероятность бустера по уровням', `${prefix}.lootProbabilities`, 'lootProbabilities', ['бустер', 'loot', 'вес']),
    entry(levels, 'Сила бустера', 'Множители бустера', `${prefix}.boostTierValues`, 'boostTierValues', ['усиление', 'множитель']),
    ...[1, 2, 3, 4].flatMap((index) => [
      entry(economy, `Фрагмент ${index}`, 'Стоимость фрагмента', `${prefix}.bet.${index - 1}.cost`, 'cost', ['ставка', 'цена', 'фрагмент']),
      entry(economy, `Фрагмент ${index}`, 'Уровень бустера фрагмента', `${prefix}.bet.${index - 1}.boostTier`, 'boostTier', ['бустер', 'ставка']),
      entry(economy, `Фрагмент ${index}`, 'Компенсация риска фрагмента', `${prefix}.bet.${index - 1}.alphaShift`, 'alphaShift', ['риск', 'alpha']),
    ]),
    entry(economy, 'Турнирные очки', 'Очки за пройденный уровень', `${prefix}.perLine`, 'perLine', ['очки', 'турнир']),
    entry(economy, 'Турнирные очки', 'Очки за фиксацию выигрыша', `${prefix}.cashoutBonus`, 'cashoutBonus', ['cashout', 'забрать']),
    entry(economy, 'Турнирные очки', 'Очки за срабатывание бустера', `${prefix}.boostBonusPerTier`, 'boostBonusPerTier', ['бустер', 'очки']),
  ];
}

export const ADMIN_SEARCH_INDEX: AdminSearchEntry[] = [
  ...themeEntries('green', 'зелёный'),
  ...themeEntries('red', 'красный'),
  entry('rewards', 'Коллекционная награда', 'Награда включена', 'reward.enabled', 'enabled', ['коллекция', 'фрагмент']),
  entry('rewards', 'Коллекционная награда', 'Название коллекции', 'reward.collectionName', 'collectionName', ['карта неба']),
  entry('rewards', 'Коллекционная награда', 'Сколько фрагментов в коллекции', 'reward.collectionSize', 'collectionSize', ['размер']),
  entry('rewards', 'Коллекционная награда', 'Шанс нового фрагмента при победе', 'reward.guaranteedNewChanceOnWin', 'guaranteedNewChanceOnWin', ['победа']),
  entry('rewards', 'Коллекционная награда', 'Шанс нового фрагмента при проигрыше', 'reward.guaranteedNewChanceOnLoss', 'guaranteedNewChanceOnLoss', ['проигрыш']),
  entry('rewards', 'Коллекционная награда', 'Очки за повторный фрагмент', 'reward.duplicateCompensationPoints', 'duplicateCompensationPoints', ['дубликат']),
  entry('rewards', 'Коллекционная награда', 'Очки за сбор всей коллекции', 'reward.completionBonusPoints', 'completionBonusPoints', ['сбор']),
  entry('rewards', 'Коллекционная награда', 'Бонусные баллы за сбор коллекции', 'reward.completionBonusBalance', 'completionBonusBalance', ['бонусы']),
  entry('upsell', 'Апсейл «Закрепи успех»', 'Предложение включено', 'upsell.enabled', 'enabled', ['апсейл', 'билеты']),
  entry('upsell', 'Апсейл «Закрепи успех»', 'Минимальный выигрыш для показа', 'upsell.minWinAmount', 'minWinAmount', ['выигрыш', 'порог']),
  entry('upsell', 'Апсейл «Закрепи успех»', 'Время на решение', 'upsell.popupTimeoutSeconds', 'popupTimeoutSeconds', ['таймер', 'таймаут']),
  entry('upsell', 'Апсейл «Закрепи успех»', 'Цена одного билета', 'upsell.ticketPriceBonus', 'ticketPriceBonus', ['билет', 'цена']),
  entry('upsell', 'Апсейл «Закрепи успех»', 'Максимум билетов в предложении', 'upsell.maxTickets', 'maxTickets', ['билеты']),
  entry('upsell', 'Апсейл «Закрепи успех»', 'Доля выигрыша в предложении', 'upsell.winShare', 'winShare', ['доля', 'обмен']),
  entry('tournament', 'Турнир', 'Турнир включён', 'tournament.enabled', 'enabled', ['рейтинг', 'лидеры']),
  entry('tournament', 'Турнир', 'Название турнира', 'tournament.name', 'name', ['кубок']),
  entry('tournament', 'Турнир', 'Длительность турнира', 'tournament.durationDays', 'durationDays', ['дни']),
  entry('tournament', 'Турнир', 'Игроков в живом рейтинге', 'tournament.liveRatingSize', 'liveRatingSize', ['топ']),
  entry('tournament', 'Турнир', 'Скрывать имена соперников', 'tournament.anonymizeNames', 'anonymizeNames', ['аноним', 'маска']),
  entry('tournament', 'Турнир', 'Добавлять ботов в таблицу', 'tournament.simulation.enabled', 'simulation.enabled', ['боты']),
  entry('tournament', 'Турнир', 'Количество ботов', 'tournament.botCount', 'botCount', ['боты']),
  entry('interface', 'Интерфейс и демо', 'Автовозврат с экрана результата', 'session.resultIdleTimeoutSeconds', 'resultIdleTimeoutSeconds', ['таймаут', 'результат']),
  entry('interface', 'Интерфейс и демо', 'Длительность подсказки новичку', 'session.onboardingHintSeconds', 'onboardingHintSeconds', ['подсказка', 'онбординг']),
  entry('interface', 'Интерфейс и демо', 'Раундов в истории', 'session.historySize', 'historySize', ['история', 'лента']),
  entry('interface', 'Интерфейс и демо', 'Стартовый баланс демо-игроков', 'session.demoBonusBalance', 'demoBonusBalance', ['демо', 'баланс']),
  entry('sim', 'Симулятор RTP', 'Параметры прогона симуляции', 'sim.run', undefined, ['monte carlo', 'rtp', 'симулятор', 'прогон']),
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .trim();
}

function scoreEntry(entry: AdminSearchEntry, tokens: string[]): number {
  const haystack = normalize(
    [entry.label, entry.section, entry.group, entry.code ?? '', ...entry.keywords].join(' '),
  );

  let score = 0;
  for (const token of tokens) {
    if (!token) continue;
    if (entry.code && normalize(entry.code) === token) score += 120;
    if (normalize(entry.label).startsWith(token)) score += 80;
    if (normalize(entry.label).includes(token)) score += 50;
    if (haystack.includes(token)) score += 30;
  }
  return score;
}

export function searchAdminSettings(query: string, limit = 10): AdminSearchEntry[] {
  const normalized = normalize(query);
  if (!normalized) {
    return [];
  }

  const tokens = normalized.split(/\s+/).filter(Boolean);
  return ADMIN_SEARCH_INDEX.filter((item) => scoreEntry(item, tokens) > 0)
    .sort((left, right) => scoreEntry(right, tokens) - scoreEntry(left, tokens))
    .slice(0, limit);
}

export function adminTabLabel(tab: AdminTab): string {
  for (const group of TAB_GROUPS) {
    for (const [key, label] of group.tabs) {
      if (key === tab) {
        return `${group.label} → ${label}`;
      }
    }
  }
  return tab;
}
