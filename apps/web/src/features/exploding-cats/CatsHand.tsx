import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

type AnyPointer = Pick<PointerEvent, 'pointerId' | 'clientX' | 'clientY'>;
import { CATS_CARD_BY_ID, CATS_CARDS, type CatsCardInst } from '@chieu-bai/shared';
import { CatsCardFace } from '../../assets/cats-cards';
import { playSfx } from '../../audio/sfx';

const DEF_INDEX: Record<string, number> = Object.fromEntries(CATS_CARDS.map((d, i) => [d.id, i]));
const CATEGORY_RANK: Record<string, number> = { exploding: 0, defuse: 1, passive: 2, reaction: 3, action: 4, collection: 5 };

/** Xếp tự động: bom đang giữ → Gỡ Bom → Mèo Liều → "Không!" → hành động → mèo sưu tập (gom theo loại, Mèo Hoang cuối). */
export function sortHand(cards: CatsCardInst[]): CatsCardInst[] {
  const rank = (c: CatsCardInst) => {
    const d = CATS_CARD_BY_ID[c.def];
    const feral = c.def === 'feral_cat' ? 1 : 0;
    return (CATEGORY_RANK[d?.category ?? 'action'] ?? 9) * 1000 + feral * 500 + (DEF_INDEX[c.def] ?? 0);
  };
  return [...cards].sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id));
}

