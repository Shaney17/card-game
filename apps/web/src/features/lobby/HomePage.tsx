import { useState } from 'react';
import { Link } from 'react-router-dom';
import { COMING_SOON, GAMES, TABLE_STATUS_LABEL, type GameMeta, type LobbyGameSummary } from '@chieu-bai/shared';
import { Avatar } from '../../assets/avatars';
import { Logo } from '../../assets/covers';
import { IconUsers } from '../../assets/icons';
import { Cover } from '../../assets/manifest';
import { useLobby, useSession } from '../../net/hooks';
import { Modal } from '../../ui/ui';
import { ProfileEditor } from './ProfileCard';

const STATUS_TONE: Record<string, string> = {
  WAITING: 'tone-wait',
  READY: 'tone-ready',
  PLAYING: 'tone-play',
  ROUND_FINISHED: 'tone-ready',
  PAUSED: 'tone-off',
  CLOSED: 'tone-off',
};

function GameCard({ meta, summary }: { meta: GameMeta; summary?: LobbyGameSummary }) {
  const count = summary?.playerCount ?? 0;
  const max = summary?.maxPlayers ?? meta.maxPlayers;
  const full = count >= max;
  return (
    <article className={`game-card game-${meta.id}`}>
      <Link to={`/game/${meta.id}`} className="game-card-cover" aria-label={`Vào game ${meta.name}`}>
        <Cover assetKey={meta.coverKey} />
      </Link>
      <div className="game-card-body">
        <div className="game-card-title">
          <h2>{meta.name}</h2>
          {summary && <span className={`status-chip ${STATUS_TONE[summary.status]}`}>{TABLE_STATUS_LABEL[summary.status]}</span>}
        </div>
        <p>{meta.tagline}</p>
        <div className="game-card-meta">
          <span className="seats-meter" aria-label={`${count} trên ${max} người`}>
            <IconUsers width={18} height={18} />
            <b>{count}</b>/{max} người
            <span className="seat-dots" aria-hidden>
              {Array.from({ length: max }, (_, i) => (
                <i key={i} className={i < count ? 'on' : ''} />
              ))}
            </span>
          </span>
          <span className="muted small">{meta.minPlayers}–{meta.maxPlayers} người chơi</span>
        </div>
        <Link to={`/game/${meta.id}`} className="btn btn-primary btn-block">
          {full ? 'Vào xem bàn' : 'Vào game'}
        </Link>
      </div>
    </article>
  );
}

export function HomePage() {
  const lobby = useLobby();
  const me = useSession();
  const [editing, setEditing] = useState(false);
  const byId = new Map(lobby?.map((g) => [g.gameId, g]) ?? []);

  return (
    <div className="home">
      <header className="home-header">
        <div className="brand">
          <Logo size={48} />
          <div>
            <h1>Chiếu Bài</h1>
            <p>Trải chiếu, chia bài, rủ bạn vào chơi.</p>
          </div>
        </div>
        <button className="profile-pill" onClick={() => setEditing(true)} disabled={!me} aria-label="Sửa hồ sơ người chơi">
          {me ? <Avatar avatar={me.player.avatar} size={40} /> : <span className="avatar-placeholder" />}
          <span>
            <b>{me?.player.nickname ?? 'Đang tải…'}</b>
            <small>Sửa hồ sơ</small>
          </span>
        </button>
      </header>

      <main className="home-main">
        <section className="hero">
          <h2>Chọn game và vào bàn</h2>
          <p>Mỗi game có đúng một bàn chung. Vào bàn, bấm sẵn sàng, đủ người là chia bài.</p>
        </section>
        <section className="game-grid" aria-label="Danh sách game">
          {Object.values(GAMES).map((g) => (
            <GameCard key={g.id} meta={g} summary={byId.get(g.id)} />
          ))}
          {COMING_SOON.map((g) => (
            <article key={g.id} className="game-card coming-soon" aria-disabled>
              <div className="game-card-cover">
                <Cover assetKey={g.coverKey} />
                <span className="soon-ribbon">Sắp ra mắt</span>
              </div>
              <div className="game-card-body">
                <div className="game-card-title">
                  <h2>{g.name}</h2>
                </div>
                <p>{g.tagline}</p>
                <button className="btn btn-ghost btn-block" disabled>
                  Sắp ra mắt
                </button>
              </div>
            </article>
          ))}
        </section>
        <p className="footnote">Tiền trong game là tiền ảo, không có giá trị quy đổi thành tiền thật.</p>
      </main>

      <Modal open={editing} title="Hồ sơ người chơi" onClose={() => setEditing(false)}>
        <ProfileEditor onDone={() => setEditing(false)} />
      </Modal>
    </div>
  );
}
