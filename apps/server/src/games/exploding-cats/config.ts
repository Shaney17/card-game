import { z } from 'zod';
import type { ConfigParseResult } from '../../game-registry/types';

export const catsConfigSchema = z
  .object({
    maxPlayers: z.number().int().min(2).max(8),
    /** Bộ mở rộng tuỳ chọn được bật (bộ cơ bản luôn bật). */
    expansions: z.array(z.enum(['hon-loan'])).max(1),
    /** Số lá thường chia cho mỗi người (chưa tính 1 lá Gỡ Bom). */
    handSize: z.number().int().min(4).max(8),
    /** Số Gỡ Bom thêm vào chồng bài sau khi chia. */
    extraDefuses: z.number().int().min(0).max(6),
    /** Số bộ bài dùng chung: "auto" = 2 bộ khi trên 5 người. */
    deckCopies: z.union([z.literal('auto'), z.literal(1), z.literal(2)]),
    /** Tấn Công cộng dồn khi người bị tấn công đánh tiếp Tấn Công. */
    attackStacking: z.boolean(),
    turnTimeMs: z.number().int().min(10_000).max(180_000),
    /** Thời gian cho mọi người phản ứng bằng "Không!". */
    nopeWindowMs: z.number().int().min(2_000).max(10_000),
    /** Thời gian cho các lựa chọn (Xin Xỏ, nhét bom, sắp đặt tương lai). */
    choiceTimeMs: z.number().int().min(5_000).max(60_000),
    /** Mất kết nối quá lâu: tự rút bài theo đồng hồ, hoặc bị loại. */
    disconnectPolicy: z.enum(['autoDraw', 'eliminate']),
    disconnectTimeoutMs: z.number().int().min(15_000).max(600_000),
    midRoundJoin: z.enum(['waitNextRound', 'reject']),
  })
  .strict();

export type CatsConfig = z.infer<typeof catsConfigSchema>;

export const CATS_DEFAULT_CONFIG: CatsConfig = {
  maxPlayers: 8,
  expansions: [],
  handSize: 7,
  extraDefuses: 2,
  deckCopies: 'auto',
  attackStacking: true,
  turnTimeMs: 45_000,
  nopeWindowMs: 4_000,
  choiceTimeMs: 20_000,
  disconnectPolicy: 'eliminate',
  disconnectTimeoutMs: 60_000,
  midRoundJoin: 'waitNextRound',
};

export function parseCatsConfig(input: unknown): ConfigParseResult<CatsConfig> {
  const merged = { ...CATS_DEFAULT_CONFIG, ...(typeof input === 'object' && input ? input : {}) };
  const r = catsConfigSchema.safeParse(merged);
  if (!r.success) {
    const first = r.error.issues[0];
    return { ok: false, error: `Cấu hình Mèo Nổ không hợp lệ ở "${first.path.join('.')}": ${first.message}` };
  }
  return { ok: true, config: r.data };
}
