import { memo, type ReactNode } from 'react';

/**
 * Bộ bài Tây 52 lá tự vẽ bằng SVG (asset nguyên bản của dự án).
 * Mã lá: "<hạng><chất>", ví dụ "10H", "AS", "2D", "QC".
 */
export type SuitCode = 'S' | 'C' | 'D' | 'H';

export const SUIT_NAME: Record<SuitCode, string> = { S: 'bích', C: 'nhép', D: 'rô', H: 'cơ' };
const RED = '#c8273a';
const BLACK = '#1d2230';
const GOLD = '#c9a14a';

export const suitColor = (s: SuitCode) => (s === 'D' || s === 'H' ? RED : BLACK);

/** Hình chất trong khung 100×100. */
export function SuitShape({ suit, fill }: { suit: SuitCode; fill?: string }) {
  const f = fill ?? suitColor(suit);
  switch (suit) {
    case 'H':
      return <path d="M50 90 C 22 68 2 48 10 27 C 17 9 42 7 50 28 C 58 7 83 9 90 27 C 98 48 78 68 50 90 Z" fill={f} />;
    case 'D':
      return <path d="M50 4 C 62 22 76 38 90 50 C 76 62 62 78 50 96 C 38 78 24 62 10 50 C 24 38 38 22 50 4 Z" fill={f} />;
    case 'S':
      return (
        <path
          d="M50 6 C 38 26 8 42 10 64 C 12 80 34 86 46 72 C 45 83 40 91 30 96 L70 96 C 60 91 55 83 54 72 C 66 86 88 80 90 64 C 92 42 62 26 50 6 Z"
          fill={f}
        />
      );
    case 'C':
      return (
        <g fill={f}>
          <circle cx="50" cy="28" r="19" />
          <circle cx="27" cy="58" r="19" />
          <circle cx="73" cy="58" r="19" />
          <circle cx="50" cy="52" r="10" />
          <path d="M46 56 C 46 75 41 88 32 96 L68 96 C 59 88 54 75 54 56 Z" />
        </g>
      );
  }
}

function Pip({ x, y, size, suit, flip }: { x: number; y: number; size: number; suit: SuitCode; flip?: boolean }) {
  const s = size / 100;
  return (
    <g transform={`translate(${x} ${y}) ${flip ? 'rotate(180)' : ''} scale(${s}) translate(-50 -50)`}>
      <SuitShape suit={suit} />
    </g>
  );
}

const L = 37;
const C = 60;
const R = 83;
/** Vị trí chấm chất cho 2..10 (y > 84 sẽ lật ngược như bài thật). */
const LAYOUT: Record<string, [number, number][]> = {
  '2': [[C, 38], [C, 130]],
  '3': [[C, 38], [C, 84], [C, 130]],
  '4': [[L, 38], [R, 38], [L, 130], [R, 130]],
  '5': [[L, 38], [R, 38], [C, 84], [L, 130], [R, 130]],
  '6': [[L, 38], [R, 38], [L, 84], [R, 84], [L, 130], [R, 130]],
  '7': [[L, 38], [R, 38], [C, 61], [L, 84], [R, 84], [L, 130], [R, 130]],
  '8': [[L, 38], [R, 38], [C, 61], [L, 84], [R, 84], [C, 107], [L, 130], [R, 130]],
  '9': [[L, 38], [R, 38], [L, 69], [R, 69], [C, 84], [L, 99], [R, 99], [L, 130], [R, 130]],
  '10': [[L, 38], [R, 38], [C, 54], [L, 69], [R, 69], [L, 99], [R, 99], [C, 114], [L, 130], [R, 130]],
};

const COURT_COLORS: Record<SuitCode, { robe: string; trim: string; bg: string }> = {
  H: { robe: '#c8273a', trim: '#f2c14e', bg: '#fdecea' },
  D: { robe: '#e0682b', trim: '#3c5aa6', bg: '#fff1e2' },
  S: { robe: '#2d3c7a', trim: '#f2c14e', bg: '#e9edfb' },
  C: { robe: '#1f6b52', trim: '#e45b4f', bg: '#e6f4ee' },
};

