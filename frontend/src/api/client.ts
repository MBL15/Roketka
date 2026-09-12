import type {
  AdminConfig,
  AuthResponse,
  CashoutResult,
  ConfigStatus,
  GameSetup,
  HistoryEntry,
  PurchaseResult,
  RatingEntry,
  RoundResult,
  RoundState,
  RuntimeStats,
  SimulationReport,
  StartedRound,
  ThemeKey,
  TournamentTable,
} from './types';

/**
 * Тонкий клиент REST API.
 *
 * Все адреса относительные: в рабочей сборке nginx отдаёт и статику, и /api
 * с одного origin, поэтому ни базового URL, ни CORS в продакшене не нужно.
 */

const TOKEN_STORAGE_KEY = 'balloon.session.token';

/** Ошибка API с машиночитаемым кодом: интерфейс реагирует на код, не на текст. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: string[];

  constructor(status: number, code: string, message: string, details: string[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isInsufficientBalance(): boolean {
    return this.code === 'insufficient_balance';
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isRoundInFlight(): boolean {
    return this.code === 'round_in_flight';
  }
}

let token: string | null = readStoredToken();

function readStoredToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  return token;
}

export function setToken(value: string | null): void {
  token = value;
  try {
    if (value) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, value);
    } else {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    /* приватный режим браузера — работаем без сохранения токена */
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  /** 202 «раунд ещё летит» — не ошибка, а ожидаемое состояние. */
  acceptAccepted?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(path, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (response.status === 204) {
    return undefined as T;
  }
  if (response.status === 202 && !options.acceptAccepted) {
    const payload = await safeJson(response);
    throw new ApiError(202, payload?.error ?? 'round_in_flight', payload?.message ?? 'Раунд ещё летит');
  }

  if (!response.ok) {
    const payload = await safeJson(response);
    throw new ApiError(
      response.status,
      payload?.error ?? 'http_error',
      payload?.message ?? `Ошибка ${response.status}`,
      payload?.details ?? [],
    );
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

async function safeJson(response: Response): Promise<{ error?: string; message?: string; details?: string[] } | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export const api = {
  // ---------------------------------------------------------------- аккаунт
  login: (nickname: string, password: string) =>
    request<AuthResponse>('/api/auth/login', { method: 'POST', body: { nickname, password } }),

  register: (nickname: string, password: string) =>
    request<AuthResponse>('/api/auth/register', { method: 'POST', body: { nickname, password } }),

  me: () => request<AuthResponse['player']>('/api/auth/me'),

  logout: () => request<void>('/api/auth/logout', { method: 'POST' }),

  topUp: (amount: number) =>
    request<AuthResponse['player']>('/api/auth/top-up', { method: 'POST', body: { amount } }),

  // ------------------------------------------------------------------- игра
  setup: () => request<GameSetup>('/api/game/setup'),

  history: (limit = 0) => request<HistoryEntry[]>(`/api/game/history?limit=${limit}`),

  myHistory: (limit = 0) => request<HistoryEntry[]>(`/api/game/history/my?limit=${limit}`),

  // ----------------------------------------------------------------- раунд
  startRound: (
    theme: ThemeKey,
    bet: { betOptionId: number } | { betAmount: number },
    clientSeed?: string,
  ) =>
    request<StartedRound>('/api/rounds', {
      method: 'POST',
      body: { theme, ...bet, clientSeed },
    }),

  activeRound: () => request<RoundState | undefined>('/api/rounds/active'),

  roundState: (roundId: number) => request<RoundState>(`/api/rounds/${roundId}/state`),

  cashout: (roundId: number) =>
    request<CashoutResult>(`/api/rounds/${roundId}/cashout`, { method: 'POST' }),

  roundResult: (roundId: number) => request<RoundResult>(`/api/rounds/${roundId}/result`),

  // ---------------------------------------------------------------- турнир
  liveRating: () => request<RatingEntry[]>('/api/tournament/live'),

  tournamentTable: () => request<TournamentTable>('/api/tournament'),

  // ---------------------------------------------------------------- апсейл
  purchaseTickets: (tickets: number) =>
    request<PurchaseResult>('/api/upsell/purchase', { method: 'POST', body: { tickets } }),

  // -------------------------------------------------------------- админка
  adminConfig: () => request<AdminConfig>('/api/admin/config'),

  adminStatus: () => request<ConfigStatus>('/api/admin/config/status'),

  adminValidate: (config: AdminConfig) =>
    request<{ valid: boolean; errors: string[] }>('/api/admin/config/validate', {
      method: 'POST',
      body: config,
    }),

  adminSave: (config: AdminConfig) =>
    request<AdminConfig>('/api/admin/config', { method: 'PUT', body: config }),

  adminReset: () => request<AdminConfig>('/api/admin/config/reset', { method: 'POST' }),

  adminSimulate: (payload: {
    config?: AdminConfig;
    theme: string;
    strategy: string;
    rounds: number;
    targetMultiplier?: number;
    targetLevel?: number;
    seed?: number | null;
  }) => request<SimulationReport>('/api/admin/simulate', { method: 'POST', body: payload }),

  adminStats: () => request<RuntimeStats>('/api/admin/stats'),
};
