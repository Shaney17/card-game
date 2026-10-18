import { GAMES, type GameId } from '@chieu-bai/shared';
import type { PlayerDirectory } from '../auth/players';
import { getEngine } from '../game-registry/registry';
import type { Store } from '../persistence/db';
import { GameTable, type TableOptions } from './game-table';

/**
 * Quản lý đúng MỘT bàn cố định cho mỗi game đã đăng ký.
 * Không có API tạo bàn/phòng mới.
 */
export class TableManager {
  private tables = new Map<GameId, GameTable>();

  constructor(store: Store, players: PlayerDirectory, options: TableOptions = {}) {
    for (const meta of Object.values(GAMES)) {
      this.tables.set(meta.id, new GameTable(meta, getEngine(meta.id), store, players, options));
    }
  }

  get(gameId: GameId): GameTable {
    return this.tables.get(gameId)!;
  }

  byTableId(tableId: string): GameTable | undefined {
    return [...this.tables.values()].find((t) => t.id === tableId);
  }

  all(): GameTable[] {
    return [...this.tables.values()];
  }

  dispose() {
    for (const t of this.tables.values()) t.dispose();
  }
}
