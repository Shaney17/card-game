/** Linh kiện vẽ mèo dùng chung cho minh hoạ Mèo Nổ và avatar. */
export type Eyes = 'happy' | 'wide' | 'angry' | 'sly' | 'sad' | 'closed' | 'stars' | 'spiral' | 'determined';
export type Mouth = 'smile' | 'open' | 'grin' | 'flat' | 'o' | 'cat' | 'frown';

const INK = '#2a1e2e';

export function Eye({ x, y, kind, s = 1 }: { x: number; y: number; kind: Eyes; s?: number }) {
  switch (kind) {
    case 'happy':
      return <path d={`M${x - 4 * s} ${y + 1 * s} Q${x} ${y - 4 * s} ${x + 4 * s} ${y + 1 * s}`} stroke={INK} strokeWidth={2.2 * s} fill="none" strokeLinecap="round" />;
    case 'closed':
      return <path d={`M${x - 4 * s} ${y} Q${x} ${y + 3 * s} ${x + 4 * s} ${y}`} stroke={INK} strokeWidth={2 * s} fill="none" strokeLinecap="round" />;
    case 'sad':
      return (
        <g>
          <ellipse cx={x} cy={y} rx={3.4 * s} ry={4 * s} fill={INK} />
          <circle cx={x + 1.2 * s} cy={y - 1.4 * s} r={1.2 * s} fill="#fff" />
          <path d={`M${x - 5 * s} ${y - 6 * s} L${x + 4 * s} ${y - 8 * s}`} stroke={INK} strokeWidth={1.6 * s} strokeLinecap="round" />
        </g>
      );
    case 'angry':
    case 'determined':
      return (
        <g>
          <ellipse cx={x} cy={y + 0.5 * s} rx={3.2 * s} ry={3.6 * s} fill={INK} />
          <circle cx={x + 1 * s} cy={y - 0.6 * s} r={1 * s} fill="#fff" />
          <path
            d={x < 60 ? `M${x - 5 * s} ${y - 6 * s} L${x + 4 * s} ${y - 3 * s}` : `M${x + 5 * s} ${y - 6 * s} L${x - 4 * s} ${y - 3 * s}`}
            stroke={INK}
            strokeWidth={(kind === 'angry' ? 2.4 : 1.8) * s}
            strokeLinecap="round"
          />
        </g>
      );
    case 'sly':
      return (
        <g>
          <path d={`M${x - 4.5 * s} ${y} L${x + 4.5 * s} ${y}`} stroke={INK} strokeWidth={2.2 * s} strokeLinecap="round" />
          <circle cx={x + (x < 60 ? 1.5 : -1.5) * s} cy={y + 1.6 * s} r={1.8 * s} fill={INK} />
        </g>
      );
    case 'stars':
      return (
        <g>
          <ellipse cx={x} cy={y} rx={4.4 * s} ry={5 * s} fill={INK} />
          <circle cx={x + 1.6 * s} cy={y - 1.8 * s} r={1.7 * s} fill="#fff" />
          <circle cx={x - 1.6 * s} cy={y + 2 * s} r={0.9 * s} fill="#fff" />
        </g>
      );
    case 'spiral':
      return (
        <path
          d={`M${x} ${y} m-0.5 0 a1 1 0 1 1 1.5 0.5 a2.4 2.4 0 1 1 -3 -1.5 a3.8 3.8 0 1 1 5 2.6`}
          transform={`scale(1)`}
          stroke={INK}
          strokeWidth={1.4 * s}
          fill="none"
        />
      );
    default:
      return (
        <g>
          <ellipse cx={x} cy={y} rx={3.6 * s} ry={4.4 * s} fill={INK} />
          <circle cx={x + 1.3 * s} cy={y - 1.6 * s} r={1.4 * s} fill="#fff" />
        </g>
      );
  }
}

export function MouthShape({ x, y, kind, s = 1 }: { x: number; y: number; kind: Mouth; s?: number }) {
  const st = { stroke: INK, strokeWidth: 1.8 * s, fill: 'none', strokeLinecap: 'round' as const };
  switch (kind) {
    case 'open':
      return <path d={`M${x - 4 * s} ${y} Q${x} ${y + 8 * s} ${x + 4 * s} ${y} Z`} fill="#8a2b3a" stroke={INK} strokeWidth={1.4 * s} />;
    case 'grin':
      return <path d={`M${x - 6 * s} ${y - 1 * s} Q${x} ${y + 6 * s} ${x + 6 * s} ${y - 1 * s}`} {...st} />;
    case 'flat':
      return <path d={`M${x - 3.5 * s} ${y + 1 * s} L${x + 3.5 * s} ${y + 1 * s}`} {...st} />;
    case 'o':
      return <ellipse cx={x} cy={y + 2 * s} rx={2.4 * s} ry={3 * s} fill="#8a2b3a" stroke={INK} strokeWidth={1.2 * s} />;
    case 'frown':
      return <path d={`M${x - 4 * s} ${y + 3 * s} Q${x} ${y - 1.5 * s} ${x + 4 * s} ${y + 3 * s}`} {...st} />;
    case 'smile':
      return <path d={`M${x - 4 * s} ${y} Q${x} ${y + 4 * s} ${x + 4 * s} ${y}`} {...st} />;
    case 'cat':
    default:
      return <path d={`M${x - 4.5 * s} ${y} Q${x - 2.2 * s} ${y + 3 * s} ${x} ${y} Q${x + 2.2 * s} ${y + 3 * s} ${x + 4.5 * s} ${y}`} {...st} />;
  }
}

