import { memo, type ReactNode } from 'react';
import { CATS_CARD_BY_ID } from '@chieu-bai/shared';
import { Burst, CatHead, INK_COLOR as INK, Paw, Sparkle } from './cat-parts';

/**
 * Minh hoạ nguyên bản cho từng lá Mèo Nổ (SVG, 120×168).
 * Khoá ảnh: CardDefinition.imageKey = "cats.<id>".
 */
interface Palette {
  bg: string;
  panel: string;
  accent: string;
  text?: string;
}

const PALETTES: Record<string, Palette> = {
  exploding: { bg: '#231a2b', panel: '#ff8a3d', accent: '#ffd45c', text: '#fff4d6' },
  defuse: { bg: '#1f7a55', panel: '#bdf0d4', accent: '#2fbf83' },
  attack: { bg: '#d9482b', panel: '#ffd9b8', accent: '#ff7a3d' },
  skip: { bg: '#2a7bd6', panel: '#cfe6ff', accent: '#5aa5ff' },
  favor: { bg: '#d6497e', panel: '#ffd9e8', accent: '#ff86b2' },
  shuffle: { bg: '#7044c4', panel: '#e6dbff', accent: '#9b74ff' },
  see_future: { bg: '#2d2f8f', panel: '#cfd3ff', accent: '#7a80ff' },
  nope: { bg: '#b8203a', panel: '#ffd0d6', accent: '#ff4d6a' },
  cat_banh_bao: { bg: '#c59b5b', panel: '#fff3dc', accent: '#f2d4a2' },
  cat_tra_sua: { bg: '#8a5a3b', panel: '#f6e1c8', accent: '#d9a679' },
  cat_xoi_gac: { bg: '#c23b22', panel: '#ffe0cf', accent: '#e8553a' },
  cat_pho_bo: { bg: '#b57a2a', panel: '#fff0d2', accent: '#e9b45c' },
  cat_che_ba_mau: { bg: '#2f8f7f', panel: '#dcf5ef', accent: '#59c3ad' },
  reverse: { bg: '#138a8a', panel: '#cff4f2', accent: '#2bc4c0' },
  draw_bottom: { bg: '#6b4a2f', panel: '#f1e1cf', accent: '#a7744a' },
  alter_future: { bg: '#5a2e91', panel: '#eadcff', accent: '#a46bff' },
  targeted_attack: { bg: '#8f1d2c', panel: '#ffd7d2', accent: '#ff5b4a' },
  feral_cat: { bg: '#6b6a2f', panel: '#eef0c8', accent: '#b8b84a' },
  imploding: { bg: '#141020', panel: '#3b2a7a', accent: '#a98bff', text: '#e9e0ff' },
  super_skip: { bg: '#1f4fb8', panel: '#d6e6ff', accent: '#ffd45c' },
  streaking: { bg: '#d2462f', panel: '#ffe1cf', accent: '#ff9a3d' },
  swap_top_bottom: { bg: '#2c8a5e', panel: '#d5f5e4', accent: '#46c78a' },
  catomic: { bg: '#2a2a2a', panel: '#fff1a8', accent: '#f2c40f', text: '#fff1a8' },
  garbage: { bg: '#4f7a2a', panel: '#e5f3cf', accent: '#7fb84a' },
  mark: { bg: '#b8731a', panel: '#ffefd2', accent: '#ff5b4a' },
  bury: { bg: '#5e4027', panel: '#f0dfc8', accent: '#9a6b3e' },
  personal_attack: { bg: '#b3264f', panel: '#ffd6e2', accent: '#ff5b85' },
  potluck: { bg: '#c2401f', panel: '#ffe4cc', accent: '#ff8a3d' },
  share_future: { bg: '#1f7f86', panel: '#d2f3f4', accent: '#4fd0d6' },
  dig_deeper: { bg: '#3b2a1c', panel: '#e8d5bd', accent: '#c48a4a', text: '#ffe9c7' },
  time_bomb: { bg: '#5a1020', panel: '#ffd9c2', accent: '#ff5b4a', text: '#ffe3d6' },
  pass_bomb: { bg: '#c25a12', panel: '#ffe6cc', accent: '#ff9a3d' },
  fast_forward: { bg: '#24346b', panel: '#dbe4ff', accent: '#5a7cff' },
  take_that: { bg: '#6b2a8a', panel: '#f1dcff', accent: '#c06bff' },
  chain_bomb: { bg: '#3a0f0f', panel: '#ffb27a', accent: '#ffd45c', text: '#ffe3d6' },
  smoke_bomb: { bg: '#4a5260', panel: '#e3e7ee', accent: '#9aa5b5' },
};

const ORANGE = '#f59a3c';
const GREY = '#9aa0ad';
const BLACKCAT = '#3a3342';
const WHITE = '#fbf7f0';
const CREAM = '#f3d9a7';

function MiniCard({ x, y, r = 0, fill = '#fff', label }: { x: number; y: number; r?: number; fill?: string; label?: string }) {
  return (
    <g transform={`rotate(${r} ${x} ${y})`}>
      <rect x={x - 9} y={y - 13} width="18" height="26" rx="3" fill={fill} stroke={INK} strokeWidth="1.5" />
      {label && (
        <text x={x} y={y + 5} textAnchor="middle" fontSize="13" fontWeight="800" fill={INK} fontFamily="'Be Vietnam Pro',sans-serif">
          {label}
        </text>
      )}
    </g>
  );
}

