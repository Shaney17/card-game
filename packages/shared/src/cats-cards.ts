/**
 * Bộ bài Mèo Nổ nguyên bản của dự án (tên, mô tả, minh hoạ tự thiết kế).
 * Đây là DỮ LIỆU — hiệu ứng được ánh xạ qua `effectType` tới handler phía server.
 */
export type CatsExpansionId = 'base' | 'hon-loan';
export type CatsCategory = 'exploding' | 'defuse' | 'action' | 'reaction' | 'collection';
export type TargetMode = 'self' | 'player' | 'all' | 'none';

export interface CatsCardDefinition {
  id: string;
  name: string;
  description: string;
  imageKey: string;
  category: CatsCategory;
  expansionId: CatsExpansionId;
  effectType: string;
  targetMode: TargetMode;
  requiresTarget: boolean;
  requiresChoice: boolean;
  /** Số lá trong một bộ (bộ bài nhân bản khi đông người). */
  count: number;
  /** Có thể bị "Không!" chặn. */
  nopeable: boolean;
}

export const CAT_COLLECTION_IDS = ['cat_banh_bao', 'cat_tra_sua', 'cat_xoi_gac', 'cat_pho_bo', 'cat_che_ba_mau'] as const;

const cat = (id: string, name: string, flavor: string): CatsCardDefinition => ({
  id,
  name,
  description: `Lá mèo sưu tập. ${flavor} Đánh 2 lá giống nhau để cướp ngẫu nhiên 1 lá của người khác, 3 lá giống nhau để đòi đúng lá bạn muốn.`,
  imageKey: `cats.${id}`,
  category: 'collection',
  expansionId: 'base',
  effectType: 'cat_combo',
  targetMode: 'player',
  requiresTarget: true,
  requiresChoice: false,
  count: 4,
  nopeable: true,
});

