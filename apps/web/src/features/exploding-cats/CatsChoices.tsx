import { useState, type ReactNode } from 'react';
import { CATS_CARD_BY_ID, type CatsCardInst } from '@chieu-bai/shared';
import { CatsCardFace } from '../../assets/cats-cards';
import { CardBack } from '../../assets/playing-cards';
import { CountdownRing, Modal } from '../../ui/ui';

interface Timer {
  remaining: number | null;
  total: number;
}

function TimerRow({ remaining, total, note }: Timer & { note: ReactNode }) {
  return (
    <div className="row">
      <CountdownRing remaining={remaining} total={total} />
      <span className="muted small">{note}</span>
    </div>
  );
}

/** Chọn 1 lá trên tay (Xin Xỏ, Dọn Rác, Góp Lẩu). */
export function CardPickerModal({
  title,
  note,
  cards,
  onPick,
  busy,
  ...timer
}: Timer & { title: string; note: ReactNode; cards: CatsCardInst[]; onPick: (id: string) => void; busy: boolean }) {
  return (
    <Modal open title={title} dismissable={false} wide>
      <TimerRow {...timer} note={note} />
      <div className="name-grid">
        {cards.map((c) => (
          <button key={c.id} className="name-btn" onClick={() => onPick(c.id)} disabled={busy} aria-label={CATS_CARD_BY_ID[c.def]?.name}>
            <CatsCardFace defId={c.def} small />
          </button>
        ))}
      </div>
    </Modal>
  );
}

/** Cặp mèo: chọn 1 lá úp trên tay đối thủ. */
export function StealPickModal({
  targetName,
  slots,
  onPick,
  busy,
  ...timer
}: Timer & { targetName: string; slots: (string | null)[]; onPick: (index: number) => void; busy: boolean }) {
  return (
    <Modal open title={`Chọn 1 lá trên tay ${targetName}`} dismissable={false} wide>
      <TimerRow {...timer} note="Các lá được úp và xáo ngẫu nhiên. Lá đã bị Đánh Dấu thì lộ mặt. Hết giờ sẽ chọn ngẫu nhiên." />
      <div className="steal-grid">
        {slots.map((def, i) => (
          <button key={i} className={`steal-slot ${def ? 'revealed' : ''}`} onClick={() => onPick(i)} disabled={busy} aria-label={def ? `Lá ${i + 1}: ${CATS_CARD_BY_ID[def]?.name}` : `Lá úp thứ ${i + 1}`} style={{ ['--i' as string]: i }}>
            {def ? <CatsCardFace defId={def} small /> : <CardBack variant="cats" />}
            <span className="steal-idx">{i + 1}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

/** Chọn vị trí trong chồng bài (Gỡ Bom, Mèo Sập Nguồn, Chôn Bài). */
export function PositionModal({
  title,
  note,
  deckCount,
  card,
  confirmLabel,
  onPlace,
  ...timer
}: Timer & { title: string; note: ReactNode; deckCount: number; card?: string | null; confirmLabel: string; onPlace: (pos: number) => void }) {
  const [pos, setPos] = useState(0);
  const label = pos === 0 ? 'Trên cùng (người kế tiếp rút ngay!)' : pos >= deckCount ? 'Dưới cùng' : `Lá thứ ${pos + 1} từ trên xuống`;
  return (
    <Modal open title={title} dismissable={false}>
      <TimerRow {...timer} note={note} />
      {card && (
        <div className="position-card">
          <CatsCardFace defId={card} />
        </div>
      )}
      <label className="field">
        <span>{label}</span>
        <input type="range" min={0} max={deckCount} value={pos} onChange={(e) => setPos(Number(e.target.value))} />
      </label>
      <div className="row wrap">
        <button className="btn btn-ghost" onClick={() => setPos(0)}>
          Trên cùng
        </button>
        <button className="btn btn-ghost" onClick={() => setPos(Math.floor(Math.random() * (deckCount + 1)))}>
          Ngẫu nhiên
        </button>
        <button className="btn btn-ghost" onClick={() => setPos(deckCount)}>
          Dưới cùng
        </button>
        <button className="btn btn-primary" onClick={() => onPlace(pos)}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

/** Sắp Đặt / Chia Sẻ Tương Lai. */
export function AlterModal({
  cards,
  shareWith,
  onConfirm,
  ...timer
}: Timer & { cards: CatsCardInst[]; shareWith: string | null; onConfirm: (ids: string[]) => void }) {
  const [order, setOrder] = useState(cards);
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  };
  return (
    <Modal open title={shareWith ? 'Chia Sẻ Tương Lai' : 'Sắp Đặt Tương Lai'} dismissable={false} wide>
      <TimerRow
        {...timer}
        note={
          <>
            Lá số 1 sẽ được rút đầu tiên.{shareWith ? <> Sau khi xác nhận, <b>{shareWith}</b> sẽ được xem 3 lá này.</> : null} Hết giờ sẽ giữ nguyên thứ tự.
          </>
        }
      />
      <div className="future-row">
        {order.map((c, i) => (
          <div key={c.id} className="future-card">
            <span className="future-idx">{i + 1}</span>
            <CatsCardFace defId={c.def} />
            <div className="row">
              <button className="btn btn-ghost sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Đưa lên trước">
                ←
              </button>
              <button className="btn btn-ghost sm" onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label="Đưa ra sau">
                →
              </button>
            </div>
          </div>
        ))}
      </div>
      <button className="btn btn-primary btn-block" onClick={() => onConfirm(order.map((c) => c.id))}>
        Xác nhận thứ tự
      </button>
    </Modal>
  );
}

/** Đào Sâu: giữ lá trên cùng hay rút lá bên dưới. */
export function DigModal({ topDef, onChoose, busy, ...timer }: Timer & { topDef: string | null; onChoose: (keep: boolean) => void; busy: boolean }) {
  return (
    <Modal open title="Đào Sâu" dismissable={false}>
      <TimerRow {...timer} note="Chỉ mình bạn thấy lá này. Hết giờ sẽ giữ lá trên cùng." />
      {topDef && (
        <div className="position-card">
          <CatsCardFace defId={topDef} />
        </div>
      )}
      <div className="row wrap">
        <button className="btn btn-primary" onClick={() => onChoose(true)} disabled={busy}>
          Giữ lá này
        </button>
        <button className="btn btn-danger" onClick={() => onChoose(false)} disabled={busy}>
          Trả lại & rút lá bên dưới
        </button>
      </div>
    </Modal>
  );
}
