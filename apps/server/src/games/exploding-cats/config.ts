import { z } from 'zod';
import type { ConfigParseResult } from '../../game-registry/types';

export const catsConfigSchema = z
  .object({
    maxPlayers: z.number().int().min(2).max(8),
    /** Bộ mở rộng tuỳ chọn được bật (bộ cơ bản luôn bật). */
    expansions: z
      .array(z.enum(['hon-loan', 'tang-toc', 'dao-boi', 'hen-gio']))
      .max(4)
      .refine((a) => new Set(a).size === a.length, 'Bộ mở rộng bị trùng'),
    /** Số lá thường chia cho mỗi người (chưa tính 1 lá Gỡ Bom). */
    handSize: z.number().int().min(4).max(8),
    /** Rút gọn chồng bài: chỉ giữ tối đa max(20, số người × 8) lá thường (ưu tiên giữ lá hành động) để ván không quá dài. */
    trimDeck: z.boolean(),
    /** Số Gỡ Bom nằm sẵn trong chồng bốc (tối đa 1 để không quá dễ). */
    extraDefuses: z.number().int().min(0).max(1),
    /** Số Mèo Nổ thêm so với mức cơ bản (số người − 1). */
    extraBombs: z.number().int().min(0).max(4),
    /** Số bộ bài dùng chung: "auto" = 2 bộ khi trên 5 người. */
    deckCopies: z.union([z.literal('auto'), z.literal(1), z.literal(2)]),
    /** Số lượt (của người đang giữ) trước khi Mèo Hẹn Giờ phát nổ. */
    timeBombTurns: z.number().int().min(1).max(6),
    /** Tấn Công cộng dồn khi người bị tấn công đánh tiếp Tấn Công. */
    attackStacking: z.boolean(),
    turnTimeMs: z.number().int().min(10_000).max(180_000),
    /** Thời gian cho mọi người phản ứng bằng "Không!". */
    nopeWindowMs: z.number().int().min(2_000).max(10_000),
    /** Thời gian cho các lựa chọn (Thiện Ý, nhét bom, sắp đặt tương lai). */
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
  expansions: ['hon-loan', 'tang-toc', 'dao-boi', 'hen-gio'],
  handSize: 7,
  trimDeck: true,
  extraDefuses: 1,
  extraBombs: 1,
  deckCopies: 'auto',
  timeBombTurns: 3,
  attackStacking: true,
  turnTimeMs: 45_000,
  nopeWindowMs: 6_000,
  choiceTimeMs: 20_000,
  disconnectPolicy: 'eliminate',
  disconnectTimeoutMs: 60_000,
  midRoundJoin: 'waitNextRound',
};

export function parseCatsConfig(input: unknown): ConfigParseResult<CatsConfig> {
  const merged = { ...CATS_DEFAULT_CONFIG, ...(typeof input === 'object' && input ? input : {}) } as Record<string, unknown>;
  // Chuyển đổi cấu hình đã lưu từ phiên bản cũ (trước đây cho tới 6 Gỡ Bom trong chồng bốc).
  if (typeof merged.extraDefuses === 'number' && merged.extraDefuses > 1) merged.extraDefuses = 1;
  const r = catsConfigSchema.safeParse(merged);
  if (!r.success) {
    const first = r.error.issues[0];
    return { ok: false, error: `Cấu hình Mèo Nổ không hợp lệ ở "${first.path.join('.')}": ${first.message}` };
  }
  return { ok: true, config: r.data };
}