export const CATS_CARDS: CatsCardDefinition[] = [
  {
    id: 'exploding',
    name: 'Mèo Nổ',
    description: 'Rút phải lá này mà không có Gỡ Bom thì bạn bị loại ngay lập tức.',
    imageKey: 'cats.exploding',
    category: 'exploding',
    expansionId: 'base',
    effectType: 'explode',
    targetMode: 'none',
    requiresTarget: false,
    requiresChoice: false,
    count: 4,
    nopeable: false,
  },
  {
    id: 'defuse',
    name: 'Gỡ Bom',
    description: 'Tự động dùng khi bạn rút phải Mèo Nổ. Sau đó bạn bí mật nhét Mèo Nổ trở lại bất kỳ vị trí nào trong chồng bài.',
    imageKey: 'cats.defuse',
    category: 'defuse',
    expansionId: 'base',
    effectType: 'defuse',
    targetMode: 'self',
    requiresTarget: false,
    requiresChoice: true,
    count: 6,
    nopeable: false,
  },
  {
    id: 'attack',
    name: 'Tấn Công',
    description: 'Kết thúc lượt mà không rút bài. Người kế tiếp phải chơi 2 lượt liên tiếp (cộng dồn nếu bạn đang bị tấn công).',
    imageKey: 'cats.attack',
    category: 'action',
    expansionId: 'base',
    effectType: 'attack',
    targetMode: 'none',
    requiresTarget: false,
    requiresChoice: false,
    count: 4,
    nopeable: true,
  },
  {
    id: 'skip',
    name: 'Né Lượt',
    description: 'Kết thúc ngay một lượt mà không cần rút bài.',
    imageKey: 'cats.skip',
    category: 'action',
    expansionId: 'base',
    effectType: 'skip',
    targetMode: 'none',
    requiresTarget: false,
    requiresChoice: false,
    count: 4,
    nopeable: true,
  },
  {
    id: 'favor',
    name: 'Xin Xỏ',
    description: 'Chọn một người chơi. Người đó phải tự chọn 1 lá trên tay để đưa cho bạn.',
    imageKey: 'cats.favor',
    category: 'action',
    expansionId: 'base',
    effectType: 'favor',
    targetMode: 'player',
    requiresTarget: true,
    requiresChoice: false,
    count: 4,
    nopeable: true,
  },
  {
    id: 'shuffle',
    name: 'Xáo Tung',
    description: 'Xáo trộn ngẫu nhiên chồng bài rút.',
    imageKey: 'cats.shuffle',
    category: 'action',
    expansionId: 'base',
    effectType: 'shuffle',
    targetMode: 'none',
    requiresTarget: false,
    requiresChoice: false,
    count: 4,
    nopeable: true,
  },
  {
    id: 'see_future',
    name: 'Mắt Thần',
    description: 'Bí mật xem 3 lá trên cùng của chồng bài rút.',
    imageKey: 'cats.see_future',
    category: 'action',
    expansionId: 'base',
    effectType: 'see_future',
    targetMode: 'self',
    requiresTarget: false,
    requiresChoice: false,
    count: 5,
    nopeable: true,
  },
  {
    id: 'nope',
    name: 'Không!',
    description: 'Chặn hành động vừa được đánh (trừ Mèo Nổ và Gỡ Bom). Có thể đánh "Không!" để chặn một lá "Không!" khác, bất kể lượt của ai.',
    imageKey: 'cats.nope',
    category: 'reaction',
    expansionId: 'base',
    effectType: 'nope',
    targetMode: 'none',
    requiresTarget: false,
    requiresChoice: false,
    count: 5,
    nopeable: true,
  },
  cat('cat_banh_bao', 'Mèo Bánh Bao', 'Tròn vo, mềm mịn, hay ngủ gật.'),
  cat('cat_tra_sua', 'Mèo Trà Sữa', 'Thêm trân châu, bớt đường, nhiều drama.'),
  cat('cat_xoi_gac', 'Mèo Xôi Gấc', 'Đỏ rực may mắn, ai thấy cũng thèm.'),
  cat('cat_pho_bo', 'Mèo Phở Bò', 'Nóng hổi, thơm lừng, sáng nào cũng có mặt.'),
  cat('cat_che_ba_mau', 'Mèo Chè Ba Màu', 'Ba tầng cảm xúc, khó đoán như thời tiết.'),
  // ---- Bộ mở rộng "Hỗn Loạn" ----
  {
    id: 'reverse',
    name: 'Quay Xe',
    description: 'Đảo ngược chiều chơi và kết thúc một lượt mà không rút bài.',
    imageKey: 'cats.reverse',
    category: 'action',
    expansionId: 'hon-loan',
    effectType: 'reverse',
    targetMode: 'none',
    requiresTarget: false,
    requiresChoice: false,
    count: 4,
    nopeable: true,
  },
  {
    id: 'draw_bottom',
    name: 'Rút Đáy',
    description: 'Kết thúc một lượt bằng cách rút lá dưới cùng của chồng bài thay vì lá trên cùng.',
    imageKey: 'cats.draw_bottom',
    category: 'action',
    expansionId: 'hon-loan',
    effectType: 'draw_bottom',
    targetMode: 'self',
    requiresTarget: false,
    requiresChoice: false,
    count: 4,
    nopeable: true,
  },
  {
    id: 'alter_future',
    name: 'Sắp Đặt Tương Lai',
    description: 'Bí mật xem 3 lá trên cùng của chồng bài và sắp xếp lại theo ý bạn.',
    imageKey: 'cats.alter_future',
    category: 'action',
    expansionId: 'hon-loan',
    effectType: 'alter_future',
    targetMode: 'self',
    requiresTarget: false,
    requiresChoice: true,
    count: 4,
    nopeable: true,
  },
  {
    id: 'targeted_attack',
    name: 'Tấn Công Chỉ Định',
    description: 'Kết thúc lượt mà không rút bài và chọn một người phải chơi 2 lượt. Lượt chơi tiếp tục từ người đó.',
    imageKey: 'cats.targeted_attack',
    category: 'action',
    expansionId: 'hon-loan',
    effectType: 'targeted_attack',
    targetMode: 'player',
    requiresTarget: true,
    requiresChoice: false,
    count: 3,
    nopeable: true,
  },
];

export const CATS_CARD_BY_ID: Record<string, CatsCardDefinition> = Object.fromEntries(CATS_CARDS.map((c) => [c.id, c]));

export const CATS_EXPANSIONS: { id: CatsExpansionId; name: string; description: string; optional: boolean }[] = [
  { id: 'base', name: 'Bộ cơ bản', description: 'Mèo Nổ, Gỡ Bom, lá hành động và 5 loại mèo sưu tập.', optional: false },
  {
    id: 'hon-loan',
    name: 'Mở rộng: Hỗn Loạn',
    description: 'Thêm Quay Xe, Rút Đáy, Sắp Đặt Tương Lai và Tấn Công Chỉ Định.',
    optional: true,
  },
];
