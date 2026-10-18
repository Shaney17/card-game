import { describe, expect, it } from 'vitest';
import { AVATARS, CATS_CARDS, fullDeck } from '@chieu-bai/shared';
import { hasCatsArt } from './cats-cards';
import { hasAvatarArt } from './avatars';
import { cardLabel, parseCode } from './playing-cards';
import { COVERS } from './manifest';
import { GAMES, COMING_SOON } from '@chieu-bai/shared';

describe('Asset manifest', () => {
  it('mọi lá Mèo Nổ trong dữ liệu đều có minh hoạ riêng', () => {
    for (const d of CATS_CARDS) expect(hasCatsArt(d.id), d.id).toBe(true);
  });
  it('mọi avatar đều có hình vẽ', () => {
    for (const a of AVATARS) expect(hasAvatarArt(a.key), a.key).toBe(true);
  });
  it('mọi game (kể cả sắp ra mắt) đều có ảnh bìa', () => {
    for (const g of [...Object.values(GAMES), ...COMING_SOON]) expect(COVERS[g.coverKey], g.coverKey).toBeTruthy();
  });
  it('52 lá bài Tây có nhãn tiếng Việt', () => {
    const deck = fullDeck();
    expect(deck).toHaveLength(52);
    for (const c of deck) expect(['S', 'C', 'D', 'H']).toContain(parseCode(c).suit);
    expect(cardLabel('QH')).toBe('Q (đầm) cơ');
    expect(cardLabel('10S')).toBe('10 bích');
  });
});
