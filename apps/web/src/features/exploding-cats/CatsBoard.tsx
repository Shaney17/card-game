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

const def = (id: string) => CATS_CARD_BY_ID[id];

function describeSelection(cards: CatsCardInst[]) {
  if (cards.length === 0) return null;
  const defs = cards.map((c) => def(c.def));
  if (cards.length === 1) {
    const d = defs[0];
    if (d.category === 'collection') return { ok: false, text: 'Lá mèo sưu tập cần đánh theo cặp hoặc bộ ba giống nhau.' };
    if (d.effectType === 'nope') return { ok: false, text: '"Không!" chỉ dùng khi có người vừa đánh hành động.' };
    if (d.effectType === 'defuse') return { ok: false, text: 'Gỡ Bom tự động dùng khi bạn rút phải Mèo Nổ.' };
    return { ok: true, needsTarget: d.requiresTarget, needsName: false, text: d.description };
  }
  const same = defs.every((d) => d.id === defs[0].id) && defs[0].category === 'collection';
  if (!same || cards.length > 3) return { ok: false, text: 'Combo phải gồm 2 hoặc 3 lá mèo giống hệt nhau.' };
  return {
    ok: true,
    needsTarget: true,
    needsName: cards.length === 3,
    text: cards.length === 2 ? 'Cặp mèo: cướp ngẫu nhiên 1 lá của người bạn chọn.' : 'Bộ ba mèo: gọi tên 1 lá, nếu người đó có thì phải đưa cho bạn.',
  };
}

