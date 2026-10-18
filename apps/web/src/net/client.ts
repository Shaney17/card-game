import { io, type Socket } from 'socket.io-client';
import { EV, type Ack, type ActionEnvelope, type SessionInfo, type TableView } from '@chieu-bai/shared';
import { createStore } from './store';

const TOKEN_KEY = 'chieu-bai.token';

function readToken(): string | undefined {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}
function writeToken(t: string) {
  try {
    localStorage.setItem(TOKEN_KEY, t);
  } catch {
    /* trình duyệt chặn lưu trữ: phiên chỉ tồn tại tới khi tải lại trang */
  }
}

export type ConnState = 'connecting' | 'online' | 'reconnecting' | 'offline';

export const connection = createStore<{ state: ConnState; everConnected: boolean }>({ state: 'connecting', everConnected: false });
export const session = createStore<SessionInfo | null>(null);

let socket: Socket | null = null;
const reconnectHandlers = new Set<() => void>();

export function getSocket(): Socket {
  if (socket) return socket;
  socket = io({
    auth: (cb) => cb({ token: session.get()?.token ?? readToken() }),
    transports: ['websocket', 'polling'],
    reconnectionDelay: 500,
    reconnectionDelayMax: 4000,
  });
  socket.on('connect', async () => {
    const wasConnected = connection.get().everConnected;
    connection.set({ state: 'online', everConnected: true });
    const res = await call<SessionInfo>(EV.hello);
    if (res.ok && res.data) {
      writeToken(res.data.token);
      session.set(res.data);
    }
    if (wasConnected) for (const fn of reconnectHandlers) fn();
  });
  socket.on('disconnect', () => {
    connection.set({ ...connection.get(), state: 'reconnecting' });
  });
  socket.on('connect_error', () => {
    const c = connection.get();
    connection.set({ ...c, state: c.everConnected ? 'reconnecting' : 'offline' });
  });
  return socket;
}

export function onReconnect(fn: () => void) {
  reconnectHandlers.add(fn);
  return () => reconnectHandlers.delete(fn);
}

/** Gửi sự kiện kèm ack; hết thời gian thì báo lỗi kết nối. */
export function call<T = unknown>(event: string, payload?: unknown, timeoutMs = 8000): Promise<Ack<T>> {
  const s = getSocket();
  return new Promise((resolve) => {
    if (!s.connected) {
      resolve({ ok: false, error: 'Đang mất kết nối với máy chủ.', code: 'OFFLINE' });
      return;
    }
    s.timeout(timeoutMs).emit(event, payload, (err: unknown, res: Ack<T>) => {
      if (err) resolve({ ok: false, error: 'Máy chủ không phản hồi, vui lòng thử lại.', code: 'TIMEOUT' });
      else resolve(res);
    });
  });
}

function uuid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Gửi ý định hành động theo đúng định dạng envelope (spec §6.2). */
export function sendAction(view: TableView, type: string, payload: unknown = {}) {
  const env: ActionEnvelope = {
    actionId: uuid(),
    gameId: view.gameId,
    tableId: view.tableId,
    roundId: view.round?.id ?? null,
    stateVersion: view.round?.stateVersion ?? 0,
    type,
    payload,
  };
  return call(EV.gameAction, env);
}
