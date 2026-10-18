import { useEffect, useMemo, useRef, useState } from 'react';
import { CATS_CARD_BY_ID, type CatsCardInst, type CatsRoundView, type TableView } from '@chieu-bai/shared';
import { Avatar } from '../../assets/avatars';
import { CatsCardFace } from '../../assets/cats-cards';
import { CardBack } from '../../assets/playing-cards';
import { IconSkull } from '../../assets/icons';
import { playSfx } from '../../audio/sfx';
import { sendAction } from '../../net/client';
import { useCountdown } from '../../net/hooks';
import { CountdownRing, Modal, toast } from '../../ui/ui';
import { AlterModal, CardPickerModal, DigModal, PositionModal, StealPickModal } from './CatsChoices';
import { CatsHand, useHandOrder } from './CatsHand';

const def = (id: string) => CATS_CARD_BY_ID[id];

type SelectionInfo = { ok: false; text: string } | { ok: true; needsTarget: boolean; needsName: boolean; text: string };

function TimeBombBadge({ turnsLeft }: { turnsLeft: number }) {
  return (
    <span className={`timebomb-badge ${turnsLeft <= 1 ? 'urgent' : ''}`} aria-label={`Mèo Hẹn Giờ: còn ${turnsLeft} lượt`}>
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
        <circle cx="11" cy="14" r="8" fill="#22202a" />
        <path d="M14 6 C 16 2 20 3 21 1" stroke="#ffd45c" strokeWidth="2" fill="none" />
        <path d="M11 14 L11 9 M11 14 L14 16" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      {turnsLeft}
    </span>
  );
}

function describeSelection(cards: CatsCardInst[], ctx: { holdingTimeBomb: boolean; anyTimeBomb: boolean }): SelectionInfo | null {
  if (cards.length === 0) return null;
  const defs = cards.map((c) => def(c.def));
  if (cards.length === 1) {
    const d = defs[0];
    if (d.id === 'pass_bomb' && !ctx.holdingTimeBomb) return { ok: false, text: 'Bạn không giữ Mèo Hẹn Giờ nào để chuyền.' };
    if (d.id === 'fast_forward' && !ctx.anyTimeBomb) return { ok: false, text: 'Chưa có Mèo Hẹn Giờ nào đang đếm ngược.' };
    if (d.category === 'collection') return { ok: false, text: 'Lá mèo sưu tập cần đánh theo cặp hoặc bộ ba (Mèo Hoang ghép được với mọi mèo).' };
    if (d.effectType === 'nope') return { ok: false, text: '"Không!" chỉ dùng khi có người vừa đánh hành động.' };
    if (d.effectType === 'defuse') return { ok: false, text: 'Gỡ Bom tự động dùng khi bạn rút phải Mèo Nổ.' };
    if (d.effectType === 'passive') return { ok: false, text: d.description };
    if (d.category === 'exploding') return { ok: false, text: 'Bạn đang giữ Mèo Nổ nhờ Mèo Liều — đừng để mất Mèo Liều!' };
    return { ok: true, needsTarget: d.requiresTarget, needsName: false, text: d.description };
  }
  const nonFeral = defs.filter((d) => d.id !== 'feral_cat');
  const valid = cards.length <= 3 && defs.every((d) => d.category === 'collection') && new Set(nonFeral.map((d) => d.id)).size <= 1;
  if (!valid) return { ok: false, text: 'Combo phải gồm 2 hoặc 3 lá mèo giống nhau (Mèo Hoang thay được bất kỳ mèo nào).' };
  return {
    ok: true,
    needsTarget: true,
    needsName: cards.length === 3,
    text: cards.length === 2 ? 'Cặp mèo: chọn 1 lá úp trên tay người bạn nhắm tới.' : 'Bộ ba mèo: gọi tên 1 lá, nếu người đó có thì phải đưa cho bạn.',
  };
}

