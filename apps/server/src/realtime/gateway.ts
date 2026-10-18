import { EV, isGameId, type Ack, type SessionInfo } from '@chieu-bai/shared';
import type { Server, Socket } from 'socket.io';
import { checkAdminPassword, type PlayerDirectory } from '../auth/players';
import type { GameTable } from '../game-tables/game-table';
import type { TableManager } from '../game-tables/table-manager';
import { RateLimiter } from '../security/rate-limit';

interface SocketData {
  playerId: string;
  token: string;
  limiter: RateLimiter;
}

type AckFn = (res: Ack) => void;

export interface GatewayOptions {
  adminPassword?: string;
}

/** Lớp realtime: chỉ chuyển ý định hành động tới bàn chơi và phát trạng thái đã lọc cho từng người. */
export function attachGateway(io: Server, tables: TableManager, players: PlayerDirectory, opts: GatewayOptions) {
  const admins = new Set<string>();
  const socketsByPlayer = new Map<string, Set<Socket>>();
  const pending = new Set<GameTable>();
  let lobbyDirty = false;
  let flushScheduled = false;

  const isAdmin = (playerId: string) => admins.has(playerId);

  function scheduleFlush() {
    if (flushScheduled) return;
    flushScheduled = true;
    setImmediate(flush);
  }

  /** Gộp nhiều thay đổi trong cùng một tick thành một lần phát. */
  async function flush() {
    flushScheduled = false;
    const list = [...pending];
    pending.clear();
    for (const t of list) await emitTable(t);
    if (lobbyDirty) {
      lobbyDirty = false;
      io.to('lobby').emit(EV.lobbyUpdate, tables.all().map((t) => t.summary()));
    }
  }

  async function emitTable(t: GameTable) {
    const sockets = await io.in(`table:${t.id}`).fetchSockets();
    for (const s of sockets) {
      const data = s.data as SocketData;
      s.emit(EV.tableUpdate, t.view(data.playerId, isAdmin(data.playerId)));
    }
  }

  for (const t of tables.all()) {
    t.onChange(() => {
      pending.add(t);
      lobbyDirty = true;
      scheduleFlush();
    });
  }

  io.use((socket, next) => {
    try {
      const { player, token } = players.resolve(socket.handshake.auth?.token);
      socket.data = { playerId: player.id, token, limiter: new RateLimiter() } satisfies SocketData;
      next();
    } catch (err) {
      console.error('Lỗi xác thực kết nối', (err as Error).message);
      next(new Error('Không thể xác thực phiên.'));
    }
  });

  io.on('connection', (socket) => {
    const data = socket.data as SocketData;
    const pid = data.playerId;
    const set = socketsByPlayer.get(pid) ?? new Set();
    set.add(socket);
    socketsByPlayer.set(pid, set);
    for (const t of tables.all()) t.setConnected(pid, true);

    const info = (): SessionInfo => ({ player: players.get(pid)!, token: data.token, isAdmin: isAdmin(pid) });

    /** Bọc handler: giới hạn tần suất, kiểm tra ack, không làm lộ lỗi nội bộ. */
    const on = (event: string, handler: (payload: any) => Ack | Promise<Ack>, cost = 1) => {
      socket.on(event, async (payload: unknown, ack?: AckFn) => {
        const reply = typeof ack === 'function' ? ack : () => {};
        if (!data.limiter.take(cost)) return reply({ ok: false, error: 'Bạn thao tác quá nhanh, vui lòng chậm lại.', code: 'RATE_LIMIT' });
        try {
          reply(await handler(payload));
        } catch (err) {
          console.error(`Lỗi xử lý sự kiện ${event}`, (err as Error).message);
          reply({ ok: false, error: 'Máy chủ gặp lỗi, vui lòng thử lại.', code: 'SERVER' });
        }
      });
    };

    const tableFrom = (payload: any): GameTable | null => (isGameId(payload?.gameId) ? tables.get(payload.gameId) : null);

    on(EV.hello, () => ({ ok: true, data: info() }));

    on(EV.profile, (payload) => {
      if (tables.all().some((t) => t.isSeated(pid) && t.status === 'PLAYING')) {
        return { ok: false, error: 'Không thể đổi biệt danh khi đang chơi.' };
      }
      const r = players.updateProfile(pid, payload?.nickname, payload?.avatar);
      if (typeof r === 'string') return { ok: false, error: r };
      for (const t of tables.all()) if (t.isSeated(pid)) {
        pending.add(t);
        scheduleFlush();
      }
      return { ok: true, data: info() };
    });

    on(EV.lobbyWatch, () => {
      socket.join('lobby');
      return { ok: true, data: tables.all().map((t) => t.summary()) };
    });

    on(EV.tableWatch, (payload) => {
      const t = tableFrom(payload);
      if (!t) return { ok: false, error: 'Game không tồn tại.' };
      socket.join(`table:${t.id}`);
      return { ok: true, data: t.view(pid, isAdmin(pid)) };
    });

    on(EV.tableUnwatch, (payload) => {
      const t = tableFrom(payload);
      if (t) socket.leave(`table:${t.id}`);
      return { ok: true };
    });

    on(EV.tableJoin, (payload) => {
      const t = tableFrom(payload);
      if (!t) return { ok: false, error: 'Game không tồn tại.' };
      return t.join(pid);
    });

    on(EV.tableLeave, (payload) => {
      const t = tableFrom(payload);
      if (!t) return { ok: false, error: 'Game không tồn tại.' };
      return t.leave(pid);
    });

    on(EV.tableReady, (payload) => {
      const t = tableFrom(payload);
      if (!t) return { ok: false, error: 'Game không tồn tại.' };
      return t.setReady(pid, payload?.ready === true);
    });

    on(EV.gameAction, (payload) => {
      const t = tableFrom(payload);
      if (!t) return { ok: false, error: 'Game không tồn tại.' };
      return t.action(pid, payload);
    });

    on(
      EV.adminLogin,
      (payload) => {
        if (!checkAdminPassword(payload?.password, opts.adminPassword)) {
          return { ok: false, error: opts.adminPassword ? 'Mật khẩu quản trị không đúng.' : 'Máy chủ chưa cấu hình ADMIN_PASSWORD.' };
        }
        admins.add(pid);
        for (const t of tables.all()) pending.add(t);
        scheduleFlush();
        return { ok: true, data: info() };
      },
      5,
    );

    on(EV.adminConfig, (payload) => {
      if (!isAdmin(pid)) return { ok: false, error: 'Bạn không có quyền cấu hình luật.', code: 'FORBIDDEN' };
      const t = tableFrom(payload);
      if (!t) return { ok: false, error: 'Game không tồn tại.' };
      return t.adminConfig(payload?.config);
    });

    on(EV.adminStatus, (payload) => {
      if (!isAdmin(pid)) return { ok: false, error: 'Bạn không có quyền quản trị.', code: 'FORBIDDEN' };
      const t = tableFrom(payload);
      if (!t) return { ok: false, error: 'Game không tồn tại.' };
      if (!['OPEN', 'PAUSED', 'CLOSED'].includes(payload?.status)) return { ok: false, error: 'Trạng thái không hợp lệ.' };
      return t.adminStatus(payload.status);
    });

    socket.on('disconnect', () => {
      const s = socketsByPlayer.get(pid);
      s?.delete(socket);
      if (!s || s.size === 0) {
        socketsByPlayer.delete(pid);
        for (const t of tables.all()) t.setConnected(pid, false);
      }
    });
  });
}
