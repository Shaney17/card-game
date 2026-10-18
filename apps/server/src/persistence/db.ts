import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';
import type { Settlement } from '../game-registry/types';

const require = createRequire(import.meta.url);

/**
 * Lưu trữ bằng SQLite (node:sqlite, không cần cài thêm).
 * Lược đồ bám theo mô hình dữ liệu ở spec §8; có thể thay bằng PostgreSQL/Prisma
 * bằng cách cài đặt lại interface `Store`.
 */
export interface PlayerRow {
  id: string;
  token_hash: string;
  nickname: string;
  avatar: string;
}

export interface Store {
  findPlayerByTokenHash(hash: string): PlayerRow | undefined;
  createPlayer(row: PlayerRow): void;
  updateProfile(id: string, nickname: string, avatar: string): void;
  loadTable(tableId: string): { config: unknown; status: string } | undefined;
  saveTable(tableId: string, gameId: string, config: unknown, status: string): void;
  createSession(s: { id: string; tableId: string; gameId: string; roundNumber: number; rulesVersion: string; config: unknown; players: string[] }): void;
  appendEvent(e: { sessionId: string | null; tableId: string; seq: number; kind: string; text: string; visibleTo: string[] | null; audit: unknown }): void;
  getBalance(playerId: string, gameId: string): number | undefined;
  ensureBalance(playerId: string, gameId: string, initial: number): number;
  /** Quyết toán idempotent: chỉ áp dụng một lần cho mỗi ván. */
  settleSession(sessionId: string, gameId: string, result: unknown, settlements: Settlement[]): { applied: boolean };
  lastRoundNumber(tableId: string): number;
  close(): void;
}

export function openStore(file: string): Store {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: typeof DatabaseSyncType };
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      nickname TEXT NOT NULL,
      avatar TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS game_tables (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      config_json TEXT NOT NULL,
      status TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS game_sessions (
      id TEXT PRIMARY KEY,
      table_id TEXT NOT NULL,
      game_id TEXT NOT NULL,
      round_number INTEGER NOT NULL,
      rules_version TEXT NOT NULL,
      config_json TEXT NOT NULL,
      players_json TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      finished_at INTEGER,
      settled INTEGER NOT NULL DEFAULT 0,
      result_json TEXT
    );
    CREATE TABLE IF NOT EXISTS game_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      table_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      kind TEXT NOT NULL,
      text TEXT NOT NULL,
      visible_to TEXT,
      audit_json TEXT,
      ts INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS balances (
      player_id TEXT NOT NULL,
      game_id TEXT NOT NULL,
      balance INTEGER NOT NULL,
      PRIMARY KEY (player_id, game_id)
    );
    CREATE TABLE IF NOT EXISTS ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      settlement_key TEXT NOT NULL,
      player_id TEXT NOT NULL,
      game_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      reason TEXT NOT NULL,
      ts INTEGER NOT NULL,
      UNIQUE (session_id, settlement_key)
    );
  `);

  const q = {
    findPlayer: db.prepare('SELECT id, token_hash, nickname, avatar FROM players WHERE token_hash = ?'),
    createPlayer: db.prepare('INSERT INTO players (id, token_hash, nickname, avatar, created_at) VALUES (?, ?, ?, ?, ?)'),
    updateProfile: db.prepare('UPDATE players SET nickname = ?, avatar = ? WHERE id = ?'),
    loadTable: db.prepare('SELECT config_json, status FROM game_tables WHERE id = ?'),
    saveTable: db.prepare(
      `INSERT INTO game_tables (id, game_id, config_json, status, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET config_json = excluded.config_json, status = excluded.status, updated_at = excluded.updated_at`,
    ),
    createSession: db.prepare(
      `INSERT INTO game_sessions (id, table_id, game_id, round_number, rules_version, config_json, players_json, started_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ),
    appendEvent: db.prepare(
      'INSERT INTO game_events (session_id, table_id, seq, kind, text, visible_to, audit_json, ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ),
    getBalance: db.prepare('SELECT balance FROM balances WHERE player_id = ? AND game_id = ?'),
    insertBalance: db.prepare('INSERT OR IGNORE INTO balances (player_id, game_id, balance) VALUES (?, ?, ?)'),
    addBalance: db.prepare('UPDATE balances SET balance = balance + ? WHERE player_id = ? AND game_id = ?'),
    sessionSettled: db.prepare('SELECT settled FROM game_sessions WHERE id = ?'),
    markSettled: db.prepare('UPDATE game_sessions SET settled = 1, finished_at = ?, result_json = ? WHERE id = ? AND settled = 0'),
    insertLedger: db.prepare(
      'INSERT INTO ledger (session_id, settlement_key, player_id, game_id, amount, reason, ts) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ),
    lastRound: db.prepare('SELECT MAX(round_number) AS n FROM game_sessions WHERE table_id = ?'),
  };

  return {
    findPlayerByTokenHash: (hash) => q.findPlayer.get(hash) as PlayerRow | undefined,
    createPlayer: (r) => void q.createPlayer.run(r.id, r.token_hash, r.nickname, r.avatar, Date.now()),
    updateProfile: (id, nickname, avatar) => void q.updateProfile.run(nickname, avatar, id),
    loadTable(tableId) {
      const row = q.loadTable.get(tableId) as { config_json: string; status: string } | undefined;
      return row ? { config: JSON.parse(row.config_json), status: row.status } : undefined;
    },
    saveTable: (tableId, gameId, config, status) => void q.saveTable.run(tableId, gameId, JSON.stringify(config), status, Date.now()),
    createSession: (s) =>
      void q.createSession.run(s.id, s.tableId, s.gameId, s.roundNumber, s.rulesVersion, JSON.stringify(s.config), JSON.stringify(s.players), Date.now()),
    appendEvent: (e) =>
      void q.appendEvent.run(
        e.sessionId,
        e.tableId,
        e.seq,
        e.kind,
        e.text,
        e.visibleTo ? JSON.stringify(e.visibleTo) : null,
        e.audit === undefined ? null : JSON.stringify(e.audit),
        Date.now(),
      ),
    getBalance(playerId, gameId) {
      const row = q.getBalance.get(playerId, gameId) as { balance: number } | undefined;
      return row?.balance;
    },
    ensureBalance(playerId, gameId, initial) {
      q.insertBalance.run(playerId, gameId, initial);
      return (q.getBalance.get(playerId, gameId) as { balance: number }).balance;
    },
    settleSession(sessionId, gameId, result, settlements) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const row = q.sessionSettled.get(sessionId) as { settled: number } | undefined;
        if (!row || row.settled) {
          db.exec('ROLLBACK');
          return { applied: false };
        }
        const now = Date.now();
        const changed = q.markSettled.run(now, JSON.stringify(result), sessionId);
        if (Number(changed.changes) !== 1) {
          db.exec('ROLLBACK');
          return { applied: false };
        }
        for (const st of settlements) {
          if (!Number.isInteger(st.amount)) throw new Error('Số tiền phải là số nguyên');
          q.insertLedger.run(sessionId, st.key, st.playerId, gameId, st.amount, st.reason, now);
          q.insertBalance.run(st.playerId, gameId, 0);
          q.addBalance.run(st.amount, st.playerId, gameId);
        }
        db.exec('COMMIT');
        return { applied: true };
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },
    lastRoundNumber(tableId) {
      return Number((q.lastRound.get(tableId) as { n: number | null }).n ?? 0);
    },
    close: () => db.close(),
  };
}
