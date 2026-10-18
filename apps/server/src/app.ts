import { createServer, type Server as HttpServer } from 'node:http';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import express from 'express';
import { Server } from 'socket.io';
import { COMING_SOON, GAMES } from '@chieu-bai/shared';
import { PlayerDirectory } from './auth/players';
import { TableManager } from './game-tables/table-manager';
import type { TableOptions } from './game-tables/game-table';
import { openStore, type Store } from './persistence/db';
import { attachGateway } from './realtime/gateway';

export interface AppOptions {
  dataFile: string;
  adminPassword?: string;
  corsOrigin?: string;
  staticDir?: string;
  tableOptions?: TableOptions;
}

export interface App {
  http: HttpServer;
  io: Server;
  store: Store;
  tables: TableManager;
  close(): Promise<void>;
}

export function createApp(opts: AppOptions): App {
  const store = openStore(opts.dataFile);
  const players = new PlayerDirectory(store);
  const tables = new TableManager(store, players, opts.tableOptions);

  const app = express();
  app.disable('x-powered-by');
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });
  // REST công khai: danh sách game và trạng thái bàn (không lộ dữ liệu riêng).
  app.get('/api/games', (_req, res) => {
    res.json({
      games: Object.values(GAMES).map((g) => ({ ...g, table: tables.get(g.id).summary() })),
      comingSoon: COMING_SOON,
    });
  });

  if (opts.staticDir && existsSync(opts.staticDir)) {
    const dir = resolve(opts.staticDir);
    app.use(express.static(dir, { maxAge: '1h', index: false }));
    app.get(/^(?!\/api|\/socket\.io).*/, (_req, res) => {
      res.sendFile(resolve(dir, 'index.html'));
    });
  }

  const http = createServer(app);
  const io = new Server(http, {
    cors: opts.corsOrigin ? { origin: opts.corsOrigin.split(',') } : undefined,
    pingInterval: 10_000,
    pingTimeout: 8_000,
    connectionStateRecovery: undefined,
  });
  attachGateway(io, tables, players, { adminPassword: opts.adminPassword });

  return {
    http,
    io,
    store,
    tables,
    async close() {
      tables.dispose();
      await new Promise<void>((r) => io.close(() => r()));
      store.close();
    },
  };
}
