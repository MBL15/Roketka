import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import { ApiError, api, setToken } from '../api/client';
import { gameSocket, type SocketStatus } from '../api/socket';
import { audio } from '../audio/AudioEngine';
import type {
  Achievement,
  CashoutResult,
  GameSetup,
  HistoryEntry,
  Player,
  RatingEntry,
  RoundResult,
  ThemeKey,
  ThemeSetup,
} from '../api/types';
import { flightFromStart, flightFromState, type Flight } from './flight';

export type Phase = 'boot' | 'login' | 'theme' | 'bet' | 'game' | 'result' | 'profile';

export interface Toast {
  id: number;
  tone: 'info' | 'success' | 'error' | 'boost';
  title: string;
  body?: string;
}

interface State {
  phase: Phase;
  player: Player | null;
  setup: GameSetup | null;
  theme: ThemeKey;
  flight: Flight | null;
  result: RoundResult | null;
  lastBetOptionId: number | null;
  lastBetAmount: number | null;
  history: HistoryEntry[];
  rating: RatingEntry[];
  socketStatus: SocketStatus;
  toasts: Toast[];
  busy: boolean;
  /** Коэффициент автозабора; null — только вручную. */
  autoCashoutMultiplier: number | null;
}

type Action =
  | { type: 'phase'; phase: Phase }
  | { type: 'player'; player: Player | null }
  | { type: 'setup'; setup: GameSetup }
  | { type: 'theme'; theme: ThemeKey }
  | { type: 'flight'; flight: Flight | null }
  | { type: 'result'; result: RoundResult | null }
  | { type: 'lastBet'; optionId: number | null; amount: number | null }
  | { type: 'history'; history: HistoryEntry[] }
  | { type: 'rating'; rating: RatingEntry[] }
  | { type: 'socket'; status: SocketStatus }
  | { type: 'balance'; balance: number; points?: number }
  | {
      type: 'progression';
      playerLevel: number;
      playerXp: number;
      xpToNextLevel: number;
      displayProfitBonus: number;
    }
  | { type: 'tickets'; tickets: number; balance: number }
  | { type: 'achievements'; achievements: Achievement[] }
  | { type: 'toast'; toast: Toast }
  | { type: 'dismiss'; id: number }
  | { type: 'busy'; busy: boolean }
  | { type: 'autoCashout'; value: number | null }
  | { type: 'signedOut' };

const initialState: State = {
  phase: 'boot',
  player: null,
  setup: null,
  theme: 'green',
  flight: null,
  result: null,
  lastBetOptionId: null,
  lastBetAmount: null,
  history: [],
  rating: [],
  socketStatus: 'closed',
  toasts: [],
  busy: false,
  autoCashoutMultiplier: null,
};

function isThemeAvailable(setup: GameSetup | null, theme: ThemeKey): boolean {
  return setup?.themes.some((item) => item.key === theme) ?? false;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'phase':
      return { ...state, phase: action.phase };
    case 'player':
      return { ...state, player: action.player };
    case 'setup':
      return { ...state, setup: action.setup };
    case 'theme':
      return { ...state, theme: action.theme };
    case 'flight':
      return { ...state, flight: action.flight };
    case 'result':
      return { ...state, result: action.result };
    case 'lastBet':
      return { ...state, lastBetOptionId: action.optionId, lastBetAmount: action.amount };
    case 'history':
      return { ...state, history: action.history };
    case 'rating':
      return { ...state, rating: action.rating };
    case 'socket':
      return { ...state, socketStatus: action.status };
    case 'balance':
      return state.player
        ? {
            ...state,
            player: {
              ...state.player,
              bonusBalance: action.balance,
              gamePoints: action.points ?? state.player.gamePoints,
            },
          }
        : state;
    case 'progression':
      return state.player
        ? {
            ...state,
            player: {
              ...state.player,
              playerLevel: action.playerLevel,
              playerXp: action.playerXp,
              xpToNextLevel: action.xpToNextLevel,
              displayProfitBonus: action.displayProfitBonus,
            },
          }
        : state;
    case 'tickets':
      return state.player
        ? {
            ...state,
            player: { ...state.player, lotteryTickets: action.tickets, bonusBalance: action.balance },
          }
        : state;
    case 'achievements':
      return state.player
        ? {
            ...state,
            player: { ...state.player, achievements: action.achievements },
          }
        : state;
    case 'toast':
      return { ...state, toasts: [...state.toasts, action.toast].slice(-4) };
    case 'dismiss':
      return { ...state, toasts: state.toasts.filter((toast) => toast.id !== action.id) };
    case 'busy':
      return { ...state, busy: action.busy };
    case 'autoCashout':
      return { ...state, autoCashoutMultiplier: action.value };
    case 'signedOut':
      return { ...initialState, phase: 'login' };
    default:
      return state;
  }
}

