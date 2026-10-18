import { memo, type ReactNode } from 'react';
import { AVATARS } from '@chieu-bai/shared';
import { CatHead, Eye, MouthShape, INK_COLOR as INK } from './cat-parts';

/** 12 avatar động vật nguyên bản, mỗi con một biểu cảm riêng. viewBox 0 0 100 100. */
const BG: Record<string, string> = {
  'meo-cam': '#ffd6a8',
  'cho-shiba': '#ffe6b0',
  'gau-truc': '#d9f0e3',
  'tho-hong': '#ffd9e6',
  'cao-lua': '#ffe0cc',
  'ech-com': '#e2f5c4',
  'cu-meo': '#e3dcff',
  'heo-dat': '#ffe1e1',
  'khi-con': '#f5e3cf',
  'ga-trong': '#fff3c4',
  'vit-bau': '#d6ecff',
  'rong-xanh': '#d2f4ee',
};

const face = (eyes: Parameters<typeof Eye>[0]['kind'], mouth: Parameters<typeof MouthShape>[0]['kind'], y = 50, gap = 11, s = 1.3) => (
  <>
    <Eye x={50 - gap} y={y} kind={eyes} s={s} />
    <Eye x={50 + gap} y={y} kind={eyes} s={s} />
    <MouthShape x={50} y={y + 14} kind={mouth} s={s} />
  </>
);

const cheeks = (y = 62, c = '#ff8fa3') => (
  <g fill={c} opacity=".5">
    <ellipse cx="30" cy={y} rx="5" ry="3.4" />
    <ellipse cx="70" cy={y} rx="5" ry="3.4" />
  </g>
);