const AUTO_KEY = 'chieu-bai.cats.autoSort';
function readAuto() {
  try {
    return localStorage.getItem(AUTO_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Thứ tự bài trên tay chỉ là tuỳ chọn hiển thị phía client (server không quan tâm thứ tự).
 * Lá mới rút được thêm vào cuối, hoặc xếp lại toàn bộ nếu bật "Tự xếp".
 */
export function useHandOrder(hand: CatsCardInst[]) {
  const [autoSort, setAutoSortState] = useState(readAuto);
  const [order, setOrder] = useState<string[]>(() => (autoSort ? sortHand(hand) : hand).map((c) => c.id));
  const key = hand.map((c) => c.id).join(',');

  useEffect(() => {
    setOrder((prev) => {
      if (autoSort) return sortHand(hand).map((c) => c.id);
      const ids = new Set(hand.map((c) => c.id));
      const kept = prev.filter((id) => ids.has(id));
      const added = hand.filter((c) => !kept.includes(c.id)).map((c) => c.id);
      return [...kept, ...added];
    });
  }, [key, autoSort]); // eslint-disable-line react-hooks/exhaustive-deps

  const ordered = order.map((id) => hand.find((c) => c.id === id)).filter((c): c is CatsCardInst => !!c);
  return {
    ordered,
    order,
    setOrder,
    autoSort,
    setAutoSort(v: boolean) {
      setAutoSortState(v);
      try {
        localStorage.setItem(AUTO_KEY, v ? '1' : '0');
      } catch {
        /* bỏ qua */
      }
    },
    sortNow() {
      setOrder(sortHand(hand).map((c) => c.id));
    },
  };
}

interface DragState {
  id: string;
  pointerId: number;
  touch: boolean;
  startX: number;
  startY: number;
  startScroll: number;
  mode: 'pending' | 'drag' | 'scroll';
  timer: number | null;
  slots: number[];
}

const LONG_PRESS_MS = 260;

export function CatsHand({
  cards,
  setOrder,
  selected,
  onToggle,
  markedIds,
}: {
  cards: CatsCardInst[];
  setOrder: (fn: (prev: string[]) => string[]) => void;
  selected: string[];
  onToggle: (id: string) => void;
  markedIds: string[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLButtonElement>());
  const drag = useRef<DragState | null>(null);
  // Bỏ qua cú click sinh ra ngay sau khi thả (nếu có); không dùng cờ vì click có thể không xảy ra.
  const suppressUntil = useRef(0);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragDx, setDragDx] = useState(0);
  const cardsRef = useRef(cards);
  cardsRef.current = cards;

  function startDrag(d: DragState) {
    d.mode = 'drag';
    // Toạ độ tâm của từng vị trí (vị trí không đổi khi đổi chỗ vì các lá cùng kích thước).
    d.slots = cardsRef.current.map((c) => {
      const r = cardRefs.current.get(c.id)?.getBoundingClientRect();
      return r ? r.left + r.width / 2 : 0;
    });
    setDragId(d.id);
    setDragDx(0);
    navigator.vibrate?.(12);
    playSfx('click');
  }

  // Lắng nghe trên window: DOM của các lá được sắp xếp lại khi kéo nên không dựa vào pointer capture.
  useEffect(() => {
    const move = (e: PointerEvent) => onPointerMove(e);
    const up = (e: PointerEvent) => endPointer(e);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  });

  function onPointerDown(e: ReactPointerEvent<HTMLButtonElement>, id: string) {
    if (e.button !== 0) return;
    const touch = e.pointerType !== 'mouse';
    const d: DragState = {
      id,
      pointerId: e.pointerId,
      touch,
      startX: e.clientX,
      startY: e.clientY,
      startScroll: containerRef.current?.scrollLeft ?? 0,
      mode: 'pending',
      timer: null,
      slots: [],
    };
    if (touch) d.timer = window.setTimeout(() => drag.current === d && d.mode === 'pending' && startDrag(d), LONG_PRESS_MS);
    drag.current = d;
  }

  function onPointerMove(e: AnyPointer) {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (d.mode === 'pending') {
      if (!d.touch && Math.abs(dx) > 5) startDrag(d);
      else if (d.touch && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        if (d.timer) clearTimeout(d.timer);
        d.mode = 'scroll';
      }
    }
    if (d.mode === 'scroll' && containerRef.current) {
      containerRef.current.scrollLeft = d.startScroll - dx;
    }
    if (d.mode === 'drag') {
      // Vị trí gần con trỏ nhất.
      let best = 0;
      for (let i = 1; i < d.slots.length; i++) if (Math.abs(d.slots[i] - e.clientX) < Math.abs(d.slots[best] - e.clientX)) best = i;
      const current = cardsRef.current.findIndex((c) => c.id === d.id);
      if (best !== current && current >= 0) {
        setOrder((prev) => {
          const next = prev.filter((x) => x !== d.id);
          next.splice(best, 0, d.id);
          return next;
        });
      }
      setDragDx(e.clientX - d.slots[best]);
    }
  }

  function endPointer(e: AnyPointer) {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    if (d.timer) clearTimeout(d.timer);
    if (d.mode === 'drag' || d.mode === 'scroll') suppressUntil.current = Date.now() + 120;
    drag.current = null;
    setDragId(null);
    setDragDx(0);
  }

  return (
    <div ref={containerRef} className={`cats-hand ${dragId ? 'dragging' : ''}`} role="listbox" aria-label="Bài trên tay" aria-multiselectable>
      {cards.map((c, i) => {
        const isDrag = dragId === c.id;
        return (
          <button
            key={c.id}
            ref={(el) => {
              if (el) cardRefs.current.set(c.id, el);
              else cardRefs.current.delete(c.id);
            }}
            role="option"
            aria-selected={selected.includes(c.id)}
            className={`hand-card cats ${selected.includes(c.id) ? 'selected' : ''} ${isDrag ? 'is-dragging' : ''} ${c.def === 'exploding' ? 'held-bomb' : ''}`}
            style={{ ['--i' as string]: i, ...(isDrag ? { transform: `translateX(${dragDx}px) translateY(-26px) scale(1.06)` } : {}) }}
            onPointerDown={(e) => onPointerDown(e, c.id)}
            onContextMenu={(e) => e.preventDefault()}
            onClick={() => {
              if (Date.now() < suppressUntil.current) return;
              onToggle(c.id);
            }}
            aria-label={`${CATS_CARD_BY_ID[c.def]?.name ?? c.def}${markedIds.includes(c.id) ? ' (đang bị lộ)' : ''}`}
          >
            <CatsCardFace defId={c.def} />
            {markedIds.includes(c.id) && <span className="marked-badge">Lộ</span>}
          </button>
        );
      })}
      {cards.length === 0 && <p className="muted small">Không còn lá nào trên tay.</p>}
    </div>
  );
}
