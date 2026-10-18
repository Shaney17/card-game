import { memo } from 'react';
import { CardFace } from './playing-cards';
import { CatsCardFace } from './cats-cards';
import { Burst, CatHead, Sparkle, INK_COLOR as INK } from './cat-parts';

/** Logo "Chiếu Bài": chiếu cói + quạt bài. */
export const Logo = memo(function Logo({ size = 44 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} role="img" aria-label="Chiếu Bài">
      <defs>
        <pattern id="logo-weave" width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill="#c9a14a" />
          <rect width="3" height="6" fill="#b88c34" />
        </pattern>
      </defs>
      <rect x="4" y="30" width="56" height="28" rx="6" fill="url(#logo-weave)" stroke="#7a5a1e" strokeWidth="1.5" />
      <rect x="4" y="30" width="56" height="4" fill="#c8323c" />
      <rect x="4" y="54" width="56" height="4" fill="#c8323c" />
      <g transform="translate(32 40)">
        <rect x="-11" y="-30" width="20" height="28" rx="3.5" fill="#f4ead5" stroke="#1d2230" strokeWidth="1.4" transform="rotate(-22)" />
        <rect x="-10" y="-31" width="20" height="28" rx="3.5" fill="#fffaf0" stroke="#1d2230" strokeWidth="1.4" />
        <rect x="-9" y="-30" width="20" height="28" rx="3.5" fill="#fffdf7" stroke="#1d2230" strokeWidth="1.4" transform="rotate(22)" />
        <g transform="rotate(22)">
          <path d="M1 -14 c-3-6-11-2-6 4l6 6 6-6c5-6-3-10-6-4z" fill="#c8273a" />
        </g>
      </g>
    </svg>
  );
});

export const SamCover = memo(function SamCover() {
  return (
    <div className="cover cover-sam" aria-hidden>
      <div className="cover-fan">
        {['AS', '2H', 'KD', 'QC', '10H'].map((c, i) => (
          <div key={c} className="cover-card" style={{ ['--i' as string]: i - 2 }}>
            <CardFace code={c} />
          </div>
        ))}
      </div>
    </div>
  );
});

export const CatsCover = memo(function CatsCover() {
  return (
    <div className="cover cover-cats" aria-hidden>
      <svg viewBox="0 0 320 180" className="cover-cats-bg" preserveAspectRatio="xMidYMid slice">
        <rect width="320" height="180" fill="#3a2466" />
        <g opacity=".9">
          <Burst cx={160} cy={96} r={120} points={16} fill="#ff8a3d" />
          <Burst cx={160} cy={96} r={80} points={14} fill="#ffd45c" />
        </g>
        <CatHead cx={160} cy={92} r={40} fur="#3a3342" inner="#ff9db0" eyes="wide" mouth="open" blush={false} />
        <Sparkle x={40} y={40} r={10} fill="#fff" />
        <Sparkle x={282} y={48} r={8} fill="#fff" />
        <Sparkle x={262} y={150} r={6} fill="#ffe28a" />
        <path d="M120 160 C 140 150 180 150 200 160" stroke={INK} strokeWidth="3" fill="none" opacity=".2" />
      </svg>
      <div className="cover-cats-cards">
        <div className="cover-card cats" style={{ ['--i' as string]: -1 }}>
          <CatsCardFace defId="defuse" />
        </div>
        <div className="cover-card cats" style={{ ['--i' as string]: 1 }}>
          <CatsCardFace defId="nope" />
        </div>
      </div>
    </div>
  );
});

export const ComingSoonCover = memo(function ComingSoonCover() {
  return (
    <div className="cover cover-soon" aria-hidden>
      <div className="cover-fan muted">
        {['3S', '4S', '5S'].map((c, i) => (
          <div key={c} className="cover-card" style={{ ['--i' as string]: i - 1 }}>
            <CardFace code={c} />
          </div>
        ))}
      </div>
    </div>
  );
});