const ART: Record<string, ReactNode> = {
  'meo-cam': <CatHead cx={50} cy={56} r={30} fur="#f59a3c" stripes="#c96a1d" eyes="happy" mouth="cat" />,
  'cho-shiba': (
    <>
      <path d="M22 42 L26 14 L44 30 Z M78 42 L74 14 L56 30 Z" fill="#e8913a" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <ellipse cx="50" cy="56" rx="31" ry="28" fill="#e8913a" stroke={INK} strokeWidth="2" />
      <path d="M26 62 C 30 82 70 82 74 62 C 66 70 34 70 26 62 Z" fill="#fff6e8" />
      <ellipse cx="38" cy="44" rx="4" ry="2" fill="#fff6e8" />
      <ellipse cx="62" cy="44" rx="4" ry="2" fill="#fff6e8" />
      <ellipse cx="50" cy="62" rx="5" ry="3.6" fill={INK} />
      {face('happy', 'smile', 50, 12)}
      <path d="M46 74 Q50 82 54 74" fill="#ff6b7d" stroke={INK} strokeWidth="1.4" />
    </>
  ),
  'gau-truc': (
    <>
      <circle cx="24" cy="28" r="11" fill={INK} />
      <circle cx="76" cy="28" r="11" fill={INK} />
      <ellipse cx="50" cy="55" rx="32" ry="29" fill="#fff" stroke={INK} strokeWidth="2" />
      <ellipse cx="37" cy="50" rx="8" ry="10" fill={INK} transform="rotate(-25 37 50)" />
      <ellipse cx="63" cy="50" rx="8" ry="10" fill={INK} transform="rotate(25 63 50)" />
      <circle cx="38" cy="49" r="2.6" fill="#fff" />
      <circle cx="62" cy="49" r="2.6" fill="#fff" />
      <ellipse cx="50" cy="63" rx="5" ry="3.4" fill={INK} />
      <MouthShape x={50} y={68} kind="cat" s={1.2} />
      {cheeks(66)}
    </>
  ),
  'tho-hong': (
    <>
      <ellipse cx="36" cy="22" rx="8" ry="22" fill="#fff" stroke={INK} strokeWidth="2" transform="rotate(-10 36 22)" />
      <ellipse cx="36" cy="22" rx="3.6" ry="15" fill="#ffb3c7" transform="rotate(-10 36 22)" />
      <ellipse cx="64" cy="22" rx="8" ry="22" fill="#fff" stroke={INK} strokeWidth="2" transform="rotate(14 64 22)" />
      <ellipse cx="64" cy="22" rx="3.6" ry="15" fill="#ffb3c7" transform="rotate(14 64 22)" />
      <ellipse cx="50" cy="60" rx="29" ry="26" fill="#fff" stroke={INK} strokeWidth="2" />
      {face('stars', 'o', 56, 11, 1.2)}
      <path d="M46 63 L54 63 L50 67 Z" fill="#ff8fa3" />
      {cheeks(68)}
    </>
  ),
  'cao-lua': (
    <>
      <path d="M18 40 L22 8 L44 30 Z M82 40 L78 8 L56 30 Z" fill="#ff7a2e" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M14 46 C 14 28 86 28 86 46 C 86 66 64 86 50 88 C 36 86 14 66 14 46 Z" fill="#ff7a2e" stroke={INK} strokeWidth="2" />
      <path d="M22 56 C 32 58 42 66 50 88 C 58 66 68 58 78 56 C 70 72 60 84 50 88 C 40 84 30 72 22 56 Z" fill="#fff6e8" />
      <ellipse cx="50" cy="80" rx="4.4" ry="3.4" fill={INK} />
      {face('sly', 'flat', 50, 13)}
    </>
  ),
  'ech-com': (
    <>
      <circle cx="30" cy="30" r="14" fill="#7cc35b" stroke={INK} strokeWidth="2" />
      <circle cx="70" cy="30" r="14" fill="#7cc35b" stroke={INK} strokeWidth="2" />
      <circle cx="30" cy="30" r="8" fill="#fff" />
      <circle cx="70" cy="30" r="8" fill="#fff" />
      <circle cx="32" cy="31" r="4.4" fill={INK} />
      <circle cx="68" cy="31" r="4.4" fill={INK} />
      <ellipse cx="50" cy="60" rx="36" ry="26" fill="#7cc35b" stroke={INK} strokeWidth="2" />
      <path d="M28 62 Q50 82 72 62" stroke={INK} strokeWidth="2.6" fill="#e9586b" />
      {cheeks(58)}
    </>
  ),
  'cu-meo': (
    <>
      <path d="M20 26 L32 40 L40 26 Z M80 26 L68 40 L60 26 Z" fill="#8a6bd1" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <ellipse cx="50" cy="56" rx="32" ry="30" fill="#8a6bd1" stroke={INK} strokeWidth="2" />
      <path d="M30 70 C 40 86 60 86 70 70 C 60 76 40 76 30 70 Z" fill="#c9b8ff" />
      <circle cx="36" cy="50" r="12" fill="#fff" stroke={INK} strokeWidth="1.6" />
      <circle cx="64" cy="50" r="12" fill="#fff" stroke={INK} strokeWidth="1.6" />
      <circle cx="36" cy="51" r="6" fill={INK} />
      <circle cx="64" cy="51" r="6" fill={INK} />
      <circle cx="38" cy="48" r="2" fill="#fff" />
      <circle cx="66" cy="48" r="2" fill="#fff" />
      <path d="M46 60 L54 60 L50 68 Z" fill="#ffb02e" stroke={INK} strokeWidth="1.4" />
    </>
  ),
  'heo-dat': (
    <>
      <path d="M22 34 L26 14 L40 28 Z M78 34 L74 14 L60 28 Z" fill="#ff9fb0" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <ellipse cx="50" cy="56" rx="32" ry="29" fill="#ffb3c1" stroke={INK} strokeWidth="2" />
      <ellipse cx="50" cy="64" rx="12" ry="9" fill="#ff8fa3" stroke={INK} strokeWidth="1.8" />
      <ellipse cx="46" cy="64" rx="2" ry="3" fill={INK} />
      <ellipse cx="54" cy="64" rx="2" ry="3" fill={INK} />
      <Eye x={37} y={48} kind="happy" s={1.3} />
      <Eye x={63} y={48} kind="happy" s={1.3} />
      <path d="M42 78 Q50 82 58 78" stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />
      <rect x="44" y="20" width="12" height="3" rx="1.5" fill={INK} />
    </>
  ),
  'khi-con': (
    <>
      <circle cx="18" cy="52" r="11" fill="#a86b3c" stroke={INK} strokeWidth="2" />
      <circle cx="82" cy="52" r="11" fill="#a86b3c" stroke={INK} strokeWidth="2" />
      <circle cx="18" cy="52" r="5" fill="#f2c79b" />
      <circle cx="82" cy="52" r="5" fill="#f2c79b" />
      <ellipse cx="50" cy="52" rx="30" ry="32" fill="#a86b3c" stroke={INK} strokeWidth="2" />
      <path d="M26 54 C 26 38 46 36 50 44 C 54 36 74 38 74 54 C 74 74 62 82 50 82 C 38 82 26 74 26 54 Z" fill="#f2c79b" />
      {face('wide', 'grin', 52, 10)}
      <path d="M36 22 C 42 14 50 20 48 26" stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />
    </>
  ),
  'ga-trong': (
    <>
      <path d="M38 22 C 34 8 46 6 46 16 C 46 4 58 4 56 16 C 60 6 70 10 64 24 Z" fill="#e8333f" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <ellipse cx="50" cy="54" rx="28" ry="30" fill="#fff8ea" stroke={INK} strokeWidth="2" />
      <path d="M50 54 L64 60 L50 66 Z" fill="#ffb02e" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" transform="translate(-6 0)" />
      <path d="M46 68 C 44 78 52 80 52 70 Z" fill="#e8333f" stroke={INK} strokeWidth="1.4" />
      <Eye x={38} y={46} kind="determined" s={1.3} />
      <Eye x={60} y={46} kind="determined" s={1.3} />
    </>
  ),
  'vit-bau': (
    <>
      <ellipse cx="50" cy="52" rx="30" ry="30" fill="#ffd84d" stroke={INK} strokeWidth="2" />
      <path d="M48 14 C 52 4 62 8 56 18" stroke={INK} strokeWidth="2" fill="#ffd84d" />
      <ellipse cx="50" cy="66" rx="16" ry="7" fill="#ff9a2e" stroke={INK} strokeWidth="2" />
      <path d="M36 66 L64 66" stroke={INK} strokeWidth="1.4" />
      {face('closed', 'flat', 48, 12)}
      {cheeks(58)}
    </>
  ),
  'rong-xanh': (
    <>
      <path d="M30 30 L22 6 L40 22 Z M70 30 L78 6 L60 22 Z" fill="#f4cf4a" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M14 40 L4 36 L12 50 Z M86 40 L96 36 L88 50 Z" fill="#2fa58f" stroke={INK} strokeWidth="1.6" />
      <ellipse cx="50" cy="52" rx="34" ry="30" fill="#3cc2a8" stroke={INK} strokeWidth="2" />
      <ellipse cx="50" cy="68" rx="20" ry="12" fill="#a6ebdc" stroke={INK} strokeWidth="1.6" />
      <circle cx="43" cy="66" r="2.4" fill={INK} />
      <circle cx="57" cy="66" r="2.4" fill={INK} />
      <Eye x={36} y={46} kind="sly" s={1.4} />
      <Eye x={64} y={46} kind="sly" s={1.4} />
      <path d="M44 74 Q50 78 56 74" stroke={INK} strokeWidth="1.6" fill="none" />
      <path d="M40 26 L46 32 L50 24 L54 32 L60 26" stroke="#2fa58f" strokeWidth="3" fill="none" strokeLinejoin="round" />
    </>
  ),
};

export const hasAvatarArt = (key: string) => key in ART && key in BG;

export const Avatar = memo(function Avatar({ avatar, size = 48, title }: { avatar: string; size?: number; title?: string }) {
  const key = ART[avatar] ? avatar : 'meo-cam';
  const label = title ?? AVATARS.find((a) => a.key === key)?.label ?? 'Avatar';
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="avatar-svg" role="img" aria-label={label}>
      <circle cx="50" cy="50" r="49" fill={BG[key]} />
      <g transform="translate(50 52) scale(.9) translate(-50 -50)">{ART[key]}</g>
    </svg>
  );
});
