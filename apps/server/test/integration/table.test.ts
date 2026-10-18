import { afterEach, describe, expect, it } from 'vitest';
import { GAMES } from '@chieu-bai/shared';
import { PlayerDirectory } from '../../src/auth/players';
import { GameTable } from '../../src/game-tables/game-table';
import { samEngine } from '../../src/games/sam/engine';
import { catsEngine } from '../../src/games/exploding-cats/engine';
import { openStore, type Store } from '../../src/persistence/db';
import { seededRng } from '../../src/security/rng';
import type { SamState } from '../../src/games/sam/state';

let store: Store;
let clock = 1_000_000;
const now = () => clock;

function makeTable(game: 'sam' | 'exploding-cats' = 'sam') {
  store = openStore(':memory:');
  const dir = new PlayerDirectory(store);
  const engine = game === 'sam' ? samEngine : catsEngine;
  const table = new GameTable(GAMES[game], engine, store, dir, { now, rng: seededRng(11), autoTimers: false });
  const players = Array.from({ length: 9 }, () => dir.resolve(undefined).player);
  return { table, players, dir };
}

const env = (table: GameTable, type: string, payload: unknown, actionId = Math.random().toString(36).slice(2, 12)) => {
  const v = table.view(null, false);
  return { actionId, gameId: table.gameId, tableId: table.id, roundId: v.round?.id ?? null, stateVersion: v.round?.stateVersion ?? 0, type, payload };
};

afterEach(() => store?.close());

