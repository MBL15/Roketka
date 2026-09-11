import { getToken } from './client';

/**
 * Канал реального времени.
 *
 * Соединение переподключается с экспоненциальной задержкой, а если сокет
 * недоступен вовсе (прокси, корпоративная сеть, отключённый upgrade), вызывающий
 * код переходит на опрос REST — см. useFlight. Поэтому здесь нет ни одной
 * критичной для игры операции: сокет только ускоряет доставку.
 */

export type SocketMessage =
  | { type: 'connected'; userId: number; nickname: string; serverTimeMillis: number }
  | { type: 'pong'; serverTimeMillis: number }
  | {
      type: 'round.tick';
      roundId: number;
      multiplier: number;
      baseMultiplier: number;
      levelsPassed: number;
      boostApplied: boolean;
      points: number;
      elapsedSeconds: number;
      livePoints: number;
      serverTimeMillis: number;
    }
  | {
      type: 'round.level';
      roundId: number;
      level: number;
      levelCount: number;
      pointsAwarded: number;
      totalPoints: number;
      livePoints: number;
    }
  | {
      type: 'round.boost';
      roundId: number;
      level: number;
      boostValue: number;
      multiplier: number;
      pointsAwarded: number;
      totalPoints: number;
      livePoints: number;
    }
  | {
      type: 'round.cashout';
      roundId: number;
      multiplier: number;
      payout: number;
      balance: number;
      totalPoints: number;
    }
  | { type: 'round.crash'; roundId: number; crashMultiplier: number; won: boolean }
  | { type: 'round.settled'; roundId: number }
  | { type: 'history.updated'; roundId: number }
  | {
      type: 'rating.updated';
      entries: Array<{
        userId: number;
        displayName: string;
        points: number;
        position: number;
        bot: boolean;
      }>;
    }
  | { type: 'config.updated'; revision: number; source: string };

export type SocketStatus = 'connecting' | 'open' | 'closed';

type MessageListener = (message: SocketMessage) => void;
type StatusListener = (status: SocketStatus) => void;

const RECONNECT_STEPS_MS = [500, 1000, 2000, 4000, 8000];
const HEARTBEAT_MS = 25_000;

class GameSocket {
  private socket: WebSocket | null = null;
  private readonly messageListeners = new Set<MessageListener>();
  private readonly statusListeners = new Set<StatusListener>();
  private reconnectAttempt = 0;
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private status: SocketStatus = 'closed';
  private manualClose = false;

  connect(): void {
    const token = getToken();
    if (!token || this.socket) {
      return;
    }
    this.manualClose = false;
    this.setStatus('connecting');

    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${scheme}://${window.location.host}/ws/game?token=${encodeURIComponent(token)}`;
    const socket = new WebSocket(url);
    this.socket = socket;

    socket.onopen = () => {
      this.reconnectAttempt = 0;
      this.setStatus('open');
      this.startHeartbeat();
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string) as SocketMessage;
        this.messageListeners.forEach((listener) => listener(message));
      } catch {
        /* нечитаемый кадр игнорируем: авторитетное состояние всё равно на сервере */
      }
    };

    socket.onclose = () => {
      this.socket = null;
      this.stopHeartbeat();
      this.setStatus('closed');
      if (!this.manualClose) {
        this.scheduleReconnect();
      }
    };

    socket.onerror = () => {
      socket.close();
    };
  }

  disconnect(): void {
    this.manualClose = true;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();
    this.socket?.close();
    this.socket = null;
    this.setStatus('closed');
  }

  onMessage(listener: MessageListener): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  get currentStatus(): SocketStatus {
    return this.status;
  }

  private setStatus(status: SocketStatus): void {
    this.status = status;
    this.statusListeners.forEach((listener) => listener(status));
  }

  private scheduleReconnect(): void {
    const delay = RECONNECT_STEPS_MS[Math.min(this.reconnectAttempt, RECONNECT_STEPS_MS.length - 1)];
    this.reconnectAttempt += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = window.setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'ping' }));
      }
    }, HEARTBEAT_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

export const gameSocket = new GameSocket();
