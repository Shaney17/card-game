import { useEffect, useMemo, useState } from 'react';
import { canBeat, describeCombo, detectCombo, enumerateCombos, sortCodes, type ComboRules, type SamRoundView, type TableView } from '@chieu-bai/shared';
import { Avatar } from '../../assets/avatars';
import { CardFace, cardLabel } from '../../assets/playing-cards';
import { playSfx } from '../../audio/sfx';
import { sendAction } from '../../net/client';
import { useCountdown } from '../../net/hooks';
import { CountdownRing, formatMoney, toast } from '../../ui/ui';

type SortMode = 'rank' | 'suit';
const SUIT_ORDER = { S: 0, C: 1, D: 2, H: 3 } as const;

export function SamBoard({ view, clockOffset }: { view: TableView; clockOffset: number }) {
  const r = view.round!.view as SamRoundView;
  const meId = view.you.playerId;
  const me = r.players.find((p) => p.id === meId) ?? null;
  const [selected, setSelected] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>('rank');
  const [sending, setSending] = useState(false);
  const remaining = useCountdown(r.deadline, clockOffset);
  const cfg = view.config as { turnTimeMs: number; samDeclareMs: number };
  const rules: ComboRules = r.rules;
  const forbidLastTwo = r.rules.lastCardTwo === 'forbidden';
  const myTurn = !!meId && r.turnPlayerId === meId;
  const finished = r.phase === 'ROUND_FINISHED';

  // Bỏ chọn những lá không còn trên tay.
  const handKey = r.myHand?.join(',') ?? '';
  useEffect(() => {
    setSelected((sel) => sel.filter((c) => r.myHand?.includes(c)));
  }, [handKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const hand = useMemo(() => {
    const h = r.myHand ?? [];
    if (sortMode === 'rank') return sortCodes(h);
    return [...sortCodes(h)].sort((a, b) => SUIT_ORDER[a.slice(-1) as 'S'] - SUIT_ORDER[b.slice(-1) as 'S']);
  }, [handKey, sortMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const top = r.trick[r.trick.length - 1];
  const topCombo = top ? detectCombo(top.cards, rules) : null;
  const selCombo = selected.length ? detectCombo(sortCodes(selected), rules) : null;
  const beats = selCombo && (!topCombo || canBeat(selCombo, topCombo, rules).ok);
  const wouldEndWithTwo = selCombo && forbidLastTwo && selCombo.hasTwo && selCombo.length === (r.myHand?.length ?? 0);
  const canPlay = myTurn && !!selCombo && !!beats && !wouldEndWithTwo && !sending;

  const selInfo = (() => {
    if (!selected.length) return myTurn ? (r.leading ? 'Bạn dẫn vòng — chọn bộ bài bất kỳ.' : `Chọn bộ chặn được ${r.toBeat?.label}.`) : '';
    if (!selCombo) return 'Chưa phải tổ hợp hợp lệ.';
    if (wouldEndWithTwo) return 'Luật bàn này không cho về bằng quân 2.';
    if (topCombo && !beats) return `${capitalize(describeCombo(selCombo))} — không chặn được.`;
    return `${capitalize(describeCombo(selCombo))}${topCombo ? ' — chặn được!' : ''}`;
  })();

  async function send(type: string, payload: unknown = {}) {
    setSending(true);
    const res = await sendAction(view, type, payload);
    setSending(false);
    if (!res.ok) toast(res.error, 'error');
    else if (type === 'play') setSelected([]);
    return res.ok;
  }

  function toggle(code: string) {
    playSfx('click');
    setSelected((s) => (s.includes(code) ? s.filter((x) => x !== code) : [...s, code]));
  }

  function hint() {
    if (!r.myHand) return;
    const combos = enumerateCombos(r.myHand, rules)
      .filter((c) => !topCombo || canBeat(c, topCombo, rules).ok)
      .filter((c) => !(forbidLastTwo && c.hasTwo && c.length === r.myHand!.length))
      .sort((a, b) => (topCombo ? 0 : a.length - b.length) || a.value - b.value || a.length - b.length);
    if (!combos.length) toast('Không có bộ nào chặn được — hãy bỏ lượt.', 'info');
    else setSelected(combos[0].cards);
  }

  // Sắp xếp chỗ ngồi: bạn ở dưới, đối thủ vòng quanh phía trên.
  const myIdx = Math.max(0, r.players.findIndex((p) => p.id === meId));
  const rotated = [...r.players.slice(myIdx), ...r.players.slice(0, myIdx)];
  const opponents = me ? rotated.slice(1) : rotated;
  const seatOf = (id: string) => view.seats.find((s) => s.player.id === id);
  const declarer = r.samDeclarerId ? r.players.find((p) => p.id === r.samDeclarerId) : null;
  const lastCut = top?.cut ? top : null;

  return (
    <div className={`sam-board phase-${r.phase}`}>
      <div className="sam-felt">
        {declarer && !finished && (
          <div className="sam-banner" role="status">
            {declarer.id === meId ? 'Bạn đang báo Sâm — đừng để ai chặn!' : `${declarer.nickname} đang báo Sâm! Chặn được là thắng.`}
          </div>
        )}

        <div className={`sam-opponents n${opponents.length}`}>
          {opponents.map((p, i) => {
            const seat = seatOf(p.id);
            const t = (i + 1) / (opponents.length + 1);
            const angle = Math.PI + Math.PI * t;
            const style = { ['--x' as string]: `${50 + 42 * Math.cos(angle)}%`, ['--y' as string]: `${54 + 46 * Math.sin(angle)}%` };
            const active = r.turnPlayerId === p.id;
            return (
              <div key={p.id} className={`sam-seat ${active ? 'active' : ''} ${p.passed ? 'passed' : ''}`} style={style}>
                <div className="sam-seat-avatar">
                  <Avatar avatar={seat?.player.avatar ?? 'meo-cam'} size={52} />
                  {active && (
                    <span className="seat-timer">
                      <CountdownRing remaining={remaining} total={cfg.turnTimeMs} size={30} />
                    </span>
                  )}
                </div>
                <div className="sam-seat-info">
                  <b>{p.nickname}</b>
                  <span className="sam-count">
                    <span className="mini-backs" aria-hidden>
                      {Array.from({ length: Math.min(p.cardCount, 10) }, (_, k) => (
                        <i key={k} style={{ ['--k' as string]: k }} />
                      ))}
                    </span>
                    {p.cardCount} lá
                  </span>
                  <span className="sam-tags">
                    {p.cardCount === 1 && !finished && <span className="tag tag-warn">Báo 1</span>}
                    {p.passed && <span className="tag">Bỏ lượt</span>}
                    {p.auto && <span className="tag tag-off">Máy đánh</span>}
                    {r.phase === 'DECLARE' && <span className="tag">{p.samDecided ? 'Đã chọn' : 'Đang nghĩ…'}</span>}
                    {seat && seat.balance !== null && <span className="tag tag-money">{formatMoney(seat.balance)}</span>}
                    {seat && !seat.connected && <span className="tag tag-off">Mất kết nối</span>}
                  </span>
                </div>
                {finished && p.cards && (
                  <div className="sam-reveal">
                    {p.cards.map((c) => (
                      <CardFace key={c} code={c} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="sam-center">
          {r.phase === 'DECLARE' ? (
            <div className="sam-declare">
              <p className="sam-declare-title">Báo Sâm?</p>
              <p className="muted small">Báo Sâm nghĩa là bạn cam kết đánh hết bài mà không bị ai chặn.</p>
              <CountdownRing remaining={remaining} total={cfg.samDeclareMs} size={44} />
              {me && r.mySamChoice === null && (
                <div className="row">
                  <button className="btn btn-danger" onClick={() => send('declareSam', { declare: true })} disabled={sending}>
                    Báo Sâm
                  </button>
                  <button className="btn btn-ghost light" onClick={() => send('declareSam', { declare: false })} disabled={sending}>
                    Không báo
                  </button>
                </div>
              )}
              {me && r.mySamChoice === 'no' && <p className="small">Bạn đã chọn không báo. Đang chờ người khác…</p>}
            </div>
          ) : (
            <div className="sam-trick" aria-live="polite">
              {r.trick.length === 0 && !finished && (
                <p className="sam-trick-empty">{r.turnPlayerId ? `${r.players.find((p) => p.id === r.turnPlayerId)?.nickname} dẫn vòng mới` : ''}</p>
              )}
              {r.trick.map((t, i) => {
                const depth = r.trick.length - 1 - i;
                return (
                  <div key={t.seq} className={`sam-play depth-${depth} ${t.cut ? 'cut' : ''}`}>
                    <div className="sam-play-cards">
                      {t.cards.map((c) => (
                        <CardFace key={c} code={c} />
                      ))}
                    </div>
                    {depth === 0 && (
                      <span className="sam-play-label">
                        {r.players.find((p) => p.id === t.playerId)?.nickname}: {t.label}
                      </span>
                    )}
                  </div>
                );
              })}
              {lastCut && (
                <div key={`cut-${lastCut.seq}`} className="cut-flash">
                  CHẶT!
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {me ? (
        <div className={`sam-me ${myTurn ? 'my-turn' : ''}`}>
          <div className="sam-me-bar">
            <div className="sam-me-id">
              <Avatar avatar={seatOf(me.id)?.player.avatar ?? 'meo-cam'} size={40} />
              <div>
                <b>{me.nickname}</b>
                <span className="muted small">
                  {me.cardCount} lá
                  {seatOf(me.id)?.balance != null && <> · {formatMoney(seatOf(me.id)!.balance!)} xu</>}
                </span>
              </div>
              {myTurn && (
                <>
                  <span className="your-turn">Lượt của bạn</span>
                  <CountdownRing remaining={remaining} total={cfg.turnTimeMs} size={34} />
                </>
              )}
              {me.passed && !finished && <span className="tag">Bạn đã bỏ lượt vòng này</span>}
            </div>
            <div className="sam-actions">
              <button className="btn btn-ghost light sm" onClick={() => setSortMode(sortMode === 'rank' ? 'suit' : 'rank')} disabled={finished}>
                Xếp theo {sortMode === 'rank' ? 'chất' : 'số'}
              </button>
              {myTurn && (
                <button className="btn btn-ghost light sm" onClick={hint}>
                  Gợi ý
                </button>
              )}
              {selected.length > 0 && (
                <button className="btn btn-ghost light sm" onClick={() => setSelected([])}>
                  Bỏ chọn
                </button>
              )}
            </div>
          </div>
          <div className="sam-hand" role="listbox" aria-label="Bài trên tay" aria-multiselectable>
            {hand.map((c, i) => (
              <button
                key={c}
                role="option"
                aria-selected={selected.includes(c)}
                className={`hand-card ${selected.includes(c) ? 'selected' : ''}`}
                style={{ ['--i' as string]: i }}
                onClick={() => toggle(c)}
                disabled={finished}
                aria-label={cardLabel(c)}
              >
                <CardFace code={c} />
              </button>
            ))}
            {hand.length === 0 && <p className="muted">Hết bài!</p>}
          </div>
          {!finished && r.phase !== 'DECLARE' && (
            <div className="sam-play-row">
              <span className={`sel-info ${selCombo && beats && !wouldEndWithTwo ? 'good' : selected.length ? 'bad' : ''}`}>{selInfo}</span>
              <div className="row">
                <button className="btn btn-ghost light" onClick={() => send('pass')} disabled={!myTurn || !r.canPass || sending}>
                  Bỏ lượt
                </button>
                <button className="btn btn-primary btn-lg" onClick={() => send('play', { cards: selected })} disabled={!canPlay}>
                  Đánh
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="sam-me spectator">
          <p className="muted">Bạn đang xem bàn. Bài của người chơi được giữ kín.</p>
        </div>
      )}
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
