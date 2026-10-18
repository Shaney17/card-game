import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { AVATARS, isAvatarKey, type PublicPlayer } from '@chieu-bai/shared';
import type { Store } from '../persistence/db';
import { cryptoRng, randomId } from '../security/rng';

/**
 * Định danh "vào nhanh bằng biệt danh": server cấp token bí mật (lưu ở trình duyệt),
 * DB chỉ lưu hash. ID công khai tách biệt hoàn toàn với token (spec §10).
 */
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export function sanitizeNickname(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const name = input.normalize('NFC').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim();
  if (name.length < 2 || name.length > 20) return null;
  return name;
}

export class PlayerDirectory {
  private cache = new Map<string, PublicPlayer>();
  constructor(private store: Store) {}

  /** Khôi phục phiên từ token, hoặc tạo người chơi mới. */
  resolve(token: unknown): { player: PublicPlayer; token: string } {
    if (typeof token === 'string' && token.length >= 20 && token.length <= 128) {
      const row = this.store.findPlayerByTokenHash(hashToken(token));
      if (row) {
        const p = { id: row.id, nickname: row.nickname, avatar: row.avatar };
        this.cache.set(p.id, p);
        return { player: p, token };
      }
    }
    const newToken = randomBytes(32).toString('base64url');
    const player: PublicPlayer = {
      id: `p_${randomId(cryptoRng, 10)}`,
      nickname: `Khách ${randomId(cryptoRng, 4).toUpperCase()}`,
      avatar: AVATARS[cryptoRng.int(AVATARS.length)].key,
    };
    this.store.createPlayer({ id: player.id, token_hash: hashToken(newToken), nickname: player.nickname, avatar: player.avatar });
    this.cache.set(player.id, player);
    return { player, token: newToken };
  }

  get(id: string): PublicPlayer | undefined {
    return this.cache.get(id);
  }

  updateProfile(id: string, nickname: unknown, avatar: unknown): PublicPlayer | string {
    const p = this.cache.get(id);
    if (!p) return 'Không tìm thấy người chơi.';
    const name = sanitizeNickname(nickname);
    if (!name) return 'Biệt danh phải dài 2–20 ký tự.';
    if (!isAvatarKey(avatar)) return 'Avatar không hợp lệ.';
    const next = { ...p, nickname: name, avatar };
    this.store.updateProfile(id, name, avatar);
    this.cache.set(id, next);
    return next;
  }
}

export function checkAdminPassword(input: unknown, expected: string | undefined): boolean {
  if (!expected || typeof input !== 'string') return false;
  const a = createHash('sha256').update(input).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}