function Bomb({ x, y, r, lit = true }: { x: number; y: number; r: number; lit?: boolean }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="#22202a" stroke={INK} strokeWidth="1.6" />
      <circle cx={x - r * 0.35} cy={y - r * 0.35} r={r * 0.22} fill="#fff" opacity=".35" />
      <rect x={x - 4} y={y - r - 5} width="8" height="7" rx="1.5" fill="#55515f" stroke={INK} strokeWidth="1.2" />
      <path d={`M${x} ${y - r - 5} C ${x + 4} ${y - r - 14} ${x + 12} ${y - r - 8} ${x + 14} ${y - r - 16}`} stroke="#c9a46a" strokeWidth="2" fill="none" />
      {lit && (
        <g>
          <Sparkle x={x + 15} y={y - r - 18} r={6} fill="#ffd45c" />
          <Sparkle x={x + 15} y={y - r - 18} r={3} fill="#fff" />
        </g>
      )}
    </g>
  );
}

const SCENES: Record<string, (p: Palette) => ReactNode> = {
  exploding: (p) => (
    <>
      <Burst cx={60} cy={62} r={52} points={14} fill={p.accent} />
      <Burst cx={60} cy={62} r={38} points={12} fill="#fff1b8" />
      <CatHead cx={60} cy={52} r={22} fur={BLACKCAT} inner="#ff9db0" eyes="wide" mouth="open" blush={false} />
      <Bomb x={60} y={98} r={15} />
      <Sparkle x={22} y={26} r={6} fill="#fff" />
      <Sparkle x={98} y={34} r={5} fill="#fff" />
    </>
  ),
  defuse: (p) => (
    <>
      <circle cx={60} cy={64} r={46} fill={p.accent} opacity=".25" />
      <Bomb x={40} y={96} r={14} lit={false} />
      <CatHead cx={66} cy={50} r={21} fur={GREY} stripes="#6f7686" eyes="determined" mouth="flat" />
      {/* kéo cắt dây */}
      <g transform="translate(78 88) rotate(-30)">
        <circle cx="-8" cy="10" r="5" fill="none" stroke="#e8553a" strokeWidth="3" />
        <circle cx="8" cy="10" r="5" fill="none" stroke="#e8553a" strokeWidth="3" />
        <path d="M-5 6 L4 -14 M5 6 L-4 -14" stroke="#c0c6d0" strokeWidth="3" strokeLinecap="round" />
      </g>
      <path d="M40 80 C 44 72 52 76 58 70" stroke="#c9a46a" strokeWidth="2" fill="none" strokeDasharray="3 2" />
      <Paw x={52} y={78} r={6} fur={GREY} />
    </>
  ),
  attack: (p) => (
    <>
      <g opacity=".5">
        <Burst cx={60} cy={64} r={50} points={10} fill={p.accent} />
      </g>
      <CatHead cx={60} cy={50} r={22} fur={ORANGE} stripes="#c96a1d" eyes="angry" mouth="grin" />
      {/* găng đấm bốc */}
      <g>
        <ellipse cx={34} cy={90} rx={15} ry={13} fill="#e23b3b" stroke={INK} strokeWidth="1.8" />
        <rect x={24} y={98} width="16" height="10" rx="3" fill="#fff" stroke={INK} strokeWidth="1.5" />
        <ellipse cx={86} cy={90} rx={15} ry={13} fill="#e23b3b" stroke={INK} strokeWidth="1.8" />
        <rect x={80} y={98} width="16" height="10" rx="3" fill="#fff" stroke={INK} strokeWidth="1.5" />
      </g>
      <g stroke={INK} strokeWidth="2.4" strokeLinecap="round">
        <path d="M14 70 L4 66" />
        <path d="M14 82 L2 82" />
        <path d="M106 70 L116 66" />
        <path d="M106 82 L118 82" />
      </g>
    </>
  ),
  skip: (p) => (
    <>
      <g stroke={p.accent} strokeWidth="5" strokeLinecap="round" opacity=".7">
        <path d="M12 46 L40 46" />
        <path d="M6 62 L36 62" />
        <path d="M14 78 L38 78" />
      </g>
      <CatHead cx={70} cy={56} r={22} fur={WHITE} stripes="#d7cdbd" eyes="sly" mouth="smile" earTilt={-12} />
      <path d="M44 104 L60 104 L60 96 L76 108 L60 120 L60 112 L44 112 Z" fill={p.bg} stroke={INK} strokeWidth="1.6" />
      <path d="M72 104 L84 104 L84 96 L100 108 L84 120 L84 112 L72 112 Z" fill={p.bg} stroke={INK} strokeWidth="1.6" />
    </>
  ),
  favor: (p) => (
    <>
      <path d="M26 30 C 20 22 10 28 16 36 L26 46 L36 36 C 42 28 32 22 26 30 Z" fill={p.accent} />
      <path d="M96 22 C 92 17 85 21 89 26 L96 33 L103 26 C 107 21 100 17 96 22 Z" fill={p.accent} />
      <CatHead cx={60} cy={56} r={24} fur={CREAM} stripes="#d9b77a" eyes="stars" mouth="o" />
      <Paw x={50} y={92} r={8} fur={CREAM} />
      <Paw x={70} y={92} r={8} fur={CREAM} />
      <path d="M60 104 C 56 98 48 102 52 108 L60 116 L68 108 C 72 102 64 98 60 104 Z" fill="#e8336b" stroke={INK} strokeWidth="1.4" />
    </>
  ),
  shuffle: (p) => (
    <>
      <circle cx={60} cy={64} r={44} fill="none" stroke={p.accent} strokeWidth="4" strokeDasharray="10 8" />
      <MiniCard x={22} y={44} r={-25} fill="#ffe28a" />
      <MiniCard x={98} y={46} r={22} fill="#9fe2c4" />
      <MiniCard x={60} y={110} r={-8} fill="#ffb3c7" />
      <CatHead cx={60} cy={62} r={22} fur={GREY} stripes="#6f7686" eyes="spiral" mouth="o" />
      <path d="M88 24 L100 30 L92 38" stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />
    </>
  ),
  see_future: (p) => (
    <>
      {[[18, 22], [100, 28], [24, 104], [96, 96], [60, 14]].map(([x, y], i) => (
        <Sparkle key={i} x={x} y={y} r={i % 2 ? 4 : 6} fill="#fff7c2" />
      ))}
      <CatHead cx={60} cy={44} r={20} fur={BLACKCAT} inner="#b9a6ff" eyes="wide" mouth="cat" blush={false} />
      <circle cx={60} cy={30} r={3} fill="#ffe28a" />
      <circle cx={60} cy={90} r={22} fill={p.accent} stroke={INK} strokeWidth="1.8" />
      <circle cx={60} cy={90} r={16} fill="#c8ccff" opacity=".8" />
      <path d="M50 84 Q 56 78 62 82" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
      <rect x={44} y={108} width={32} height={8} rx="3" fill="#b07a3a" stroke={INK} strokeWidth="1.5" />
      <Paw x={40} y={96} r={6} fur={BLACKCAT} />
      <Paw x={80} y={96} r={6} fur={BLACKCAT} />
    </>
  ),
  nope: () => (
    <>
      <g transform="translate(60 36)">
        <polygon points="-15,-36 15,-36 36,-15 36,15 15,36 -15,36 -36,15 -36,-15" fill="#e8243f" stroke="#fff" strokeWidth="4" />
        <polygon points="-15,-36 15,-36 36,-15 36,15 15,36 -15,36 -36,15 -36,-15" fill="none" stroke={INK} strokeWidth="1.4" />
        <text y="7" textAnchor="middle" fontSize="17" fontWeight="900" fill="#fff" fontFamily="'Be Vietnam Pro',sans-serif" letterSpacing="-.5">
          KHÔNG
        </text>
      </g>
      <CatHead cx={58} cy={96} r={20} fur={WHITE} stripes="#d0c4b0" eyes="angry" mouth="flat" />
      <Paw x={88} y={86} r={9} fur={WHITE} />
    </>
  ),
  cat_banh_bao: () => (
    <>
      <ellipse cx={60} cy={110} rx={40} ry={8} fill="#c9a26a" opacity=".35" />
      <path d="M18 98 C 14 60 40 38 60 38 C 80 38 106 60 102 98 C 90 108 30 108 18 98 Z" fill="#fffaf0" stroke={INK} strokeWidth="1.8" />
      <path d="M48 42 C 52 34 56 32 60 28 C 64 32 68 34 72 42" fill="none" stroke="#d6cbb8" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M44 46 L52 38 M76 46 L68 38" stroke="#d6cbb8" strokeWidth="2" strokeLinecap="round" />
      <path d="M30 56 L24 40 L40 48 Z M90 56 L96 40 L80 48 Z" fill="#fffaf0" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
      <g>
        <path d="M44 74 Q48 70 52 74" stroke={INK} strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <path d="M68 74 Q72 70 76 74" stroke={INK} strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <path d="M57 80 L63 80 L60 83 Z" fill="#e8798b" />
        <path d="M54 86 Q57 89 60 86 Q63 89 66 86" stroke={INK} strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <ellipse cx={40} cy={84} rx={5} ry={3} fill="#ff8fa3" opacity=".5" />
        <ellipse cx={80} cy={84} rx={5} ry={3} fill="#ff8fa3" opacity=".5" />
      </g>
      <path d="M92 22 C 90 16 96 14 96 20 M100 26 C 98 20 104 18 104 24" stroke="#c9b8a0" strokeWidth="2" fill="none" />
    </>
  ),
  cat_tra_sua: () => (
    <>
      <rect x={66} y={10} width="7" height="48" rx="3" fill="#e8336b" stroke={INK} strokeWidth="1.4" transform="rotate(14 70 34)" />
      <CatHead cx={60} cy={46} r={18} fur="#c98b5a" stripes="#9a6136" eyes="happy" mouth="cat" />
      <path d="M30 58 L90 58 L82 122 L38 122 Z" fill="#e7c7a4" stroke={INK} strokeWidth="1.8" opacity=".95" />
      <path d="M30 58 L90 58 L89 66 L31 66 Z" fill="#fff" opacity=".6" />
      {[[44, 112], [54, 116], [64, 112], [74, 114], [50, 104], [68, 104], [59, 106]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="4.4" fill="#3b2418" />
      ))}
      <rect x={26} y={54} width="68" height="7" rx="3" fill="#fff" stroke={INK} strokeWidth="1.5" />
    </>
  ),
  cat_xoi_gac: () => (
    <>
      <ellipse cx={60} cy={108} rx={48} ry={12} fill="#3d8b3d" stroke={INK} strokeWidth="1.6" />
      <path d="M16 106 C 20 60 40 40 60 40 C 80 40 100 60 104 106 Z" fill="#e2452c" stroke={INK} strokeWidth="1.8" />
      {Array.from({ length: 16 }, (_, i) => (
        <ellipse key={i} cx={30 + ((i * 37) % 60)} cy={60 + ((i * 23) % 40)} rx="2.4" ry="1.4" fill="#ff8c6b" transform={`rotate(${i * 40} ${30 + ((i * 37) % 60)} ${60 + ((i * 23) % 40)})`} />
      ))}
      <path d="M36 50 L32 32 L48 42 Z M84 50 L88 32 L72 42 Z" fill="#e2452c" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
      <ellipse cx={50} cy={70} rx="3.6" ry="4.4" fill={INK} />
      <ellipse cx={70} cy={70} rx="3.6" ry="4.4" fill={INK} />
      <circle cx={51.3} cy={68.4} r="1.4" fill="#fff" />
      <circle cx={71.3} cy={68.4} r="1.4" fill="#fff" />
      <path d="M57 77 L63 77 L60 80 Z" fill="#7a1d16" />
      <path d="M54 83 Q57 86 60 83 Q63 86 66 83" stroke={INK} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <ellipse cx={86} cy={44} rx="9" ry="4" fill="#f6e6b8" stroke={INK} strokeWidth="1.2" transform="rotate(-20 86 44)" />
    </>
  ),
  cat_pho_bo: () => (
    <>
      <g stroke="#c9b8a0" strokeWidth="2.4" fill="none" strokeLinecap="round" opacity=".8">
        <path d="M40 30 C 36 22 44 18 40 10" />
        <path d="M60 26 C 56 18 64 14 60 6" />
        <path d="M80 30 C 76 22 84 18 80 10" />
      </g>
      <CatHead cx={60} cy={62} r={20} fur={ORANGE} stripes="#c96a1d" eyes="happy" mouth="open" />
      <path d="M12 76 L108 76 C 106 104 86 120 60 120 C 34 120 14 104 12 76 Z" fill="#fff" stroke={INK} strokeWidth="1.8" />
      <path d="M18 88 L102 88" stroke="#3b6fd1" strokeWidth="3" strokeDasharray="6 4" />
      <path d="M16 76 C 30 70 44 80 60 74 C 76 80 90 70 104 76" stroke="#f7e3a3" strokeWidth="5" fill="none" />
      <ellipse cx={42} cy={76} rx={7} ry={3} fill="#a14f3a" />
      <ellipse cx={78} cy={76} rx={6} ry={3} fill="#7cc36b" />
      <path d="M86 40 L112 100 M92 38 L114 96" stroke="#b07a3a" strokeWidth="3.4" strokeLinecap="round" />
    </>
  ),
  cat_che_ba_mau: () => (
    <>
      <CatHead cx={60} cy={30} r={16} fur={WHITE} stripes="#cfc6b4" eyes="sly" mouth="smile" />
      <path d="M32 44 L88 44 L80 124 L40 124 Z" fill="#eaf8ff" stroke={INK} strokeWidth="1.8" />
      <path d="M38.5 104 L81.5 104 L80 124 L40 124 Z" fill="#6cc46a" />
      <path d="M36.6 84 L83.4 84 L81.5 104 L38.5 104 Z" fill="#f4cf4a" />
      <path d="M34.6 64 L85.4 64 L83.4 84 L36.6 84 Z" fill="#e4504a" />
      <rect x={42} y={48} width="12" height="12" rx="2" fill="#fff" opacity=".8" stroke="#b8d8e8" />
      <rect x={58} y={50} width="12" height="12" rx="2" fill="#fff" opacity=".8" stroke="#b8d8e8" transform="rotate(14 64 56)" />
      <path d="M32 44 L88 44 L80 124 L40 124 Z" fill="none" stroke={INK} strokeWidth="1.8" />
      <path d="M86 20 L74 120" stroke="#c7a37a" strokeWidth="4" strokeLinecap="round" />
    </>
  ),
  reverse: (p) => (
    <>
      <path d="M26 42 C 26 18 94 18 94 42" stroke={p.bg} strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M84 36 L96 48 L104 32" fill="none" stroke={p.bg} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M94 92 C 94 116 26 116 26 92" stroke={p.accent} strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M36 98 L24 86 L16 102" fill="none" stroke={p.accent} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <CatHead cx={60} cy={66} r={21} fur={ORANGE} stripes="#c96a1d" eyes="sly" mouth="grin" earTilt={10} />
    </>
  ),
  draw_bottom: () => (
    <>
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={30} y={20 + i * 6} width="60" height="22" rx="4" fill={i % 2 ? '#f6e6cf' : '#fff'} stroke={INK} strokeWidth="1.4" />
      ))}
      <rect x={44} y={52} width="34" height="22" rx="4" fill="#ffd45c" stroke={INK} strokeWidth="1.6" transform="rotate(8 61 63)" />
      <g transform="rotate(180 60 96)">
        <CatHead cx={60} cy={96} r={20} fur={GREY} stripes="#6f7686" eyes="wide" mouth="o" />
      </g>
      <Paw x={64} y={76} r={7} fur={GREY} />
    </>
  ),
  alter_future: (p) => (
    <>
      <MiniCard x={26} y={30} r={-12} fill="#ffe28a" label="3" />
      <MiniCard x={60} y={22} fill="#9fe2c4" label="1" />
      <MiniCard x={94} y={30} r={12} fill="#ffb3c7" label="2" />
      <path d="M34 48 C 46 56 74 56 86 48" stroke={p.accent} strokeWidth="3" fill="none" strokeDasharray="4 4" />
      <path d="M36 64 L60 44 L84 64 Z" fill={p.bg} stroke={INK} strokeWidth="1.6" />
      <Sparkle x={60} y={52} r={5} fill="#ffe28a" />
      <CatHead cx={60} cy={84} r={21} fur={BLACKCAT} inner="#d7b6ff" eyes="sly" mouth="smile" blush={false} />
      <path d="M90 112 L104 74" stroke="#6b4a2f" strokeWidth="3.4" strokeLinecap="round" />
      <Sparkle x={105} y={70} r={7} fill="#ffe28a" />
    </>
  ),
  targeted_attack: (p) => (
    <>
      <circle cx={60} cy={62} r={48} fill="#fff" stroke={p.accent} strokeWidth="8" />
      <circle cx={60} cy={62} r={32} fill="#fff" stroke={p.accent} strokeWidth="8" />
      <circle cx={60} cy={62} r={14} fill={p.accent} />
      <CatHead cx={60} cy={64} r={18} fur={ORANGE} stripes="#c96a1d" eyes="angry" mouth="grin" />
      <path d="M100 18 L70 52" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <path d="M100 18 L108 14 L104 24 Z" fill="#e23b3b" stroke={INK} strokeWidth="1.2" />
      <path d="M70 52 L74 42 L80 48 Z" fill="#c0c6d0" stroke={INK} strokeWidth="1.2" />
    </>
  ),
  feral_cat: () => (
    <>
      <g fill="#8a7d5a" stroke={INK} strokeWidth="1.4">
        {[-50, -25, 0, 25, 50].map((a, i) => (
          <path key={i} d="M60 60 L54 26 L66 26 Z" transform={`rotate(${a} 60 62)`} />
        ))}
      </g>
      <CatHead cx={60} cy={64} r={24} fur="#a89a72" stripes="#6e6446" eyes="sly" mouth="grin" earTilt={-14} />
      <path d="M42 56 L56 56 L54 64 L44 64 Z" fill={INK} />
      <path d="M36 54 L84 50" stroke={INK} strokeWidth="2" />
      <Sparkle x={92} y={96} r={9} fill="#ffd45c" />
      <text x="60" y="118" textAnchor="middle" fontSize="13" fontWeight="900" fill={INK} fontFamily="'Be Vietnam Pro',sans-serif">
        JOKER
      </text>
    </>
  ),
  imploding: (p) => (
    <>
      {[48, 38, 28, 18].map((r, i) => (
        <circle key={r} cx={60} cy={64} r={r} fill="none" stroke={p.accent} strokeWidth={3 - i * 0.4} strokeDasharray="10 6" opacity={0.4 + i * 0.15} transform={`rotate(${i * 25} 60 64)`} />
      ))}
      <circle cx={60} cy={64} r={14} fill="#05030a" />
      <g transform="rotate(-18 60 60) scale(.8) translate(15 12)">
        <CatHead cx={60} cy={60} r={20} fur="#2b2338" inner="#a98bff" eyes="spiral" mouth="o" blush={false} />
      </g>
      <g transform="translate(92 22)">
        <circle r="10" fill="#fff" stroke={INK} strokeWidth="1.6" />
        <path d="M0 -6 L0 0 M-4.5 -3.5 A6 6 0 1 0 4.5 -3.5" stroke="#e23b3b" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      </g>
    </>
  ),
  super_skip: (p) => (
    <>
      <path d="M30 40 C 20 70 26 104 44 118 L60 92 L76 118 C 94 104 100 70 90 40 Z" fill="#e23b3b" stroke={INK} strokeWidth="1.6" />
      <CatHead cx={60} cy={48} r={21} fur={WHITE} stripes="#d0c4b0" eyes="determined" mouth="smile" />
      <rect x={44} y={42} width="32" height="8" rx="4" fill={p.bg} opacity=".85" />
      <g stroke={p.accent} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M30 98 L44 108 L30 118" />
        <path d="M50 98 L64 108 L50 118" />
        <path d="M70 98 L84 108 L70 118" />
      </g>
    </>
  ),
  streaking: () => (
    <>
      <Bomb x={80} y={92} r={16} lit={false} />
      <CatHead cx={52} cy={56} r={22} fur={ORANGE} stripes="#c96a1d" eyes="happy" mouth="grin" />
      <g>
        <rect x={34} y={48} width="15" height="9" rx="3" fill={INK} />
        <rect x={55} y={48} width="15" height="9" rx="3" fill={INK} />
        <path d="M49 51 L55 51" stroke={INK} strokeWidth="2" />
      </g>
      <Paw x={68} y={86} r={7} fur={ORANGE} />
      <text x="28" y="110" fontSize="22" fontWeight="900" fill="#e8553a" fontFamily="'Be Vietnam Pro',sans-serif">
        ✓
      </text>
    </>
  ),
  swap_top_bottom: (p) => (
    <>
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={40} y={22 + i * 22} width="40" height="18" rx="3" fill={i === 0 ? '#ffd45c' : i === 3 ? '#ffb3c7' : '#fff'} stroke={INK} strokeWidth="1.4" />
      ))}
      <path d="M90 30 C 108 50 108 80 90 100" stroke={p.bg} strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M84 96 L92 104 L98 92" stroke={p.bg} strokeWidth="4.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M30 100 C 12 80 12 50 30 30" stroke={p.accent} strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M36 34 L28 26 L22 38" stroke={p.accent} strokeWidth="4.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <g transform="translate(0 4)">
        <CatHead cx={60} cy={62} r={13} fur={GREY} stripes="#6f7686" eyes="wide" mouth="o" />
      </g>
    </>
  ),
  catomic: (p) => (
    <>
      <circle cx={60} cy={62} r={44} fill={p.accent} opacity=".35" />
      <g transform="translate(60 62)">
        {[0, 120, 240].map((a) => (
          <path key={a} d="M0 0 L-16 -38 A40 40 0 0 1 16 -38 Z" fill={INK} transform={`rotate(${a})`} />
        ))}
        <circle r="10" fill={p.accent} stroke={INK} strokeWidth="3" />
      </g>
      <Bomb x={28} y={108} r={9} />
      <Bomb x={60} y={112} r={9} />
      <Bomb x={92} y={108} r={9} />
      <g transform="translate(60 62) scale(.4) translate(-60 -60)">
        <CatHead cx={60} cy={60} r={20} fur={BLACKCAT} inner="#ffd45c" eyes="angry" mouth="grin" blush={false} />
      </g>
    </>
  ),
  garbage: (p) => (
    <>
      <path d="M30 56 L90 56 L84 122 L36 122 Z" fill="#9aa5ad" stroke={INK} strokeWidth="1.8" />
      <g stroke="#6c7780" strokeWidth="3">
        <path d="M46 64 L48 116" />
        <path d="M60 64 L60 116" />
        <path d="M74 64 L72 116" />
      </g>
      <CatHead cx={60} cy={46} r={18} fur={GREY} stripes="#6f7686" eyes="sly" mouth="cat" />
      <g transform="rotate(-24 34 30)">
        <rect x={22} y={24} width="56" height="8" rx="3" fill="#b8c2c9" stroke={INK} strokeWidth="1.6" />
        <rect x={42} y={18} width="16" height="7" rx="2" fill="#b8c2c9" stroke={INK} strokeWidth="1.4" />
      </g>
      <MiniCard x={96} y={44} r={20} fill={p.accent} />
      <path d="M88 82 C 96 78 104 86 98 92" stroke="#7a8a3a" strokeWidth="2" fill="none" />
    </>
  ),
  mark: (p) => (
    <>
      <MiniCard x={36} y={90} r={-12} fill="#fff" />
      <MiniCard x={58} y={94} r={0} fill="#ffd45c" label="!" />
      <MiniCard x={80} y={90} r={12} fill="#fff" />
      <circle cx={58} cy={94} r={18} fill="none" stroke={p.accent} strokeWidth="3.4" strokeDasharray="6 4" />
      <CatHead cx={52} cy={42} r={18} fur={CREAM} stripes="#d9b77a" eyes="sly" mouth="smile" />
      <g transform="translate(86 46) rotate(30)">
        <circle r="13" fill="#cfefff" fillOpacity=".6" stroke={INK} strokeWidth="3" />
        <rect x="-3" y="12" width="6" height="18" rx="2" fill="#6b4a2f" stroke={INK} strokeWidth="1.2" />
      </g>
    </>
  ),
  bury: () => (
    <>
      <path d="M8 100 C 30 84 90 84 112 100 L112 128 L8 128 Z" fill="#8b5e3c" />
      <path d="M8 100 C 30 84 90 84 112 100" stroke={INK} strokeWidth="1.6" fill="none" />
      <g fill="#6e4528">
        <circle cx={30} cy={110} r="2" />
        <circle cx={70} cy={116} r="2.4" />
        <circle cx={94} cy={106} r="1.8" />
      </g>
      <g transform="rotate(-15 60 98)">
        <rect x={50} y={84} width="22" height="30" rx="3" fill="#fff" stroke={INK} strokeWidth="1.5" />
      </g>
      <CatHead cx={46} cy={50} r={20} fur={ORANGE} stripes="#c96a1d" eyes="sly" mouth="smile" />
      <g transform="rotate(30 90 50)">
        <rect x={87} y={20} width="6" height="46" rx="2" fill="#a7744a" stroke={INK} strokeWidth="1.3" />
        <path d="M82 64 L98 64 L96 82 C 94 88 86 88 84 82 Z" fill="#c0c6d0" stroke={INK} strokeWidth="1.5" />
      </g>
    </>
  ),
  personal_attack: (p) => (
    <>
      <text x="92" y="34" textAnchor="middle" fontSize="20" fontWeight="900" fill={p.bg} fontFamily="'Be Vietnam Pro',sans-serif">
        ×3
      </text>
      <CatHead cx={54} cy={60} r={22} fur={WHITE} stripes="#d0c4b0" eyes="spiral" mouth="open" />
      <g transform="rotate(-140 80 84)">
        <ellipse cx={80} cy={84} rx={14} ry={12} fill="#e23b3b" stroke={INK} strokeWidth="1.8" />
        <rect x={72} y={92} width="16" height="9" rx="3" fill="#fff" stroke={INK} strokeWidth="1.5" />
      </g>
      <Burst cx={34} cy={36} r={12} points={8} fill="#ffd45c" />
    </>
  ),
  potluck: () => (
    <>
      <g stroke="#c9b8a0" strokeWidth="2.4" fill="none" strokeLinecap="round" opacity=".85">
        <path d="M40 24 C 36 16 44 12 40 4" />
        <path d="M80 24 C 76 16 84 12 80 4" />
      </g>
      <MiniCard x={42} y={48} r={-20} fill="#ffe28a" />
      <MiniCard x={60} y={42} r={0} fill="#9fe2c4" />
      <MiniCard x={78} y={48} r={20} fill="#ffb3c7" />
      <path d="M14 64 L106 64 L100 104 C 96 118 24 118 20 104 Z" fill="#c8323c" stroke={INK} strokeWidth="1.8" />
      <rect x={10} y={60} width="100" height="8" rx="4" fill="#e04a52" stroke={INK} strokeWidth="1.6" />
      <path d="M6 72 C 0 72 0 86 10 84 M114 72 C 120 72 120 86 110 84" stroke={INK} strokeWidth="3" fill="none" />
      <path d="M24 82 C 40 88 80 88 96 82" stroke="#f2c14e" strokeWidth="3" fill="none" strokeDasharray="5 4" />
      <g transform="translate(60 98) scale(.5) translate(-60 -60)">
        <CatHead cx={60} cy={60} r={20} fur={ORANGE} stripes="#c96a1d" eyes="happy" mouth="grin" />
      </g>
    </>
  ),
  share_future: (p) => (
    <>
      <circle cx={60} cy={44} r={22} fill={p.accent} stroke={INK} strokeWidth="1.8" />
      <circle cx={60} cy={44} r={15} fill="#e2fbfc" opacity=".8" />
      <path d="M50 38 Q 56 32 62 36" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
      <rect x={46} y={62} width="28" height="7" rx="3" fill="#b07a3a" stroke={INK} strokeWidth="1.4" />
      <CatHead cx={30} cy={96} r={17} fur={BLACKCAT} inner="#9fe8ec" eyes="wide" mouth="cat" blush={false} />
      <CatHead cx={90} cy={96} r={17} fur={CREAM} stripes="#d9b77a" eyes="stars" mouth="o" />
      <Sparkle x={18} y={26} r={6} fill="#fff" />
      <Sparkle x={102} y={22} r={5} fill="#fff" />
    </>
  ),
  dig_deeper: () => (
    <>
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={18 + i * 3} y={58 + i * 15} width={84 - i * 6} height="13" rx="3" fill={['#c48a4a', '#a8723c', '#8b5e3c', '#6e4528'][i]} stroke={INK} strokeWidth="1.2" />
      ))}
      <rect x={52} y={88} width="20" height="14" rx="2" fill="#ffd45c" stroke={INK} strokeWidth="1.4" />
      <CatHead cx={60} cy={36} r={18} fur={GREY} stripes="#6f7686" eyes="determined" mouth="flat" />
      <path d="M44 24 C 46 12 74 12 76 24 Z" fill="#f2c14e" stroke={INK} strokeWidth="1.5" />
      <circle cx={60} cy={18} r="4" fill="#fff6c2" stroke={INK} strokeWidth="1.2" />
      <path d="M60 22 L52 92 L68 92 Z" fill="#fff6c2" opacity=".35" />
    </>
  ),
  time_bomb: (p) => (
    <>
      <Burst cx={60} cy={70} r={50} points={16} fill={p.accent} />
      <circle cx={60} cy={74} r={34} fill="#22202a" stroke={INK} strokeWidth="2" />
      <path d="M34 48 L28 26 L46 40 Z M86 48 L92 26 L74 40 Z" fill="#22202a" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx={60} cy={74} r={24} fill="#fff6e8" stroke={INK} strokeWidth="1.6" />
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a) => (
        <line key={a} x1={60} y1={53} x2={60} y2={57} stroke={INK} strokeWidth="1.6" transform={`rotate(${a} 60 74)`} />
      ))}
      <line x1={60} y1={74} x2={60} y2={58} stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
      <line x1={60} y1={74} x2={72} y2={80} stroke="#e23b3b" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx={60} cy={74} r={2.6} fill={INK} />
      <text x={60} y={118} textAnchor="middle" fontSize="15" fontWeight="900" fill="#fff" stroke={INK} strokeWidth="3" paintOrder="stroke" fontFamily="'Be Vietnam Pro',sans-serif">
        3 · 2 · 1
      </text>
      <rect x={52} y={34} width="16" height="8" rx="2" fill="#55515f" stroke={INK} strokeWidth="1.2" />
      <path d="M60 34 C 64 24 74 28 76 18" stroke="#c9a46a" strokeWidth="2" fill="none" />
      <Sparkle x={78} y={16} r={6} fill="#ffd45c" />
    </>
  ),
  pass_bomb: () => (
    <>
      <path d="M30 80 C 40 30 84 26 96 56" stroke={INK} strokeWidth="2" strokeDasharray="4 5" fill="none" />
      <g transform="translate(70 34)">
        <Bomb x={0} y={0} r={11} />
      </g>
      <CatHead cx={28} cy={92} r={18} fur={ORANGE} stripes="#c96a1d" eyes="happy" mouth="grin" />
      <Paw x={44} y={76} r={6} fur={ORANGE} />
      <CatHead cx={94} cy={92} r={16} fur={WHITE} stripes="#d0c4b0" eyes="wide" mouth="open" />
      <g stroke={INK} strokeWidth="2" strokeLinecap="round">
        <path d="M84 66 L80 60" />
        <path d="M94 64 L94 57" />
        <path d="M104 66 L108 60" />
      </g>
    </>
  ),
  fast_forward: (p) => (
    <>
      <circle cx={60} cy={56} r={30} fill="#fff" stroke={INK} strokeWidth="2" />
      <path d="M60 56 L60 34 M60 56 L76 64" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <path d="M38 30 A 34 34 0 0 1 92 36" stroke={p.accent} strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M86 28 L94 38 L82 40" stroke={p.accent} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <g fill={p.bg} stroke={INK} strokeWidth="1.6" strokeLinejoin="round">
        <path d="M28 96 L48 108 L28 120 Z" />
        <path d="M48 96 L68 108 L48 120 Z" />
        <path d="M68 96 L88 108 L68 120 Z" />
      </g>
      <g transform="translate(60 56) scale(.42) translate(-60 -60)">
        <CatHead cx={60} cy={60} r={20} fur={GREY} stripes="#6f7686" eyes="spiral" mouth="o" />
      </g>
    </>
  ),
  take_that: (p) => (
    <>
      <MiniCard x={78} y={34} r={14} fill="#ffe28a" label="?" />
      <path d="M40 58 C 54 44 66 40 72 44" stroke={p.accent} strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="2 6" />
      <g transform="translate(70 46) rotate(-20)">
        <ellipse cx={0} cy={0} rx={10} ry={8} fill={BLACKCAT} stroke={INK} strokeWidth="1.6" />
        <path d="M-6 -6 L-9 -14 M0 -8 L0 -16 M6 -6 L9 -14" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      </g>
      <CatHead cx={42} cy={86} r={24} fur={BLACKCAT} inner="#e6c4ff" eyes="sly" mouth="grin" blush={false} />
      <Sparkle x={98} y={98} r={7} fill="#fff" />
    </>
  ),
  chain_bomb: (p) => (
    <>
      <Burst cx={34} cy={52} r={30} points={12} fill={p.accent} />
      <Burst cx={86} cy={84} r={30} points={12} fill="#fff1b8" />
      <path d="M44 62 C 56 70 64 70 76 76" stroke={INK} strokeWidth="3" strokeDasharray="5 4" fill="none" />
      <Bomb x={34} y={56} r={14} />
      <Bomb x={86} y={88} r={14} />
      <g transform="translate(34 30) scale(.45) translate(-60 -60)">
        <CatHead cx={60} cy={60} r={20} fur={BLACKCAT} inner="#ff9db0" eyes="wide" mouth="open" blush={false} />
      </g>
      <g transform="translate(86 62) scale(.45) translate(-60 -60)">
        <CatHead cx={60} cy={60} r={20} fur={ORANGE} stripes="#c96a1d" eyes="wide" mouth="o" />
      </g>
      <text x={60} y={124} textAnchor="middle" fontSize="13" fontWeight="900" fill="#fff" stroke={INK} strokeWidth="3" paintOrder="stroke" fontFamily="'Be Vietnam Pro',sans-serif">
        ×2
      </text>
    </>
  ),
  smoke_bomb: (p) => (
    <>
      {[
        [30, 40, 18],
        [56, 30, 22],
        [86, 40, 18],
        [22, 70, 16],
        [96, 72, 16],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={p.accent} opacity={0.55 + i * 0.07} />
      ))}
      <CatHead cx={60} cy={76} r={22} fur={GREY} stripes="#6f7686" eyes="closed" mouth="o" />
      <MiniCard x={26} y={108} r={-30} fill="#fff" />
      <MiniCard x={94} y={110} r={28} fill="#ffe28a" />
      <path d="M50 48 C 46 40 54 36 50 28 M70 48 C 66 40 74 36 70 28" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
    </>
  ),
};