export interface CatHeadProps {
  cx: number;
  cy: number;
  r: number;
  fur: string;
  inner?: string;
  stripes?: string;
  eyes?: Eyes;
  mouth?: Mouth;
  blush?: boolean;
  whiskers?: boolean;
  earTilt?: number;
}

/** Đầu mèo hoạt hình, toạ độ theo tâm & bán kính. */
export function CatHead({ cx, cy, r, fur, inner = '#f6a6b2', stripes, eyes = 'wide', mouth = 'cat', blush = true, whiskers = true, earTilt = 0 }: CatHeadProps) {
  const s = r / 22;
  const ear = (dir: -1 | 1) => {
    const bx = cx + dir * 14 * s;
    const by = cy - 12 * s;
    return (
      <g transform={`rotate(${dir * earTilt} ${bx} ${by})`}>
        <path d={`M${bx - 9 * s} ${by + 4 * s} L${bx + dir * 4 * s} ${by - 20 * s} L${bx + 9 * s} ${by + 2 * s} Z`} fill={fur} stroke={INK} strokeWidth={1.8 * s} strokeLinejoin="round" />
        <path d={`M${bx - 4.5 * s} ${by + 1 * s} L${bx + dir * 3 * s} ${by - 12 * s} L${bx + 4.5 * s} ${by} Z`} fill={inner} />
      </g>
    );
  };
  return (
    <g>
      {ear(-1)}
      {ear(1)}
      <ellipse cx={cx} cy={cy} rx={r} ry={r * 0.88} fill={fur} stroke={INK} strokeWidth={1.8 * s} />
      {stripes && (
        <g stroke={stripes} strokeWidth={2.6 * s} strokeLinecap="round" fill="none">
          <path d={`M${cx} ${cy - r * 0.86} L${cx} ${cy - r * 0.55}`} />
          <path d={`M${cx - 6 * s} ${cy - r * 0.8} L${cx - 4 * s} ${cy - r * 0.55}`} />
          <path d={`M${cx + 6 * s} ${cy - r * 0.8} L${cx + 4 * s} ${cy - r * 0.55}`} />
          <path d={`M${cx - r * 0.98} ${cy + 1 * s} L${cx - r * 0.72} ${cy + 2 * s}`} />
          <path d={`M${cx + r * 0.98} ${cy + 1 * s} L${cx + r * 0.72} ${cy + 2 * s}`} />
        </g>
      )}
      <Eye x={cx - 8 * s} y={cy - 2 * s} kind={eyes} s={s} />
      <Eye x={cx + 8 * s} y={cy - 2 * s} kind={eyes} s={s} />
      <path d={`M${cx - 2 * s} ${cy + 4 * s} L${cx + 2 * s} ${cy + 4 * s} L${cx} ${cy + 6.5 * s} Z`} fill="#e8798b" />
      <MouthShape x={cx} y={cy + 7 * s} kind={mouth} s={s} />
      {blush && (
        <g fill="#ff8fa3" opacity=".55">
          <ellipse cx={cx - 13 * s} cy={cy + 5 * s} rx={3.4 * s} ry={2.2 * s} />
          <ellipse cx={cx + 13 * s} cy={cy + 5 * s} rx={3.4 * s} ry={2.2 * s} />
        </g>
      )}
      {whiskers && (
        <g stroke={INK} strokeWidth={1 * s} strokeLinecap="round" opacity=".7">
          <path d={`M${cx - 10 * s} ${cy + 6 * s} L${cx - 22 * s} ${cy + 3 * s}`} />
          <path d={`M${cx - 10 * s} ${cy + 8 * s} L${cx - 22 * s} ${cy + 9 * s}`} />
          <path d={`M${cx + 10 * s} ${cy + 6 * s} L${cx + 22 * s} ${cy + 3 * s}`} />
          <path d={`M${cx + 10 * s} ${cy + 8 * s} L${cx + 22 * s} ${cy + 9 * s}`} />
        </g>
      )}
    </g>
  );
}

export function Paw({ x, y, r, fur }: { x: number; y: number; r: number; fur: string }) {
  return (
    <g>
      <ellipse cx={x} cy={y} rx={r} ry={r * 0.85} fill={fur} stroke={INK} strokeWidth={1.6} />
      <path d={`M${x - r * 0.35} ${y - r * 0.7} L${x - r * 0.35} ${y - r * 0.2} M${x + r * 0.35} ${y - r * 0.7} L${x + r * 0.35} ${y - r * 0.2}`} stroke={INK} strokeWidth={1.2} />
    </g>
  );
}

export function Sparkle({ x, y, r, fill = '#ffe28a' }: { x: number; y: number; r: number; fill?: string }) {
  return <path d={`M${x} ${y - r} Q${x + r * 0.2} ${y - r * 0.2} ${x + r} ${y} Q${x + r * 0.2} ${y + r * 0.2} ${x} ${y + r} Q${x - r * 0.2} ${y + r * 0.2} ${x - r} ${y} Q${x - r * 0.2} ${y - r * 0.2} ${x} ${y - r} Z`} fill={fill} />;
}

export function Burst({ cx, cy, r, points = 12, fill, inner }: { cx: number; cy: number; r: number; points?: number; fill: string; inner?: number }) {
  const pts: string[] = [];
  const ir = inner ?? r * 0.62;
  for (let i = 0; i < points * 2; i++) {
    const a = (Math.PI * i) / points - Math.PI / 2;
    const rr = i % 2 === 0 ? r : ir;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return <polygon points={pts.join(' ')} fill={fill} />;
}

export const INK_COLOR = INK;
