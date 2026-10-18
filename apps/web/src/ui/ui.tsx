import { useEffect, useRef, type ReactNode } from 'react';
import { createStore, useStore } from '../net/store';
import { useConnection } from '../net/hooks';
import { IconClose, IconWifiOff } from '../assets/icons';

// ------------------------------------------------------------- Toast
export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'error' | 'success';
}
const toasts = createStore<Toast[]>([]);
let toastId = 0;
export function toast(text: string, tone: Toast['tone'] = 'info') {
  const t = { id: ++toastId, text, tone };
  toasts.set([...toasts.get(), t].slice(-4));
  setTimeout(() => toasts.set(toasts.get().filter((x) => x.id !== t.id)), tone === 'error' ? 4200 : 2800);
}
export function Toasts() {
  const list = useStore(toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------- Modal
export function Modal({
  open,
  title,
  onClose,
  children,
  wide,
  dismissable = true,
}: {
  open: boolean;
  title: string;
  onClose?: () => void;
  children: ReactNode;
  wide?: boolean;
  dismissable?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open || !dismissable) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, dismissable]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={() => dismissable && onClose?.()}>
      <div
        ref={ref}
        className={`modal ${wide ? 'modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          {dismissable && onClose && (
            <button className="icon-btn" onClick={onClose} aria-label="Đóng">
              <IconClose />
            </button>
          )}
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------- Kết nối
export function ConnectionBanner() {
  const c = useConnection();
  if (c.state === 'online') return null;
  const text =
    c.state === 'connecting' ? 'Đang kết nối tới máy chủ…' : c.state === 'reconnecting' ? 'Mất kết nối — đang kết nối lại…' : 'Không kết nối được máy chủ. Đang thử lại…';
  return (
    <div className={`conn-banner conn-${c.state}`} role="alert">
      <IconWifiOff width={18} height={18} />
      <span>{text}</span>
      <span className="dots" aria-hidden>
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}

// ------------------------------------------------------------- Đồng hồ
export function CountdownRing({ remaining, total, size = 36, label }: { remaining: number | null; total: number; size?: number; label?: string }) {
  if (remaining === null) return null;
  const r = 15;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, remaining / total));
  const secs = Math.ceil(remaining / 1000);
  return (
    <div className={`countdown ${frac < 0.25 ? 'urgent' : ''}`} style={{ width: size, height: size }} aria-label={label ?? `Còn ${secs} giây`}>
      <svg viewBox="0 0 36 36" width={size} height={size}>
        <circle cx="18" cy="18" r={r} className="countdown-track" />
        <circle cx="18" cy="18" r={r} className="countdown-bar" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} transform="rotate(-90 18 18)" />
      </svg>
      <span>{secs}</span>
    </div>
  );
}

// ------------------------------------------------------------- Hiệu ứng thắng
const CONFETTI_COLORS = ['#f2c14e', '#e8553a', '#2fbf83', '#5aa5ff', '#ff86b2', '#9b74ff'];
export function Confetti({ seed }: { seed: string | number }) {
  const pieces = Array.from({ length: 36 }, (_, i) => i);
  return (
    <div className="confetti" key={seed} aria-hidden>
      {pieces.map((i) => (
        <i
          key={i}
          style={{
            left: `${(i * 37) % 100}%`,
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animationDelay: `${(i % 9) * 0.08}s`,
            animationDuration: `${1.6 + ((i * 13) % 10) / 10}s`,
            transform: `rotate(${i * 29}deg)`,
          }}
        />
      ))}
    </div>
  );
}

export function Spinner({ label = 'Đang tải…' }: { label?: string }) {
  return (
    <div className="spinner-wrap" role="status">
      <span className="spinner" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function formatMoney(n: number) {
  return n.toLocaleString('vi-VN');
}