/** Dùng cho kiểm thử: lá nào đã có minh hoạ riêng. */
export const hasCatsArt = (id: string) => id in SCENES && id in PALETTES;

function titleSize(name: string) {
  if (name.length > 15) return 11;
  if (name.length > 11) return 13;
  return 15;
}

export const CatsCardFace = memo(function CatsCardFace({ defId, small = false }: { defId: string; small?: boolean }) {
  const def = CATS_CARD_BY_ID[defId];
  const p = PALETTES[defId] ?? PALETTES.skip;
  const name = def?.name ?? defId;
  const clip = `cats-clip-${defId}`;
  return (
    <svg viewBox="0 0 120 168" className="card-svg" role="img" aria-label={name}>
      <defs>
        <clipPath id={clip}>
          <rect x="8" y="8" width="104" height="120" rx="8" />
        </clipPath>
      </defs>
      <rect x="1" y="1" width="118" height="166" rx="11" fill={p.bg} stroke={INK} strokeWidth="2" />
      <rect x="8" y="8" width="104" height="120" rx="8" fill={p.panel} />
      <g clipPath={`url(#${clip})`}>{SCENES[defId]?.(p)}</g>
      <rect x="8" y="8" width="104" height="120" rx="8" fill="none" stroke={INK} strokeWidth="1.6" />
      <text
        x="60"
        y={small ? 152 : 151}
        textAnchor="middle"
        fontFamily="'Patrick Hand', 'Be Vietnam Pro', cursive"
        fontSize={titleSize(name) + (small ? 1 : 0)}
        textLength={name.length > 14 ? 100 : undefined}
        lengthAdjust="spacingAndGlyphs"
        fontWeight="700"
        fill={p.text ?? '#fff'}
        stroke={INK}
        strokeWidth="3"
        paintOrder="stroke"
      >
        {name}
      </text>
      {def?.category === 'collection' && <circle cx="104" cy="148" r="5" fill={p.accent} stroke={INK} strokeWidth="1.2" />}
      {def && def.expansionId !== 'base' && (
        <g transform="translate(14 148)">
          {def.expansionId === 'hon-loan' && <path d="M0 -6 L6 0 L0 6 L-6 0 Z" fill="#ffd45c" stroke={INK} strokeWidth="1.2" />}
          {def.expansionId === 'tang-toc' && <path d="M-6 4 L0 -6 L6 4 Z" fill="#5aa5ff" stroke={INK} strokeWidth="1.2" />}
          {def.expansionId === 'dao-boi' && <circle r="5.5" fill="#c48a4a" stroke={INK} strokeWidth="1.2" />}
          {def.expansionId === 'hen-gio' && <rect x="-5" y="-5" width="10" height="10" rx="2" fill="#ff5b4a" stroke={INK} strokeWidth="1.2" />}
        </g>
      )}
    </svg>
  );
});