export function CatsBoard({ view, clockOffset }: { view: TableView; clockOffset: number }) {
  const r = view.round!.view as CatsRoundView;
  const meId = view.you.playerId;
  const me = r.players.find((p) => p.id === meId) ?? null;
  const cfg = view.config as { turnTimeMs: number; nopeWindowMs: number; choiceTimeMs: number };
  const [selected, setSelected] = useState<string[]>([]);
  const [targeting, setTargeting] = useState(false);
  const [naming, setNaming] = useState<string | null>(null); // target đã chọn, đang gọi tên lá
  const [sending, setSending] = useState(false);
  const [futureOpen, setFutureOpen] = useState(false);
  const remaining = useCountdown(r.deadline, clockOffset);
  const pending = r.pending;
  const myTurn = !!me?.alive && r.currentId === meId && r.phase === 'PLAYING';
  const idle = myTurn && !pending;
  const hand = r.myHand ?? [];
  const handKey = hand.map((c) => c.id).join(',');

  useEffect(() => setSelected((s) => s.filter((id) => hand.some((c) => c.id === id))), [handKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!idle) {
      setTargeting(false);
      setNaming(null);
    }
  }, [idle]);

  // Mắt Thần: mở khi có kết quả mới.
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
      explode: `${name(e.actorId)} rút phải MÈO NỔ!`,
      eliminate: `${name(e.actorId)} đã bị loại!`,
      nope: 'KHÔNG!',
      defuse: 'Đã gỡ bom!',
      shuffle: 'Xáo tung!',
    };
    if (map[e.type]) {
      setFx({ seq: e.seq, type: e.type, text: map[e.type] });
      const t = setTimeout(() => setFx((f) => (f?.seq === e.seq ? null : f)), e.type === 'explode' ? 1800 : 1200);
      return () => clearTimeout(t);
    }
  }, [r.lastEvent?.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  const selCards = useMemo(() => selected.map((id) => hand.find((c) => c.id === id)!).filter(Boolean), [selected, handKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const info = describeSelection(selCards);

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
  const targets = r.players.filter((p) => p.alive && p.id !== meId && (selCards.length === 1 && def(selCards[0].def).effectType === 'targeted_attack' ? true : p.cardCount > 0));
  const myNope = hand.find((c) => c.def === 'nope');

  // Thứ tự hiển thị: bắt đầu từ người kế tiếp sau bạn.
  const myIdx = Math.max(0, r.order.indexOf(meId ?? ''));
  const ring = me ? [...r.players.slice(myIdx + 1), ...r.players.slice(0, myIdx)] : r.players;

  return (
    <div className={`cats-board ${myTurn ? 'my-turn' : ''}`}>
      <div className="cats-arena">
        <div className="cats-players">
          {ring.map((p) => {
            const active = r.currentId === p.id && r.phase === 'PLAYING';
            const seat = seatOf(p.id);
            return (
              <div key={p.id} className={`cats-player ${active ? 'active' : ''} ${p.alive ? '' : 'dead'} ${pending?.kind === 'action' && pending.targetId === p.id ? 'targeted' : ''}`}>
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
              <CardBack variant="cats" />
            </div>
            <span className="pile-label">
              Chồng bài: <b>{r.deckCount}</b> lá · <b className="bomb-count">{r.bombsInDeck}</b> Mèo Nổ
            </span>
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
          {r.phase === 'ROUND_FINISHED' ? (
            <p className="status-big">{name(r.winnerId)} là chú mèo sống sót cuối cùng!</p>
          ) : pending?.kind === 'action' ? (
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
                  <b>{name(pending.actorId)}</b> đánh {def(pending.cardDefs[0]).name}
                  {pending.cardDefs.length > 1 ? ` ×${pending.cardDefs.length}` : ''}
                  {pending.targetId ? <> vào <b>{name(pending.targetId)}</b></> : null}
                  {pending.namedDef ? <>, đòi lá <b>{def(pending.namedDef).name}</b></> : null}
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
                  {!pending.canPass && pending.waitingFor.length > 0 && (
                    <span className="muted small">Chờ {pending.waitingFor.length} người phản ứng…</span>
                  )}
                </div>
              </div>
            </div>
          ) : pending?.kind === 'favor' ? (
            <p className="status-big">
              {pending.giverId === meId ? 'Bạn phải chọn 1 lá để đưa cho ' : `${name(pending.giverId)} đang chọn lá đưa cho `}
              <b>{name(pending.receiverId)}</b>…
            </p>
          ) : pending?.kind === 'defuse' ? (
            <p className="status-big">{pending.playerId === meId ? 'Bạn đã gỡ bom! Chọn chỗ giấu Mèo Nổ.' : `${name(pending.playerId)} đang bí mật giấu Mèo Nổ vào chồng bài…`}</p>
          ) : pending?.kind === 'alter' ? (
            <p className="status-big">{pending.playerId === meId ? 'Sắp xếp lại 3 lá trên cùng.' : `${name(pending.playerId)} đang sắp đặt tương lai…`}</p>
          ) : (
            <p className="status-big">
              {myTurn ? (
                <>
                  Lượt của bạn{r.turnsRemaining > 1 ? ` (còn ${r.turnsRemaining} lượt)` : ''} — đánh bài hoặc rút bài.
                </>
              ) : (
                <>Đến lượt {name(r.currentId)}{r.turnsRemaining > 1 ? ` (×${r.turnsRemaining})` : ''}.</>
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
          </div>
          <div className="cats-hand" role="listbox" aria-label="Bài trên tay" aria-multiselectable>
            {hand.map((c, i) => (
              <button
                key={c.id}
                role="option"
                aria-selected={selected.includes(c.id)}
                className={`hand-card cats ${selected.includes(c.id) ? 'selected' : ''}`}
                style={{ ['--i' as string]: i }}
                onClick={() => toggle(c.id)}
                aria-label={def(c.def).name}
              >
                <CatsCardFace defId={c.def} />
              </button>
            ))}
          </div>
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
                if (info?.needsName) setNaming(p.id);
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
            .filter((id) => id !== 'exploding')
            .map((id) => (
              <button key={id} className="name-btn" onClick={() => play(naming!, id)}>
                <CatsCardFace defId={id} small />
              </button>
            ))}
        </div>
      </Modal>

      {/* Xin Xỏ: người bị chọn đưa bài */}
      <Modal open={pending?.kind === 'favor' && pending.giverId === meId} title={`Chọn 1 lá đưa cho ${pending?.kind === 'favor' ? name(pending.receiverId) : ''}`} dismissable={false}>
        <div className="row">
          <CountdownRing remaining={remaining} total={cfg.choiceTimeMs} />
          <span className="muted small">Hết giờ sẽ đưa ngẫu nhiên.</span>
        </div>
        <div className="name-grid">
          {hand.map((c) => (
            <button key={c.id} className="name-btn" onClick={() => send('giveFavor', { cardId: c.id })} disabled={sending}>
              <CatsCardFace defId={c.def} small />
            </button>
          ))}
        </div>
      </Modal>

      {pending?.kind === 'defuse' && pending.playerId === meId && (
        <DefuseModal deckCount={pending.deckCount} remaining={remaining} total={cfg.choiceTimeMs} onPlace={(pos) => send('placeBomb', { position: pos })} />
      )}

      {pending?.kind === 'alter' && pending.playerId === meId && pending.cards && (
        <AlterModal cards={pending.cards} remaining={remaining} total={cfg.choiceTimeMs} onConfirm={(order) => send('alterFuture', { order })} />
      )}

      <Modal open={futureOpen && !!r.seeFuture} title="Mắt Thần — 3 lá trên cùng" onClose={() => setFutureOpen(false)}>
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

function DefuseModal({ deckCount, remaining, total, onPlace }: { deckCount: number; remaining: number | null; total: number; onPlace: (pos: number) => void }) {
  const [pos, setPos] = useState(0);
  const label = pos === 0 ? 'Trên cùng (người kế tiếp rút ngay!)' : pos >= deckCount ? 'Dưới cùng' : `Lá thứ ${pos + 1} từ trên xuống`;
  return (
    <Modal open title="Giấu Mèo Nổ vào chồng bài" dismissable={false}>
      <div className="row">
        <CountdownRing remaining={remaining} total={total} />
        <span className="muted small">Không ai khác biết vị trí bạn chọn. Hết giờ sẽ đặt ngẫu nhiên.</span>
      </div>
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
          Giấu bom
        </button>
      </div>
    </Modal>
  );
}

function AlterModal({ cards, remaining, total, onConfirm }: { cards: CatsCardInst[]; remaining: number | null; total: number; onConfirm: (ids: string[]) => void }) {
  const [order, setOrder] = useState(cards);
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  };
  return (
    <Modal open title="Sắp Đặt Tương Lai" dismissable={false} wide>
      <div className="row">
        <CountdownRing remaining={remaining} total={total} />
        <span className="muted small">Lá số 1 sẽ được rút đầu tiên. Hết giờ sẽ giữ nguyên thứ tự.</span>
      </div>
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