export function CatsBoard({ view, clockOffset }: { view: TableView; clockOffset: number }) {
  const r = view.round!.view as CatsRoundView;
  const meId = view.you.playerId;
  const me = r.players.find((p) => p.id === meId) ?? null;
  const cfg = view.config as { turnTimeMs: number; nopeWindowMs: number; choiceTimeMs: number };
  const [selected, setSelected] = useState<string[]>([]);
  const [targeting, setTargeting] = useState(false);
  const [naming, setNaming] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [futureOpen, setFutureOpen] = useState(false);
  const remaining = useCountdown(r.deadline, clockOffset);
  const pending = r.pending;
  const myTurn = !!me?.alive && r.currentId === meId && r.phase === 'PLAYING';
  const idle = myTurn && !pending;
  const hand = useMemo(() => r.myHand ?? [], [r.myHand]);
  const handKey = hand.map((c) => c.id).join(',');
  const { ordered, setOrder, autoSort, setAutoSort, sortNow } = useHandOrder(hand);
  const choice = { remaining, total: cfg.choiceTimeMs };

  useEffect(() => setSelected((s) => s.filter((id) => hand.some((c) => c.id === id))), [handKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!idle) {
      setTargeting(false);
      setNaming(null);
    }
  }, [idle]);

  // Xem Trước Tương Lai / Chia Sẻ Tương Lai: mở khi có kết quả mới.
  const lastFuture = useRef<number | null>(null);
  useEffect(() => {
    if (r.seeFuture && r.seeFuture.seq !== lastFuture.current) {
      lastFuture.current = r.seeFuture.seq;
      setFutureOpen(true);
    }
  }, [r.seeFuture?.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hiệu ứng lớn theo sự kiện công khai.
  const [fx, setFx] = useState<{ seq: number; type: string; text: string } | null>(null);
  const lastSeq = useRef<number | null>(null);
  useEffect(() => {
    const e = r.lastEvent;
    if (!e) return;
    if (lastSeq.current === null) {
      lastSeq.current = e.seq;
      return;
    }
    if (e.seq === lastSeq.current) return;
    lastSeq.current = e.seq;
    const name = (id?: string) => r.players.find((p) => p.id === id)?.nickname ?? '';
    const map: Record<string, string> = {
      explode: e.cardDefs?.includes('smoke_bomb')
        ? `${name(e.actorId)} dính BOM KHÓI!`
        : e.cardDefs?.includes('chain_bomb')
          ? 'NỔ DÂY CHUYỀN!'
          : e.cardDefs?.includes('time_bomb')
            ? 'MÈO HẸN GIỜ PHÁT NỔ!'
            : `${name(e.actorId)} dính MÈO NỔ!`,
      implode: `${name(e.actorId)} rút phải MÈO NỔ SẬP!`,
      eliminate: `${name(e.actorId)} đã bị loại!`,
      nope: 'KHÔNG!',
      defuse: 'Đã gỡ bom!',
      shuffle: 'Xáo tung!',
      mark: e.cardDefs ? 'Bị đánh dấu!' : 'Ta lấy nhé!',
      timebomb: e.targetId ? 'Chuyền bom!' : 'MÈO HẸN GIỜ!',
    };
    if (map[e.type]) {
      setFx({ seq: e.seq, type: e.type, text: map[e.type] });
      const t = setTimeout(() => setFx((f) => (f?.seq === e.seq ? null : f)), e.type === 'explode' || e.type === 'implode' ? 1800 : 1200);
      return () => clearTimeout(t);
    }
  }, [r.lastEvent?.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  const selCards = useMemo(() => selected.map((id) => hand.find((c) => c.id === id)!).filter(Boolean), [selected, handKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const myTimeBomb = r.timeBombs.find((b) => b.holderId === meId) ?? null;
  const info = describeSelection(selCards, { holdingTimeBomb: !!myTimeBomb, anyTimeBomb: r.timeBombs.length > 0 });
  const myClaimer = r.claims.find((c) => c.targetId === meId)?.claimerId ?? null;

  async function send(type: string, payload: unknown = {}) {
    setSending(true);
    const res = await sendAction(view, type, payload);
    setSending(false);
    if (!res.ok) toast(res.error, 'error');
    return res.ok;
  }

  async function play(targetId?: string, namedDef?: string) {
    const ok = await send('play', { cardIds: selected, ...(targetId ? { targetId } : {}), ...(namedDef ? { namedDef } : {}) });
    if (ok) {
      setSelected([]);
      setTargeting(false);
      setNaming(null);
    }
  }

  function onPlayClick() {
    if (!info?.ok) return;
    if (info.needsTarget) setTargeting(true);
    else play();
  }

  function toggle(id: string) {
    playSfx('click');
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  const name = (id: string | null | undefined) => r.players.find((p) => p.id === id)?.nickname ?? '?';
  const seatOf = (id: string) => view.seats.find((s) => s.player.id === id);
  const singleEffect = selCards.length === 1 ? def(selCards[0].def).effectType : null;
  const NO_CARD_TARGET = ['targeted_attack', 'pass_bomb', 'take_that'];
  const targets = r.players.filter(
    (p) =>
      p.alive &&
      p.id !== meId &&
      (NO_CARD_TARGET.includes(singleEffect ?? '') || p.cardCount > 0) &&
      !(singleEffect === 'take_that' && r.claims.some((c) => c.targetId === p.id)),
  );
  const myNope = hand.find((c) => c.def === 'nope');

  // Thứ tự hiển thị: bắt đầu từ người kế tiếp sau bạn.
  const myIdx = Math.max(0, r.order.indexOf(meId ?? ''));
  const ring = me ? [...r.players.slice(myIdx + 1), ...r.players.slice(0, myIdx)] : r.players;

  const statusText = (() => {
    if (r.phase === 'ROUND_FINISHED') return <>{name(r.winnerId)} là chú mèo sống sót cuối cùng!</>;
    switch (pending?.kind) {
      case 'favor':
        return pending.giverId === meId ? <>Bạn phải chọn 1 lá đưa cho <b>{name(pending.receiverId)}</b>…</> : <>{name(pending.giverId)} đang chọn lá đưa cho <b>{name(pending.receiverId)}</b>…</>;
      case 'defuse':
        return pending.playerId === meId ? 'Bạn đã gỡ bom! Chọn chỗ giấu Mèo Nổ.' : `${name(pending.playerId)} đang bí mật giấu Mèo Nổ vào chồng bài…`;
      case 'implode_place':
        return pending.playerId === meId ? 'Chọn chỗ đặt Mèo Nổ Sập (lật ngửa, cả bàn đều thấy).' : `${name(pending.playerId)} đang đặt Mèo Nổ Sập lật ngửa vào chồng bài…`;
      case 'alter':
        return pending.playerId === meId ? 'Sắp xếp lại 3 lá trên cùng.' : `${name(pending.playerId)} đang sắp đặt tương lai…`;
      case 'steal_pick':
        return pending.actorId === meId ? `Chọn 1 lá trên tay ${name(pending.targetId)}.` : `${name(pending.actorId)} đang chọn 1 lá trên tay ${name(pending.targetId)}…`;
      case 'garbage':
        return pending.waitingFor.includes(meId ?? '') ? 'Dọn Rác: chọn 1 lá để xáo vào chồng bài.' : `Dọn Rác — chờ ${pending.waitingFor.length} người chọn lá…`;
      case 'potluck':
        return pending.currentId === meId ? 'Góp Lẩu: úp 1 lá lên chồng bài.' : `Góp Lẩu — ${name(pending.currentId)} đang chọn lá…`;
      case 'bury':
        return pending.playerId === meId ? 'Chọn chỗ chôn lá vừa rút.' : `${name(pending.playerId)} đang chôn một lá…`;
      case 'dig':
        return pending.playerId === meId ? 'Giữ lá trên cùng hay đào xuống lá bên dưới?' : `${name(pending.playerId)} đang đào sâu…`;
      default:
        return myTurn ? (
          <>Lượt của bạn{r.turnsRemaining > 1 ? ` (còn ${r.turnsRemaining} lượt)` : ''} — đánh bài hoặc rút bài.</>
        ) : (
          <>
            Đến lượt {name(r.currentId)}
            {r.turnsRemaining > 1 ? ` (×${r.turnsRemaining})` : ''}.
          </>
        );
    }
  })();

  return (
    <div className={`cats-board ${myTurn ? 'my-turn' : ''}`}>
      <div className="cats-arena">
        <div className="cats-players">
          {ring.map((p) => {
            const active = r.currentId === p.id && r.phase === 'PLAYING';
            const seat = seatOf(p.id);
            const targeted = (pending?.kind === 'action' && pending.targetId === p.id) || (pending?.kind === 'steal_pick' && pending.targetId === p.id);
            return (
              <div key={p.id} className={`cats-player ${active ? 'active' : ''} ${p.alive ? '' : 'dead'} ${targeted ? 'targeted' : ''}`}>
                <div className="cats-player-avatar">
                  <Avatar avatar={seat?.player.avatar ?? 'meo-cam'} size={50} />
                  {!p.alive && (
                    <span className="dead-mark" aria-label="Đã bị loại">
                      <IconSkull width={26} height={26} />
                    </span>
                  )}
                  {active && !pending && (
                    <span className="seat-timer">
                      <CountdownRing remaining={remaining} total={cfg.turnTimeMs} size={28} />
                    </span>
                  )}
                </div>
                <b>{p.nickname}</b>
                <span className="cats-count">{p.alive ? `${p.cardCount} lá` : 'Bị loại'}</span>
                {p.marked.length > 0 && (
                  <span className="marked-row" aria-label={`Lá bị lộ: ${p.marked.map((d) => def(d)?.name).join(', ')}`}>
                    {p.marked.map((d, i) => (
                      <span key={i} className="marked-mini">
                        <CatsCardFace defId={d} small />
                      </span>
                    ))}
                  </span>
                )}
                {r.timeBombs
                  .filter((b) => b.holderId === p.id)
                  .map((b, i) => (
                    <TimeBombBadge key={i} turnsLeft={b.turnsLeft} />
                  ))}
                {r.claims.some((c) => c.targetId === p.id) && (
                  <span className="tag tag-claim">Bị {name(r.claims.find((c) => c.targetId === p.id)!.claimerId)} giành lá</span>
                )}
                {active && r.turnsRemaining > 1 && <span className="tag tag-warn">×{r.turnsRemaining} lượt</span>}
                {seat && !seat.connected && <span className="tag tag-off">Mất kết nối</span>}
              </div>
            );
          })}
        </div>

        <div className="cats-table">
          <div className="direction" aria-label={r.direction === 1 ? 'Chiều chơi thuận' : 'Chiều chơi đảo ngược'}>
            {r.direction === 1 ? '↻' : '↺'}
          </div>
          <div className="pile deck-pile">
            <div className="pile-stack" style={{ ['--n' as string]: Math.min(6, Math.ceil(r.deckCount / 6)) }}>
              {r.implodingPos === 0 ? <CatsCardFace defId="imploding" /> : <CardBack variant="cats" />}
            </div>
            <span className="pile-label">
              Chồng bài: <b>{r.deckCount}</b> lá · <b className="bomb-count">{r.bombsLeft}</b> bom chết người
            </span>
            {r.implodingPos !== null && (
              <span className="implode-warn">
                Mèo Nổ Sập đang ngửa ở vị trí <b>{r.implodingPos + 1}</b> từ trên
              </span>
            )}
            {idle && (
              <button className="btn btn-primary btn-lg draw-btn" onClick={() => send('draw')} disabled={sending}>
                Rút bài & kết thúc lượt
              </button>
            )}
          </div>
          <div className="pile discard-pile">
            {r.discardTop.length ? (
              <div className="discard-stack">
                {r.discardTop.slice(-3).map((d, i, arr) => (
                  <div key={`${d}-${i}-${r.discardCount}`} className={`discard-card ${i === arr.length - 1 ? 'top' : ''}`} style={{ ['--i' as string]: i }}>
                    <CatsCardFace defId={d} small />
                  </div>
                ))}
              </div>
            ) : (
              <div className="discard-empty">Chồng bài bỏ</div>
            )}
            <span className="pile-label">Đã bỏ: {r.discardCount} lá</span>
          </div>
        </div>

        <div className="cats-status" aria-live="polite">
          {pending?.kind === 'action' ? (
            <div className="pending-action">
              <div className="pending-cards">
                {pending.cardDefs.map((d, i) => (
                  <div key={i} className="pending-card">
                    <CatsCardFace defId={d} />
                  </div>
                ))}
                {pending.nopeChain.map((_, i) => (
                  <div key={`n${i}`} className="pending-card nope-stack" style={{ ['--i' as string]: i }}>
                    <CatsCardFace defId="nope" />
                  </div>
                ))}
              </div>
              <div className="pending-text">
                <p>
                  <b>{name(pending.actorId)}</b> đánh {pending.cardDefs.length > 1 ? pending.cardDefs.map((d) => def(d).name).join(' + ') : def(pending.cardDefs[0]).name}
                  {pending.targetId ? (
                    <>
                      {' '}
                      vào <b>{name(pending.targetId)}</b>
                    </>
                  ) : null}
                  {pending.namedDef ? (
                    <>
                      , đòi lá <b>{def(pending.namedDef).name}</b>
                    </>
                  ) : null}
                </p>
                {pending.nopeChain.length > 0 && (
                  <p className={pending.willResolve ? 'good' : 'bad'}>
                    {pending.nopeChain.map(name).join(' → ')}: "Không!" — {pending.willResolve ? 'hành động sẽ có hiệu lực' : 'hành động sẽ bị chặn'}
                  </p>
                )}
                <div className="row">
                  <CountdownRing remaining={remaining} total={cfg.nopeWindowMs} size={34} />
                  {pending.canNope && myNope && (
                    <button className="btn btn-danger btn-lg" onClick={() => send('nope', { cardId: myNope.id })} disabled={sending}>
                      Không!
                    </button>
                  )}
                  {pending.canPass && (
                    <button className="btn btn-ghost light" onClick={() => send('pass')} disabled={sending}>
                      Cho qua
                    </button>
                  )}
                  {!pending.canPass && pending.waitingFor.length > 0 && <span className="muted small">Chờ {pending.waitingFor.length} người phản ứng…</span>}
                </div>
              </div>
            </div>
          ) : (
            <p className="status-big">
              {statusText}
              {pending && pending.kind !== 'favor' && remaining !== null && (
                <span className="status-timer">
                  <CountdownRing remaining={remaining} total={cfg.choiceTimeMs} size={26} />
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {me ? (
        <div className={`cats-me ${me.alive ? '' : 'dead'}`}>
          <div className="cats-me-bar">
            <div className="sam-me-id">
              <Avatar avatar={seatOf(me.id)?.player.avatar ?? 'meo-cam'} size={40} />
              <div>
                <b>{me.nickname}</b>
                <span className="muted small">{me.alive ? `${hand.length} lá trên tay` : 'Bạn đã bị loại — hãy xem tiếp nhé!'}</span>
              </div>
              {myTurn && !pending && (
                <>
                  <span className="your-turn">Lượt của bạn</span>
                  <CountdownRing remaining={remaining} total={cfg.turnTimeMs} size={34} />
                </>
              )}
              {myTimeBomb && (
                <span className="tag tag-off big-tag">
                  <TimeBombBadge turnsLeft={myTimeBomb.turnsLeft} /> Bạn đang giữ Mèo Hẹn Giờ — chuyền đi hoặc chuẩn bị Gỡ Bom!
                </span>
              )}
              {myClaimer && <span className="tag tag-claim big-tag">Lá tiếp theo bạn rút sẽ về tay {name(myClaimer)}</span>}
            </div>
            {me.alive && hand.length > 1 && (
              <div className="hand-tools">
                <button className="btn btn-ghost light sm" onClick={sortNow} disabled={autoSort}>
                  Xếp bài
                </button>
                <label className="toggle-chip">
                  <input type="checkbox" checked={autoSort} onChange={(e) => setAutoSort(e.target.checked)} />
                  Tự xếp
                </label>
                <span className="muted small hand-hint">Kéo lá để đổi chỗ (điện thoại: nhấn giữ rồi kéo)</span>
              </div>
            )}
          </div>
          {info && (
            <div className={`sel-info ${info.ok ? 'good' : 'bad'}`}>
              <span>{info.text}</span>
              {idle && info.ok && (
                <button className="btn btn-primary" onClick={onPlayClick} disabled={sending}>
                  Đánh {selCards.length > 1 ? `${selCards.length} lá` : def(selCards[0].def).name}
                </button>
              )}
            </div>
          )}
          <CatsHand cards={ordered} setOrder={setOrder} selected={selected} onToggle={toggle} markedIds={r.myMarked} />
        </div>
      ) : (
        <div className="cats-me spectator">
          <p className="muted">Bạn đang xem bàn. Bài trên tay và chồng bài được giữ kín.</p>
        </div>
      )}

      {fx && (
        <div key={fx.seq} className={`fx fx-${fx.type}`} aria-hidden>
          <span>{fx.text}</span>
        </div>
      )}

      {/* Chọn mục tiêu */}
      <Modal open={targeting && !naming} title="Chọn người chơi" onClose={() => setTargeting(false)}>
        <div className="target-grid">
          {targets.map((p) => (
            <button
              key={p.id}
              className="target-btn"
              onClick={() => {
                if (info?.ok && info.needsName) setNaming(p.id);
                else play(p.id);
              }}
            >
              <Avatar avatar={seatOf(p.id)?.player.avatar ?? 'meo-cam'} size={56} />
              <b>{p.nickname}</b>
              <span className="muted small">{p.cardCount} lá</span>
            </button>
          ))}
          {targets.length === 0 && <p className="muted">Không có ai để chọn.</p>}
        </div>
      </Modal>

      {/* Gọi tên lá (bộ ba) */}
      <Modal open={!!naming} title={`Đòi lá nào từ ${name(naming)}?`} onClose={() => setNaming(null)} wide>
        <div className="name-grid">
          {r.enabledCardIds
            .filter((id) => !['exploding', 'imploding', 'time_bomb'].includes(id))
            .map((id) => (
              <button key={id} className="name-btn" onClick={() => play(naming!, id)}>
                <CatsCardFace defId={id} small />
              </button>
            ))}
        </div>
      </Modal>

      {pending?.kind === 'favor' && pending.giverId === meId && (
        <CardPickerModal
          title={`Chọn 1 lá đưa cho ${name(pending.receiverId)}`}
          note="Hết giờ sẽ đưa ngẫu nhiên."
          cards={ordered}
          onPick={(cardId) => send('giveFavor', { cardId })}
          busy={sending}
          {...choice}
        />
      )}
      {pending?.kind === 'garbage' && meId && pending.waitingFor.includes(meId) && (
        <CardPickerModal
          title="Dọn Rác — chọn 1 lá bỏ vào chồng bài"
          note="Lá này sẽ được xáo vào chồng bài. Hết giờ sẽ chọn ngẫu nhiên."
          cards={ordered}
          onPick={(cardId) => send('garbageCard', { cardId })}
          busy={sending}
          {...choice}
        />
      )}
      {pending?.kind === 'potluck' && pending.currentId === meId && (
        <CardPickerModal
          title="Góp Lẩu — úp 1 lá lên trên cùng chồng bài"
          note="Người góp sau sẽ úp đè lên lá của bạn. Hết giờ sẽ chọn ngẫu nhiên."
          cards={ordered}
          onPick={(cardId) => send('potluckCard', { cardId })}
          busy={sending}
          {...choice}
        />
      )}
      {pending?.kind === 'steal_pick' && pending.actorId === meId && (
        <StealPickModal targetName={name(pending.targetId)} slots={pending.slots} onPick={(index) => send('pickSteal', { index })} busy={sending} {...choice} />
      )}
      {pending?.kind === 'defuse' && pending.playerId === meId && (
        <PositionModal
          title="Giấu Mèo Nổ vào chồng bài"
          note="Không ai khác biết vị trí bạn chọn. Hết giờ sẽ đặt ngẫu nhiên."
          deckCount={pending.deckCount}
          confirmLabel="Giấu bom"
          onPlace={(position) => send('placeBomb', { position })}
          {...choice}
        />
      )}
      {pending?.kind === 'implode_place' && pending.playerId === meId && (
        <PositionModal
          title="Đặt Mèo Nổ Sập (lật ngửa)"
          note="Lá được lật ngửa nên cả bàn sẽ thấy vị trí. Ai rút trúng lần sau sẽ bị loại ngay."
          deckCount={pending.deckCount}
          card="imploding"
          confirmLabel="Đặt lá"
          onPlace={(position) => send('placeImploding', { position })}
          {...choice}
        />
      )}
      {pending?.kind === 'bury' && pending.playerId === meId && (
        <PositionModal
          title="Chôn Bài"
          note="Chỉ mình bạn biết lá này và vị trí chôn. Hết giờ sẽ chôn ngẫu nhiên."
          deckCount={pending.deckCount}
          card={pending.cardDef}
          confirmLabel="Chôn"
          onPlace={(position) => send('buryCard', { position })}
          {...choice}
        />
      )}
      {pending?.kind === 'dig' && pending.playerId === meId && (
        <DigModal topDef={pending.topDef} onChoose={(keep) => send('digChoice', { keep })} busy={sending} {...choice} />
      )}
      {pending?.kind === 'alter' && pending.playerId === meId && pending.cards && (
        <AlterModal cards={pending.cards} shareWith={pending.share ? name(pending.sharedWith) : null} onConfirm={(order) => send('alterFuture', { order })} {...choice} />
      )}

      <Modal
        open={futureOpen && !!r.seeFuture}
        title={r.seeFuture?.from ? `${name(r.seeFuture.from)} chia sẻ 3 lá trên cùng` : 'Xem Trước Tương Lai — 3 lá trên cùng'}
        onClose={() => setFutureOpen(false)}
      >
        <p className="muted small">Từ trái sang phải: lá trên cùng trước. Chỉ mình bạn thấy.</p>
        <div className="future-row">
          {r.seeFuture?.defs.map((d, i) => (
            <div key={i} className="future-card">
              <span className="future-idx">{i + 1}</span>
              <CatsCardFace defId={d} />
            </div>
          ))}
          {r.seeFuture?.defs.length === 0 && <p className="muted">Chồng bài trống.</p>}
        </div>
        <button className="btn btn-primary btn-block" onClick={() => setFutureOpen(false)}>
          Đã nhớ!
        </button>
      </Modal>
    </div>
  );
}