/** Nửa trên của hình người (J/Q/K) — được lật đối xứng như bài thật. */
function CourtHalf({ rank, suit }: { rank: 'J' | 'Q' | 'K'; suit: SuitCode }) {
  const c = COURT_COLORS[suit];
  const skin = '#f6d3b3';
  const hair = rank === 'Q' ? '#5a2e1a' : rank === 'J' ? '#2b1b12' : '#e9e4d8';
  return (
    <g>
      {/* thân áo */}
      <path d="M22 84 C 24 64 36 56 60 56 C 84 56 96 64 98 84 Z" fill={c.robe} />
      <path d="M48 56 L60 76 L72 56 Z" fill={c.trim} />
      <path d="M30 70 C 40 66 50 66 56 72" stroke={c.trim} strokeWidth="3" fill="none" />
      <path d="M90 70 C 80 66 70 66 64 72" stroke={c.trim} strokeWidth="3" fill="none" />
      {/* tóc / mũ phía sau */}
      {rank === 'Q' && <path d="M38 40 C 36 18 84 18 82 40 L84 58 L36 58 Z" fill={hair} />}
      {/* khuôn mặt */}
      <ellipse cx="60" cy="40" rx="15" ry="17" fill={skin} />
      <circle cx="54" cy="39" r="1.8" fill="#2a1a12" />
      <circle cx="66" cy="39" r="1.8" fill="#2a1a12" />
      <path d="M55 48 Q60 51 65 48" stroke="#a5503b" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <circle cx="51" cy="45" r="2.6" fill="#f2a08c" opacity=".6" />
      <circle cx="69" cy="45" r="2.6" fill="#f2a08c" opacity=".6" />
      {rank === 'K' && (
        <>
          <path d="M47 47 C 50 60 70 60 73 47 C 70 52 66 53 60 53 C 54 53 50 52 47 47 Z" fill={hair} />
          <path d="M43 26 L46 12 L53 21 L60 9 L67 21 L74 12 L77 26 Z" fill={GOLD} stroke="#8a6a26" strokeWidth="1" />
          <circle cx="60" cy="18" r="2.4" fill={c.robe} />
        </>
      )}
      {rank === 'Q' && (
        <>
          <path d="M46 26 C 50 18 70 18 74 26 L70 22 L65 25 L60 19 L55 25 L50 22 Z" fill={GOLD} stroke="#8a6a26" strokeWidth="1" />
          <circle cx="60" cy="20" r="2" fill={c.trim} />
        </>
      )}
      {rank === 'J' && (
        <>
          <path d="M42 30 C 44 16 76 16 78 30 C 70 26 50 26 42 30 Z" fill={c.robe} />
          <path d="M44 29 C 52 25 68 25 76 29" stroke={c.trim} strokeWidth="2.5" fill="none" />
          <path d="M76 24 C 86 18 92 22 90 30" stroke={c.trim} strokeWidth="2" fill="none" />
        </>
      )}
    </g>
  );
}

function CourtCard({ rank, suit }: { rank: 'J' | 'Q' | 'K'; suit: SuitCode }) {
  const c = COURT_COLORS[suit];
  return (
    <g>
      <rect x="22" y="22" width="76" height="124" rx="6" fill={c.bg} stroke={GOLD} strokeWidth="1.5" />
      <clipPath id={`court-${rank}${suit}`}>
        <rect x="22" y="22" width="76" height="124" rx="6" />
      </clipPath>
      <g clipPath={`url(#court-${rank}${suit})`}>
        <g transform="translate(0 0)">
          <CourtHalf rank={rank} suit={suit} />
        </g>
        <g transform="rotate(180 60 84)">
          <CourtHalf rank={rank} suit={suit} />
        </g>
      </g>
      <line x1="24" y1="84" x2="96" y2="84" stroke={GOLD} strokeWidth="1" />
      <g transform="translate(28 74) scale(.16)">
        <SuitShape suit={suit} />
      </g>
      <g transform="translate(76 78) rotate(180 8 8) scale(.16)">
        <SuitShape suit={suit} />
      </g>
    </g>
  );
}

function Corner({ rank, suit }: { rank: string; suit: SuitCode }) {
  const col = suitColor(suit);
  return (
    <g>
      <text
        x="13"
        y="24"
        textAnchor="middle"
        fontFamily="'Be Vietnam Pro', system-ui, sans-serif"
        fontWeight="800"
        fontSize={rank === '10' ? 17 : 20}
        letterSpacing={rank === '10' ? -1.5 : 0}
        fill={col}
      >
        {rank}
      </text>
      <g transform="translate(6 29) scale(.14)">
        <SuitShape suit={suit} />
      </g>
    </g>
  );
}