export type StartBetParams = { betOptionId: number } | { betAmount: number };

interface GameContextValue extends State {
  currentTheme: ThemeSetup | null;
  themeOf: (key: ThemeKey) => ThemeSetup | null;
  login: (nickname: string, password: string) => Promise<void>;
  register: (nickname: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  topUp: () => Promise<void>;
  chooseTheme: (theme: ThemeKey) => void;
  switchTheme: (theme: ThemeKey) => void;
  goTo: (phase: Phase) => void;
  startRound: (bet: StartBetParams) => Promise<void>;
  finishRound: (roundId: number) => Promise<void>;
  playAgain: () => void;
  repeatBet: () => Promise<void>;
  /** Применяет покупку билетов из апсейла к профилю игрока. */
  applyPurchase: (totalTickets: number, balance: number) => void;
  applyCashoutProgression: (result: Pick<
    CashoutResult,
    | 'balance'
    | 'playerLevel'
    | 'playerXp'
    | 'xpToNextLevel'
    | 'displayProfitBonus'
    | 'levelUp'
    | 'xpGained'
    | 'newAchievements'
  >) => void;
  refreshSetup: () => Promise<void>;
  refreshHistory: () => Promise<void>;
  notify: (toast: Omit<Toast, 'id'>) => void;
  dismissToast: (id: number) => void;
  setAutoCashout: (value: number | null) => void;
}

const GameContext = createContext<GameContextValue | null>(null);

let toastSequence = 0;

export function GameProvider({ children }: { children: ReactNode }): JSX.Element {
  const [state, dispatch] = useReducer(reducer, initialState);
  const phaseRef = useRef<Phase>(state.phase);
  phaseRef.current = state.phase;
  const toastedAchievementsRef = useRef<Set<string>>(new Set());

  const notify = useCallback((toast: Omit<Toast, 'id'>) => {
    toastSequence += 1;
    const id = toastSequence;
    dispatch({ type: 'toast', toast: { ...toast, id } });
    window.setTimeout(() => dispatch({ type: 'dismiss', id }), 4200);
  }, []);

  const notifyAchievements = useCallback(
    (items: Achievement[] | undefined, mergeIntoPlayer = true) => {
      if (!items || items.length === 0) {
        return;
      }
      if (mergeIntoPlayer) {
        dispatch({ type: 'achievements', achievements: mergeAchievements(state.player?.achievements ?? [], items) });
      }
      for (const achievement of items) {
        if (toastedAchievementsRef.current.has(achievement.id)) {
          continue;
        }
        toastedAchievementsRef.current.add(achievement.id);
        audio.reward();
        notify({
          tone: 'success',
          title: `${achievement.icon} ${achievement.title}`,
          body: achievement.description,
        });
      }
    },
    [notify, state.player?.achievements],
  );

  const dismissToast = useCallback((id: number) => dispatch({ type: 'dismiss', id }), []);

  const reportError = useCallback(
    (error: unknown, fallback: string) => {
      if (error instanceof ApiError) {
        if (error.isUnauthorized) {
          setToken(null);
          gameSocket.disconnect();
          dispatch({ type: 'signedOut' });
          notify({ tone: 'error', title: 'Сессия истекла', body: 'Войдите в игру заново' });
          return;
        }
        audio.error();
        notify({
          tone: 'error',
          title: error.isInsufficientBalance ? 'Не хватает бонусов' : fallback,
          body: error.message,
        });
        return;
      }
      audio.error();
      notify({ tone: 'error', title: fallback, body: String(error) });
    },
    [notify],
  );

  // ---------------------------------------------------------------- загрузка

  const loadSnapshot = useCallback(async (): Promise<void> => {
    const [setup, history, rating] = await Promise.all([api.setup(), api.history(), api.liveRating()]);
    dispatch({ type: 'setup', setup });
    dispatch({ type: 'history', history });
    dispatch({ type: 'rating', rating });
    return undefined;
  }, []);

  const refreshSetup = useCallback(async () => {
    try {
      const setup = await api.setup();
      dispatch({ type: 'setup', setup });
    } catch (error) {
      reportError(error, 'Не удалось обновить параметры игры');
    }
  }, [reportError]);

  /** Если текущая тема отключена в конфиге — возвращаем игрока к выбору неба. */
  useEffect(() => {
    if (!state.setup) {
      return;
    }
    if (state.phase !== 'bet' && state.phase !== 'result') {
      return;
    }
    if (isThemeAvailable(state.setup, state.theme)) {
      return;
    }
    dispatch({ type: 'phase', phase: 'theme' });
    notify({
      tone: 'info',
      title: 'Тема недоступна',
      body: 'Эта тема отключена администратором. Выберите другую.',
    });
  }, [notify, state.phase, state.setup, state.theme]);

  const refreshHistory = useCallback(async () => {
    try {
      const history = await api.history();
      dispatch({ type: 'history', history });
    } catch {
      /* история не критична: молча оставляем предыдущую */
    }
  }, []);

  /** Восстановление сеанса при загрузке страницы. */
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      if (!localStorage.getItem('balloon.session.token')) {
        dispatch({ type: 'phase', phase: 'login' });
        return;
      }
      try {
        const player = await api.me();
        if (cancelled) return;
        dispatch({ type: 'player', player });
        await loadSnapshot();
        if (cancelled) return;
        gameSocket.connect();

        // Незавершённый раунд возвращает игрока прямо в полёт.
        const active = await api.activeRound();
        if (cancelled) return;
        if (active) {
          const setup = await api.setup();
          const theme = setup.themes.find((item) => item.key === active.theme);
          dispatch({ type: 'theme', theme: active.theme });
          dispatch({
            type: 'flight',
            flight: flightFromState(active, theme?.points ?? { perLine: 0, cashoutBonus: 0, boostBonusPerTier: [] }),
          });
          dispatch({ type: 'phase', phase: 'game' });
          notify({ tone: 'info', title: 'Возвращаем вас в полёт', body: 'Раунд не был завершён' });
          return;
        }
        dispatch({ type: 'phase', phase: 'theme' });
      } catch (error) {
        if (cancelled) return;
        setToken(null);
        dispatch({ type: 'phase', phase: 'login' });
        if (!(error instanceof ApiError && error.isUnauthorized)) {
          reportError(error, 'Не удалось восстановить сессию');
        }
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, [loadSnapshot, notify, reportError]);

  // ---------------------------------------------------- подписка на сокет

  useEffect(() => gameSocket.onStatus((status) => dispatch({ type: 'socket', status })), []);

  /** Резервный опрос живого рейтинга (~1 с), если WebSocket недоступен. */
  useEffect(() => {
    if (state.phase !== 'game' || !state.setup?.tournament.enabled) {
      return undefined;
    }

    let cancelled = false;
    const poll = window.setInterval(() => {
      if (cancelled || state.socketStatus === 'open') {
        return;
      }
      void api
        .liveRating()
        .then((entries) => {
          if (cancelled) {
            return;
          }
          dispatch({
            type: 'rating',
            rating: entries.map((entry) => ({
              ...entry,
              current: entry.userId === playerIdRef.current,
            })),
          });
        })
        .catch(() => undefined);
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, [state.phase, state.setup?.tournament.enabled, state.socketStatus]);

  const playerIdRef = useRef<number | null>(state.player?.id ?? null);
  playerIdRef.current = state.player?.id ?? null;

  useEffect(
    () =>
      gameSocket.onMessage((message) => {
        switch (message.type) {
          case 'rating.updated':
            dispatch({
              type: 'rating',
              rating: message.entries.map((entry) => ({
                ...entry,
                current: entry.userId === playerIdRef.current,
              })),
            });
            break;
          case 'history.updated':
            void refreshHistory();
            break;
          case 'config.updated':
            void refreshSetup();
            if (phaseRef.current !== 'game') {
              notify({ tone: 'info', title: 'Параметры игры обновлены', body: 'Новые настройки применены' });
            }
            break;
          case 'achievement.unlocked':
            notifyAchievements([
              {
                id: message.achievementId,
                title: message.title,
                description: message.description,
                icon: message.icon,
                category: 'flight',
                unlocked: true,
                unlockedAt: new Date().toISOString(),
              },
            ]);
            break;
          default:
            break;
        }
      }),
    [notify, notifyAchievements, refreshHistory, refreshSetup, state.player?.id],
  );

  // ------------------------------------------------------------- действия

  const login = useCallback(
    async (nickname: string, password: string) => {
      dispatch({ type: 'busy', busy: true });
      try {
        const response = await api.login(nickname, password);
        setToken(response.token);
        dispatch({ type: 'player', player: response.player });
        await loadSnapshot();
        gameSocket.connect();
        dispatch({ type: 'phase', phase: 'theme' });
        audio.waterDrop();
      } catch (error) {
        reportError(error, 'Не удалось войти');
      } finally {
        dispatch({ type: 'busy', busy: false });
      }
    },
    [loadSnapshot, reportError],
  );

  const register = useCallback(
    async (nickname: string, password: string) => {
      dispatch({ type: 'busy', busy: true });
      try {
        const response = await api.register(nickname, password);
        setToken(response.token);
        dispatch({ type: 'player', player: response.player });
        await loadSnapshot();
        gameSocket.connect();
        dispatch({ type: 'phase', phase: 'theme' });
        notify({
          tone: 'success',
          title: `Добро пожаловать, ${response.player.nickname}`,
          body: `Начислено ${response.player.bonusBalance} бонусных баллов`,
        });
      } catch (error) {
        reportError(error, 'Не удалось зарегистрироваться');
      } finally {
        dispatch({ type: 'busy', busy: false });
      }
    },
    [loadSnapshot, notify, reportError],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* сессия могла истечь сама — всё равно выходим */
    }
    setToken(null);
    gameSocket.disconnect();
    audio.stopAmbient();
    dispatch({ type: 'signedOut' });
  }, []);

  const topUp = useCallback(async () => {
    try {
      const player = await api.topUp(2000);
      dispatch({ type: 'player', player });
      await refreshSetup();
      notify({ tone: 'success', title: 'Баланс пополнен', body: '+2000 бонусных баллов' });
    } catch (error) {
      reportError(error, 'Не удалось пополнить баланс');
    }
  }, [notify, refreshSetup, reportError]);

  const chooseTheme = useCallback(
    (theme: ThemeKey) => {
      if (!isThemeAvailable(state.setup, theme)) {
        notify({
          tone: 'error',
          title: 'Тема недоступна',
          body: 'Эта тема отключена администратором.',
        });
        dispatch({ type: 'phase', phase: 'theme' });
        return;
      }
      audio.waterDrop();
      dispatch({ type: 'theme', theme });
      dispatch({ type: 'phase', phase: 'bet' });
    },
    [notify, state.setup],
  );

  const switchTheme = useCallback(
    (theme: ThemeKey) => {
      if (!isThemeAvailable(state.setup, theme)) {
        notify({
          tone: 'error',
          title: 'Тема недоступна',
          body: 'Эта тема отключена администратором.',
        });
        return;
      }
      audio.click();
      dispatch({ type: 'theme', theme });
    },
    [notify, state.setup],
  );

  const goTo = useCallback((phase: Phase) => dispatch({ type: 'phase', phase }), []);

  const setAutoCashout = useCallback((value: number | null) => {
    dispatch({ type: 'autoCashout', value });
  }, []);

  const startRound = useCallback(
    async (bet: StartBetParams) => {
      dispatch({ type: 'busy', busy: true });
      try {
        const round = await api.startRound(state.theme, bet);
        toastedAchievementsRef.current.clear();
        audio.launch();
        if ('betOptionId' in bet) {
          dispatch({ type: 'lastBet', optionId: bet.betOptionId, amount: null });
        } else {
          dispatch({ type: 'lastBet', optionId: null, amount: bet.betAmount });
        }
        dispatch({ type: 'flight', flight: flightFromStart(round) });
        dispatch({ type: 'result', result: null });
        dispatch({ type: 'balance', balance: round.balance });
        dispatch({ type: 'phase', phase: 'game' });
      } catch (error) {
        reportError(error, 'Не удалось начать раунд');
      } finally {
        dispatch({ type: 'busy', busy: false });
      }
    },
    [reportError, state.theme],
  );

  /** Вызывается после краха: забирает итоговый результат и открывает экран. */
  const finishRound = useCallback(
    async (roundId: number) => {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        try {
          const result = await api.roundResult(roundId);
          dispatch({ type: 'result', result });
          dispatch({ type: 'balance', balance: result.balance, points: result.gamePoints });
          dispatch({
            type: 'progression',
            playerLevel: result.playerLevel,
            playerXp: result.playerXp,
            xpToNextLevel: result.xpToNextLevel,
            displayProfitBonus: result.displayProfitBonus,
          });
          dispatch({ type: 'flight', flight: null });
          dispatch({ type: 'phase', phase: 'result' });
          if (result.reward.collectionCompleted) {
            audio.reward();
          }
          notifyAchievements(result.newAchievements);
          void refreshHistory();
          void refreshSetup();
          try {
            const freshPlayer = await api.me();
            dispatch({ type: 'player', player: freshPlayer });
          } catch {
            /* профиль обновится при следующем запросе */
          }
          return;
        } catch (error) {
          // Расчёт раунда идёт в отдельном потоке: короткая пауза и повтор.
          if (error instanceof ApiError && error.isRoundInFlight) {
            await new Promise((resolve) => window.setTimeout(resolve, 180));
            continue;
          }
          reportError(error, 'Не удалось получить результат раунда');
          dispatch({ type: 'flight', flight: null });
          dispatch({ type: 'phase', phase: 'bet' });
          return;
        }
      }
      notify({ tone: 'error', title: 'Результат задерживается', body: 'Попробуйте открыть историю игр' });
      dispatch({ type: 'flight', flight: null });
      dispatch({ type: 'phase', phase: 'bet' });
    },
    [notify, notifyAchievements, refreshHistory, refreshSetup, reportError],
  );

  const playAgain = useCallback(() => {
    audio.click();
    dispatch({ type: 'result', result: null });
    if (!isThemeAvailable(state.setup, state.theme)) {
      dispatch({ type: 'phase', phase: 'theme' });
      return;
    }
    dispatch({ type: 'phase', phase: 'bet' });
  }, [state.setup, state.theme]);

  const applyPurchase = useCallback(
    (totalTickets: number, balance: number) => {
      dispatch({ type: 'tickets', tickets: totalTickets, balance });
      notify({ tone: 'success', title: 'Билеты добавлены', body: 'Проверить их можно в профиле' });
    },
    [notify],
  );

  const applyCashoutProgression = useCallback(
    (
      result: Pick<
        CashoutResult,
        | 'balance'
        | 'playerLevel'
        | 'playerXp'
        | 'xpToNextLevel'
        | 'displayProfitBonus'
        | 'levelUp'
        | 'xpGained'
        | 'newAchievements'
      >,
    ) => {
      dispatch({ type: 'balance', balance: result.balance });
      dispatch({
        type: 'progression',
        playerLevel: result.playerLevel,
        playerXp: result.playerXp,
        xpToNextLevel: result.xpToNextLevel,
        displayProfitBonus: result.displayProfitBonus,
      });
      notifyAchievements(result.newAchievements);
      if (result.levelUp) {
        notify({
          tone: 'success',
          title: `Уровень ${result.playerLevel}`,
          body: `Новый бонус к профиту: +${result.displayProfitBonus.toFixed(2)}×`,
        });
      } else if (result.xpGained > 0) {
        notify({
          tone: 'info',
          title: `+${result.xpGained} опыта`,
          body: `${result.playerXp} / ${result.xpToNextLevel} до следующего уровня`,
        });
      }
    },
    [notify, notifyAchievements],
  );

  const repeatBet = useCallback(async () => {
    if (state.lastBetOptionId === null && state.lastBetAmount === null) {
      dispatch({ type: 'phase', phase: 'bet' });
      return;
    }
    dispatch({ type: 'result', result: null });
    if (state.lastBetOptionId !== null) {
      await startRound({ betOptionId: state.lastBetOptionId });
      return;
    }
    if (state.lastBetAmount !== null) {
      await startRound({ betAmount: state.lastBetAmount });
    }
  }, [startRound, state.lastBetAmount, state.lastBetOptionId]);

  // --------------------------------------------------------------- контекст

  const themeOf = useCallback(
    (key: ThemeKey) =>
      isThemeAvailable(state.setup, key)
        ? (state.setup?.themes.find((theme) => theme.key === key) ?? null)
        : null,
    [state.setup],
  );

  const value = useMemo<GameContextValue>(
    () => ({
      ...state,
      currentTheme: themeOf(state.theme),
      themeOf,
      login,
      register,
      logout,
      topUp,
      chooseTheme,
      switchTheme,
      goTo,
      startRound,
      finishRound,
      playAgain,
      repeatBet,
      applyPurchase,
      applyCashoutProgression,
      refreshSetup,
      refreshHistory,
      notify,
      dismissToast,
      setAutoCashout,
    }),
    [
      applyPurchase,
      applyCashoutProgression,
      chooseTheme,
      dismissToast,
      finishRound,
      goTo,
      login,
      logout,
      notify,
      playAgain,
      refreshHistory,
      refreshSetup,
      register,
      repeatBet,
      setAutoCashout,
      startRound,
      state,
      switchTheme,
      themeOf,
      topUp,
    ],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame должен вызываться внутри GameProvider');
  }
  return context;
}

function mergeAchievements(current: Achievement[], unlocked: Achievement[]): Achievement[] {
  const patch = new Map(unlocked.map((item) => [item.id, item]));
  if (current.length === 0) {
    return unlocked;
  }
  return current.map((item) => {
    const update = patch.get(item.id);
    return update ? { ...item, ...update, unlocked: true } : item;
  });
}