describe('Bàn chơi cố định', () => {
  it('giới hạn số người: Sâm tối đa 5', () => {
    const { table, players } = makeTable('sam');
    for (let i = 0; i < 5; i++) expect(table.join(players[i].id).ok).toBe(true);
    const r = table.join(players[5].id);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/đủ chỗ/);
    expect(table.summary()).toMatchObject({ playerCount: 5, maxPlayers: 5 });
  });

  it('giới hạn số người: Mèo Nổ tối đa 8', () => {
    const { table, players } = makeTable('exploding-cats');
    for (let i = 0; i < 8; i++) expect(table.join(players[i].id).ok).toBe(true);
    expect(table.join(players[8].id).ok).toBe(false);
  });

  it('chuyển trạng thái WAITING -> READY -> PLAYING khi mọi người sẵn sàng', () => {
    const { table, players } = makeTable('sam');
    table.join(players[0].id);
    expect(table.status).toBe('WAITING');
    table.join(players[1].id);
    expect(table.status).toBe('READY');
    table.setReady(players[0].id, true);
    expect(table.status).toBe('READY');
    table.setReady(players[1].id, true);
    expect(table.status).toBe('PLAYING');
  });

  it('người vào giữa ván phải chờ ván sau, không bị thêm vào ván', () => {
    const { table, players } = makeTable('sam');
    table.join(players[0].id);
    table.join(players[1].id);
    table.setReady(players[0].id, true);
    table.setReady(players[1].id, true);
    expect(table.join(players[2].id).ok).toBe(true);
    const v = table.view(players[2].id, false);
    expect(v.seats.find((s) => s.player.id === players[2].id)?.waitingNextRound).toBe(true);
    const roundView = v.round!.view as { myHand: unknown; players: unknown[] };
    expect(roundView.myHand).toBeNull();
    expect(roundView.players).toHaveLength(2);
    const r = table.action(players[2].id, env(table, 'pass', {}));
    expect(r.ok).toBe(false);
  });

  it('hành động gửi lặp không áp dụng hai lần; phiên bản cũ bị từ chối', () => {
    const { table, players } = makeTable('sam');
    table.join(players[0].id);
    table.join(players[1].id);
    table.setReady(players[0].id, true);
    table.setReady(players[1].id, true);
    // Bỏ qua báo Sâm
    for (const p of players.slice(0, 2)) table.action(p.id, env(table, 'declareSam', { declare: false }));
    const v = table.view(null, false).round!.view as { turnPlayerId: string };
    const turn = v.turnPlayerId;
    const hand = (table.view(turn, false).round!.view as { myHand: string[] }).myHand;
    const e = env(table, 'play', { cards: [hand[0]] }, 'dup-action-1');
    const r1 = table.action(turn, e);
    expect(r1.ok).toBe(true);
    const version = table.view(null, false).round!.stateVersion;
    const r2 = table.action(turn, e);
    expect(r2).toEqual(r1);
    expect(table.view(null, false).round!.stateVersion).toBe(version);
    // phiên bản cũ
    const stale = { ...env(table, 'pass', {}), stateVersion: 0 };
    const other = players.find((p) => p.id !== turn)!;
    const r3 = table.action(other.id, stale);
    expect(r3.ok).toBe(false);
    expect(!r3.ok && r3.code).toBe('STALE_STATE');
  });

  it('quyết toán đúng một lần và số dư khớp ledger', () => {
    const { table, players } = makeTable('sam');
    table.join(players[0].id);
    table.join(players[1].id);
    table.setReady(players[0].id, true);
    table.setReady(players[1].id, true);
    // Ép trạng thái để ván kết thúc ngay ở nước tiếp theo.
    const internal = table as unknown as { round: { state: SamState } };
    const st = internal.round.state;
    st.phase = 'PLAYING';
    st.turn = 0;
    st.players[0].hand = ['3S'];
    st.players[1].hand = ['5H', '6H', '7D'];
    const winner = st.players[0].id;
    const r = table.action(winner, env(table, 'play', { cards: ['3S'] }));
    expect(r.ok).toBe(true);
    const v = table.view(winner, false);
    expect(v.status).toBe('ROUND_FINISHED');
    expect(v.lastResult?.winners).toEqual([winner]);
    const start = samEngine.defaultConfig.startingBalance;
    const winnerSeat = v.seats.find((s) => s.player.id === winner)!;
    const loserSeat = v.seats.find((s) => s.player.id !== winner)!;
    expect(winnerSeat.balance).toBe(start + 30);
    expect(loserSeat.balance).toBe(start - 30);
    // Quyết toán lại cùng ván không có tác dụng
    const again = store.settleSession(v.lastResult!.roundId, 'sam', {}, [{ key: 'x', playerId: winner, amount: 999, reason: 'x' }]);
    expect(again.applied).toBe(false);
    expect(store.getBalance(winner, 'sam')).toBe(start + 30);
  });

  it('rời bàn giữa ván: máy đánh thay, chỗ được dọn khi hết ván', () => {
    const { table, players } = makeTable('exploding-cats');
    table.join(players[0].id);
    table.join(players[1].id);
    table.setReady(players[0].id, true);
    table.setReady(players[1].id, true);
    expect(table.status).toBe('PLAYING');
    table.leave(players[0].id);
    // Mèo Nổ: rời ván = bị loại → còn 1 người → kết thúc
    expect(table.status).toBe('ROUND_FINISHED');
    expect(table.isSeated(players[0].id)).toBe(false);
    expect(table.view(null, false).lastResult?.winners).toEqual([players[1].id]);
  });

  it('mất kết nối không bị loại ngay; quá thời gian mới xử lý theo chính sách', () => {
    const { table, players } = makeTable('exploding-cats');
    table.join(players[0].id);
    table.join(players[1].id);
    table.setReady(players[0].id, true);
    table.setReady(players[1].id, true);
    table.setConnected(players[0].id, false);
    clock += 10_000;
    table.tick();
    expect(table.status).toBe('PLAYING');
    clock += catsEngine.defaultConfig.disconnectTimeoutMs;
    table.tick();
    expect(table.status).toBe('ROUND_FINISHED');
  });

  it('cấu hình chỉ hợp lệ trong giới hạn; ván đang chơi dùng cấu hình đã đóng băng', () => {
    const { table, players } = makeTable('sam');
    expect(table.adminConfig({ maxPlayers: 9 }).ok).toBe(false);
    expect(table.adminConfig({ perCardPenalty: -1 }).ok).toBe(false);
    expect(table.adminConfig({ perCardPenalty: 1.5 }).ok).toBe(false);
    table.join(players[0].id);
    table.join(players[1].id);
    table.setReady(players[0].id, true);
    table.setReady(players[1].id, true);
    expect(table.adminConfig({ perCardPenalty: 99 }).ok).toBe(true);
    const internal = table as unknown as { round: { state: SamState } };
    expect(internal.round.state.config.perCardPenalty).toBe(samEngine.defaultConfig.perCardPenalty);
    expect((table.config as { perCardPenalty: number }).perCardPenalty).toBe(99);
  });

  it('không thể bắt đầu khi bộ bài không hợp lệ, báo lỗi rõ ràng', () => {
    const { table, players } = makeTable('exploding-cats');
    expect(table.adminConfig({ deckCopies: 1, handSize: 8 }).ok).toBe(true);
    for (let i = 0; i < 6; i++) table.join(players[i].id);
    expect(table.startBlocker()).toMatch(/Hãy tăng số bộ bài/);
    for (let i = 0; i < 6; i++) table.setReady(players[i].id, true);
    expect(table.status).not.toBe('PLAYING');
  });

  it('tạm dừng chặn hành động và dời hạn lượt khi mở lại', () => {
    const { table, players } = makeTable('exploding-cats');
    table.join(players[0].id);
    table.join(players[1].id);
    table.setReady(players[0].id, true);
    table.setReady(players[1].id, true);
    const before = (table.view(null, false).round!.view as { deadline: number }).deadline;
    table.adminStatus('PAUSED');
    expect(table.status).toBe('PAUSED');
    const cur = (table.view(null, false).round!.view as { currentId: string }).currentId;
    expect(table.action(cur, env(table, 'draw', {})).ok).toBe(false);
    clock += 5000;
    table.adminStatus('OPEN');
    const after = (table.view(null, false).round!.view as { deadline: number }).deadline;
    expect(after).toBe(before + 5000);
  });
});
