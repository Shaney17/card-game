import { useEffect, useRef } from 'react';
import type { LogEntry } from '@chieu-bai/shared';

const fmt = (ts: number) => new Date(ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export function EventLog({ entries }: { entries: LogEntry[] }) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries.length, entries[entries.length - 1]?.id]);
  return (
    <section className="panel log-panel" aria-label="Nhật ký sự kiện">
      <h3>Nhật ký</h3>
      <ol ref={ref} aria-live="polite">
        {entries.map((e) => (
          <li key={e.id} className={`log-${e.kind}`}>
            <time>{fmt(e.ts)}</time>
            <span>{e.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
