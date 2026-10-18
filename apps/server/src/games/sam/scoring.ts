import type { Settlement } from '../../game-registry/types';
import { parseCard, RANK_2 } from './cards';
import { INSTANT_WIN_LABEL } from './config';
import type { SamState } from './state';

/**
 * SamScoringEngine — tách riêng phần tính tiền (spec §4.4).
 * Mỗi khoản là một lần chuyển tiền giữa hai người; tổng luôn bằng 0.
 * Công thức & số tiền lấy hoàn toàn từ cấu hình đã đóng băng của ván.
 */
export interface Transfer {
  key: string;
  from: string;
  to: string;
  amount: number;
  reason: string;
}

export function computeTransfers(state: SamState): Transfer[] {
  const { config: cfg, finish, players } = state;
  if (!finish) return [];
  const out: Transfer[] = [];
  const name = (id: string) => players.find((p) => p.id === id)?.nickname ?? id;

  state.cuts.forEach((cut, i) => {
    const label = cut.kind === 'two' ? 'Bị chặt 2' : cut.kind === 'pairTwo' ? 'Bị chặt đôi 2' : 'Bị chặt tứ quý';
    out.push({ key: `cut:${i}`, from: cut.victimId, to: cut.cutterId, amount: cut.amount, reason: `${label} bởi ${name(cut.cutterId)}` });
  });

  const others = players.filter((p) => p.id !== finish.winnerId);
  switch (finish.reason) {
    case 'instant':
      for (const p of others) {
        out.push({
          key: `instant:${p.id}`,
          from: p.id,
          to: finish.winnerId,
          amount: cfg.instantWinAmount,
          reason: `Ăn trắng (${finish.instantKind ? INSTANT_WIN_LABEL[finish.instantKind] : ''})`,
        });
      }
      break;
    case 'samSuccess':
      for (const p of others) {
        out.push({ key: `sam:${p.id}`, from: p.id, to: finish.winnerId, amount: cfg.samReward, reason: 'Báo Sâm thành công' });
      }
      break;
    case 'samFail': {
      const declarer = state.samDeclarerId!;
      const opponents = players.filter((p) => p.id !== declarer);
      if (cfg.samFailMode === 'payBlockerForAll' && finish.blockerId) {
        out.push({
          key: `samfail:${finish.blockerId}`,
          from: declarer,
          to: finish.blockerId,
          amount: cfg.samPenalty * opponents.length,
          reason: 'Đền Sâm (trả người chặn thay cả bàn)',
        });
      } else {
        for (const p of opponents) {
          out.push({ key: `samfail:${p.id}`, from: declarer, to: p.id, amount: cfg.samPenalty, reason: 'Báo Sâm thất bại' });
        }
      }
      break;
    }
    case 'normal':
      for (const p of others) {
        if (cfg.lossFormula === 'flat') {
          out.push({ key: `loss:${p.id}`, from: p.id, to: finish.winnerId, amount: cfg.flatLossAmount, reason: 'Thua ván' });
          continue;
        }
        const cong = !p.playedAny && p.hand.length === cfg.handSize;
        if (cong) {
          out.push({ key: `cong:${p.id}`, from: p.id, to: finish.winnerId, amount: cfg.congPenalty, reason: 'Cóng (chưa đánh được lá nào)' });
        } else {
          out.push({
            key: `cards:${p.id}`,
            from: p.id,
            to: finish.winnerId,
            amount: p.hand.length * cfg.perCardPenalty,
            reason: `Thua ${p.hand.length} lá`,
          });
        }
        const twos = p.hand.map(parseCard).filter((c) => c.rank === RANK_2).length;
        if (twos > 0) {
          out.push({
            key: `thoi2:${p.id}`,
            from: p.id,
            to: finish.winnerId,
            amount: twos * cfg.thoiTwoPenalty,
            reason: `Thối ${twos} quân 2`,
          });
        }
      }
      break;
  }
  return out.filter((t) => t.amount > 0 && t.from !== t.to);
}

export function transfersToSettlements(transfers: Transfer[]): Settlement[] {
  const out: Settlement[] = [];
  for (const t of transfers) {
    out.push({ key: `${t.key}:from`, playerId: t.from, amount: -t.amount, reason: t.reason });
    out.push({ key: `${t.key}:to`, playerId: t.to, amount: t.amount, reason: t.reason });
  }
  return out;
}