export function parseCode(code: string): { rank: string; suit: SuitCode } {
  return { rank: code.slice(0, -1), suit: code.slice(-1) as SuitCode };
}

export const CARD_W = 120;
export const CARD_H = 168;

function FaceInner({ code }: { code: string }) {
  const { rank, suit } = parseCode(code);
  let center: ReactNode;
  if (rank === 'A') {
    center = (
      <>
        <circle cx="60" cy="84" r="34" fill="none" stroke={GOLD} strokeWidth="1.2" strokeDasharray="2 3" />
        <Pip x={60} y={84} size={suit === 'D' ? 44 : 50} suit={suit} />
      </>
    );
  } else if (rank === 'J' || rank === 'Q' || rank === 'K') {
    center = <CourtCard rank={rank} suit={suit} />;
  } else {
    center = (LAYOUT[rank] ?? []).map(([x, y], i) => <Pip key={i} x={x} y={y} size={21} suit={suit} flip={y > 90} />);
  }
  return (
    <>
      <rect x="1" y="1" width="118" height="166" rx="10" fill="#fffdf7" stroke="#d9cfb9" strokeWidth="1.5" />
      {center}
      <Corner rank={rank} suit={suit} />
      <g transform="rotate(180 60 84)">
        <Corner rank={rank} suit={suit} />
      </g>
    </>
  );
}

export const CardFace = memo(function CardFace({ code, title }: { code: string; title?: string }) {
  return (
    <svg viewBox={`0 0 ${CARD_W} ${CARD_H}`} className="card-svg" role="img" aria-label={title ?? cardLabel(code)}>
      <FaceInner code={code} />
    </svg>
  );
});

/** Mặt sau: sơn mài đỏ với hoạ tiết hoa sen vàng. */
export const CardBack = memo(function CardBack({ variant = 'sam' }: { variant?: 'sam' | 'cats' }) {
  const bg = variant === 'sam' ? '#8c1c2a' : '#3a2466';
  const bg2 = variant === 'sam' ? '#a8283a' : '#4d3388';
  return (
    <svg viewBox={`0 0 ${CARD_W} ${CARD_H}`} className="card-svg" role="img" aria-label="Mặt sau lá bài">
      <defs>
        <pattern id={`lattice-${variant}`} width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="16" height="16" fill={bg} />
          <rect width="8" height="8" fill={bg2} />
          <circle cx="12" cy="12" r="1.4" fill={GOLD} opacity=".7" />
        </pattern>
      </defs>
      <rect x="1" y="1" width="118" height="166" rx="10" fill="#fffaf0" stroke="#d9cfb9" strokeWidth="1.5" />
      <rect x="7" y="7" width="106" height="154" rx="7" fill={`url(#lattice-${variant})`} stroke={GOLD} strokeWidth="2" />
      <circle cx="60" cy="84" r="25" fill={bg} stroke={GOLD} strokeWidth="2" />
      {variant === 'sam' ? (
        <g fill={GOLD} transform="translate(60 86)">
          {[0, 1, 2, 3, 4].map((i) => (
            <path key={i} d="M0 0 C -7 -8 -6 -18 0 -22 C 6 -18 7 -8 0 0 Z" transform={`rotate(${(i - 2) * 32})`} />
          ))}
          <path d="M-16 4 C -8 10 8 10 16 4" stroke={GOLD} strokeWidth="2.4" fill="none" />
        </g>
      ) : (
        <g transform="translate(60 84)">
          <path d="M-14 -4 L-17 -18 L-7 -10 Z M14 -4 L17 -18 L7 -10 Z" fill={GOLD} />
          <ellipse cx="0" cy="0" rx="15" ry="12" fill={GOLD} />
          <circle cx="-5" cy="-1" r="2" fill={bg} />
          <circle cx="5" cy="-1" r="2" fill={bg} />
          <path d="M-3 5 Q0 7 3 5" stroke={bg} strokeWidth="1.5" fill="none" />
        </g>
      )}
    </svg>
  );
});

const RANK_NAME: Record<string, string> = { J: 'J (bồi)', Q: 'Q (đầm)', K: 'K (già)', A: 'A (át)' };
export function cardLabel(code: string): string {
  const { rank, suit } = parseCode(code);
  return `${RANK_NAME[rank] ?? rank} ${SUIT_NAME[suit]}`;
}
