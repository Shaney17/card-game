import { useEffect, useRef, useState } from 'react';
import type { SamResultDetail, TableView } from '@chieu-bai/shared';
import { Avatar } from '../../assets/avatars';
import { IconCrown } from '../../assets/icons';
import { CardFace } from '../../assets/playing-cards';
import { Confetti, Modal, formatMoney } from '../../ui/ui';
import { createStore, useStore } from '../../net/store';

/** Cho phép mở lại bảng kết quả từ nơi khác (nút "Xem kết quả"). */
export const resultModalOpen = createStore(false);

/** Màn hình kết quả cuối ván: người thắng, bài còn lại, tiền thay đổi & số dư mới. */
export function ResultModal({ view, meId, onReady }: { view: TableView; meId: string | null; onReady: () => void }) {
  const result = view.lastResult;
  // Kết quả đã có sẵn khi mở trang thì không tự bật lại.
  const [seen, setSeen] = useState<string | null>(() => result?.roundId ?? null);
  const open = useStore(resultModalOpen);
  const setOpen = resultModalOpen.set;
  const mountedAt = useRef(Date.now());
  useEffect(() => {
    if (result && result.roundId !== seen) {
      setSeen(result.roundId);
      if (Date.now() - mountedAt.current < 300) return;
      // Chờ một nhịp để người chơi thấy nước đánh cuối.
      const t = setTimeout(() => setOpen(true), 900);
      return () => clearTimeout(t);
    }
  }, [result?.roundId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!result) return null;

  const won = !!meId && result.winners.includes(meId);
  const nameOf = (id: string) => result.totals.find((t) => t.playerId === id) ?? null;
  const detail = view.gameId === 'sam' ? (result.detail as SamResultDetail) : null;
  const catsDetail = view.gameId === 'exploding-cats' ? (result.detail as { eliminated: string[]; winnerId: string | null }) : null;
  const rankOf = (id: string) => {
    if (!catsDetail) return null;
    if (catsDetail.winnerId === id) return 1;
    const i = catsDetail.eliminated.indexOf(id);
    return i < 0 ? null : result.totals.length - i;
  };
  const rows = catsDetail ? [...result.totals].sort((a, b) => (rankOf(a.playerId) ?? 99) - (rankOf(b.playerId) ?? 99)) : result.totals;
  const seatedMe = view.seats.some((s) => s.player.id === meId);

  return (
    <>
      {open && won && <Confetti seed={result.roundId} />}
      <Modal open={open} title={`Kết quả ván ${result.roundNumber}`} onClose={() => setOpen(false)} wide>
        <div className={`result ${won ? 'result-win' : meId && result.totals.some((t) => t.playerId === meId) ? 'result-lose' : ''}`}>
          <p className="result-title">
            <IconCrown width={26} height={26} /> {result.title}
          </p>
          {won && <p className="result-sub">Bạn thắng ván này!</p>}
          <table className="result-table">
            <thead>
              <tr>
                {catsDetail && <th>Hạng</th>}
                <th>Người chơi</th>
                {detail && <th>Bài còn lại</th>}
                {view.gameId === 'sam' && <th className="num">Thay đổi</th>}
                {view.gameId === 'sam' && <th className="num">Số dư</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const p = nameOf(t.playerId);
                const hand = detail?.hands.find((h) => h.playerId === t.playerId);
                return (
                  <tr key={t.playerId} className={result.winners.includes(t.playerId) ? 'winner' : ''}>
                    {catsDetail && <td className="rank">#{rankOf(t.playerId) ?? '—'}</td>}
                    <td>
                      <span className="result-player">
                        {p && <Avatar avatar={p.avatar} size={28} />}
                        {p?.nickname ?? 'Người chơi'}
                        {hand?.cong && <span className="tag tag-off">Cóng</span>}
                        {!!hand?.twos && <span className="tag tag-warn">Thối {hand.twos} quân 2</span>}
                      </span>
                    </td>
                    {detail && (
                      <td>
                        <div className="mini-hand">
                          {hand?.cards.length ? hand.cards.map((c) => <CardFace key={c} code={c} />) : <span className="muted">—</span>}
                        </div>
                      </td>
                    )}
                    {view.gameId === 'sam' && (
                      <td className={`num ${t.delta > 0 ? 'pos' : t.delta < 0 ? 'neg' : ''}`}>
                        {t.delta > 0 ? '+' : ''}
                        {formatMoney(t.delta)}
                      </td>
                    )}
                    {view.gameId === 'sam' && <td className="num">{t.balance !== null ? formatMoney(t.balance) : '—'}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {detail && detail.transfers.length > 0 && (
            <details className="result-breakdown">
              <summary>Chi tiết quyết toán</summary>
              <ul>
                {detail.transfers.map((t, i) => (
                  <li key={i}>
                    <b>{nameOf(t.from)?.nickname ?? '?'}</b> trả <b>{nameOf(t.to)?.nickname ?? '?'}</b> {formatMoney(t.amount)} — {t.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="result-actions">
            {seatedMe && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  setOpen(false);
                  onReady();
                }}
              >
                Sẵn sàng ván mới
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => setOpen(false)}>
              Xem bàn
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
