import type { GameId } from '@chieu-bai/shared';
import { catsEngine } from '../games/exploding-cats/engine';
import { samEngine } from '../games/sam/engine';
import type { GameEngine } from './types';

/** Đăng ký game mới: thêm engine vào đây và metadata vào packages/shared/src/games.ts. */
const ENGINES: Record<GameId, GameEngine> = {
  sam: samEngine,
  'exploding-cats': catsEngine,
};

export function getEngine(id: GameId): GameEngine {
  return ENGINES[id];
}

export function allEngines(): GameEngine[] {
  return Object.values(ENGINES);
}
