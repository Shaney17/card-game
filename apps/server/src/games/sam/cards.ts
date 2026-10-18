import { fullDeck, type CardCode } from '@chieu-bai/shared';
import { shuffle, type Rng } from '../../security/rng';

export * from '@chieu-bai/shared/src/sam/cards';

export function shuffledDeck(rng: Rng): CardCode[] {
  return shuffle(fullDeck(), rng);
}
