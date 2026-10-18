import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { EV, GAMES, isGameId, TABLE_STATUS_LABEL, type GameMeta, type TableView } from '@chieu-bai/shared';
import { Avatar } from '../../assets/avatars';
import { IconArrowLeft, IconBook, IconDoor, IconGear, IconList, IconSoundOff, IconSoundOn } from '../../assets/icons';
import { muted, playSfx, setMuted } from '../../audio/sfx';
import { call } from '../../net/client';
import { useSession, useTable } from '../../net/hooks';
import { useStore } from '../../net/store';
import { Modal, Spinner, toast } from '../../ui/ui';
import { ProfileEditor } from '../lobby/ProfileCard';
import { AdminPanel } from '../admin/AdminPanel';
import { SamBoard } from '../sam/SamBoard';
import { SamRules } from '../sam/SamRules';
import { CatsBoard } from '../exploding-cats/CatsBoard';
import { CatsRules } from '../exploding-cats/CatsRules';
import { EventLog } from './EventLog';
import { PlayerList } from './PlayerList';
import { ResultModal, resultModalOpen } from './ResultModal';
import { NotFound } from '../lobby/NotFound';

export function GamePage() {
  const { gameId } = useParams();
  if (!isGameId(gameId)) return <NotFound />;
  return <GameTablePage key={gameId} meta={GAMES[gameId]} />;
}

/** Phát âm thanh cho các dòng log mới. */
function useLogSounds(view: TableView | null) {
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (!view) return;
    const entries = view.log;
    const maxId = entries.length ? entries[entries.length - 1].id : 0;
    if (last.current === null) {
      last.current = maxId;
      return;
    }
    const fresh = entries.filter((e) => e.id > last.current! && e.sfx);
    last.current = maxId;
    fresh.slice(-2).forEach((e, i) => setTimeout(() => playSfx(e.sfx), i * 140));
  }, [view?.log]);
}

function GameTablePage({ meta }: { meta: GameMeta }) {
  const { view, error, clockOffset } = useTable(meta.id);
  const me = useSession();
  const isMuted = useStore(muted);
  const navigate = useNavigate();
  const [showRules, setShowRules] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [busy, setBusy] = useState(false);
  useLogSounds(view);

  const mySeat = useMemo(() => view?.seats.find((s) => s.player.id === me?.player.id) ?? null, [view, me]);
  const seated = !!mySeat;
  const status = view?.status;
  const full = view ? view.seats.length >= view.maxPlayers : false;
  const inRound = !!view?.round && status === 'PLAYING';

  async function act(event: string, payload: Record<string, unknown> = {}) {
    setBusy(true);
    const r = await call(event, { gameId: meta.id, ...payload });
    setBusy(false);
    if (!r.ok) toast(r.error, 'error');
    return r.ok;
  }

  async function join() {
    if (me?.player.nickname.startsWith('Khách ')) {
      setShowProfile(true);
      return;
    }
    if (await act(EV.tableJoin)) playSfx('join');
  }

  async function leave() {
    if (inRound && mySeat && !mySeat.waitingNextRound) {
      const msg =
        meta.id === 'sam'
          ? 'Ván đang diễn ra. Nếu rời bàn, máy sẽ đánh thay bạn tới hết ván và bạn vẫn phải trả tiền thua. Rời bàn?'
          : 'Ván đang diễn ra. Nếu rời bàn, bạn sẽ bị loại khỏi ván này. Rời bàn?';
      if (!window.confirm(msg)) return;
    }
    await act(EV.tableLeave);
  }

  if (!view) {
    return (
      <div className="table-page">
        <header className="table-header">
          <Link to="/" className="icon-btn" aria-label="Về trang chủ">
            <IconArrowLeft />
          </Link>
          <h1>{meta.name}</h1>
        </header>
        <div className="center-page">{error ? <p className="error-text">{error}</p> : <Spinner label="Đang vào bàn…" />}</div>
      </div>
    );
  }

  const controls = (
    <div className="seat-controls">
      {!seated && (
        <button className="btn btn-primary" onClick={join} disabled={busy || full || status === 'CLOSED' || status === 'PAUSED'}>
          {full ? 'Bàn đã đủ chỗ' : status === 'PLAYING' ? 'Tham gia ván sau' : 'Tham gia bàn'}
        </button>
      )}
      {seated && !inRound && (
        <button className={`btn ${mySeat!.ready ? 'btn-ghost' : 'btn-primary'}`} onClick={() => act(EV.tableReady, { ready: !mySeat!.ready })} disabled={busy}>
          {mySeat!.ready ? 'Huỷ sẵn sàng' : view.lastResult ? 'Sẵn sàng ván mới' : 'Sẵn sàng'}
        </button>
      )}
      {view.lastResult && !inRound && (
        <button className="btn btn-ghost" onClick={() => resultModalOpen.set(true)}>
          Xem kết quả ván {view.lastResult.roundNumber}
        </button>
      )}
      {seated && (
        <button className="btn btn-ghost" onClick={leave} disabled={busy || mySeat!.leaving}>
          <IconDoor width={18} height={18} /> Rời bàn
        </button>
      )}
    </div>
  );

  const waitingHint = (() => {
    if (status === 'CLOSED') return 'Bàn đang tạm ngừng nhận người chơi.';
    if (status === 'PAUSED') return 'Bàn đang tạm dừng bởi quản trị viên.';
    if (inRound && !seated) return full ? 'Ván đang diễn ra và bàn đã đủ chỗ. Bạn có thể xem trạng thái công khai.' : 'Ván đang diễn ra. Bạn có thể tham gia và chờ ván kế tiếp.';
    if (mySeat?.waitingNextRound) return 'Bạn đã vào bàn và sẽ được chia bài từ ván sau.';
    if (inRound) return null;
    if (!seated) return full ? 'Bàn đã đủ chỗ. Chờ ai đó rời bàn nhé.' : 'Bấm "Tham gia bàn" để ngồi vào chiếu.';
    if (view.startBlocker) return view.startBlocker;
    const notReady = view.seats.filter((s) => !s.ready && !s.leaving).length;
    return notReady ? `Chờ ${notReady} người sẵn sàng — đủ là chia bài.` : 'Đang chia bài…';
  })();

  return (
    <div className={`table-page table-${meta.id}`}>
      <header className="table-header">
        <button className="icon-btn" onClick={() => navigate('/')} aria-label="Về trang chủ">
          <IconArrowLeft />
        </button>
        <div className="table-title">
          <h1>{meta.name}</h1>
          <span className={`status-chip status-${view.status}`}>{TABLE_STATUS_LABEL[view.status]}</span>
          <span className="seat-count" aria-label="Số người tại bàn">
            {view.seats.length}/{view.maxPlayers} người · còn {Math.max(0, view.maxPlayers - view.seats.length)} chỗ
          </span>
        </div>
        <div className="table-tools">
          <button className="icon-btn" onClick={() => setMuted(!isMuted)} aria-label={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'} aria-pressed={!isMuted}>
            {isMuted ? <IconSoundOff /> : <IconSoundOn />}
          </button>
          <button className="icon-btn" onClick={() => setShowRules(true)} aria-label="Xem hướng dẫn luật chơi">
            <IconBook />
          </button>
          <button className="icon-btn" onClick={() => setShowAdmin(true)} aria-label="Cài đặt luật (quản trị)">
            <IconGear />
          </button>
          {inRound && seated && !waitingHint && (
            <button className="icon-btn" onClick={leave} disabled={busy || mySeat!.leaving} aria-label="Rời bàn">
              <IconDoor />
            </button>
          )}
          <button className="icon-btn only-mobile" onClick={() => setShowLog((v) => !v)} aria-label="Nhật ký sự kiện" aria-pressed={showLog}>
            <IconList />
          </button>
        </div>
      </header>

      <div className="table-layout">
        <main className="board-area">
          {view.round ? (
            meta.id === 'sam' ? (
              <SamBoard view={view} clockOffset={clockOffset} />
            ) : (
              <CatsBoard view={view} clockOffset={clockOffset} />
            )
          ) : (
            <div className={`board-empty board-empty-${meta.id}`}>
              <div className="board-empty-inner">
                <p className="board-empty-title">{meta.name}</p>
                <p className="muted">{meta.description}</p>
              </div>
            </div>
          )}
          {(waitingHint || !inRound || !seated) && (
            <div className="table-bar">
              {waitingHint && <p className="table-hint">{waitingHint}</p>}
              {controls}
            </div>
          )}
        </main>

        <aside className={`side-panel ${showLog ? 'open' : ''}`}>
          <PlayerList view={view} meId={me?.player.id ?? null} />
          <EventLog entries={view.log} />
        </aside>
      </div>

      <ResultModal view={view} meId={me?.player.id ?? null} onReady={() => act(EV.tableReady, { ready: true })} />

      <Modal open={showRules} title={`Luật chơi ${meta.name}`} onClose={() => setShowRules(false)} wide>
        {meta.id === 'sam' ? <SamRules config={view.config} /> : <CatsRules config={view.config} />}
      </Modal>
      <Modal open={showAdmin} title="Cài đặt luật" onClose={() => setShowAdmin(false)} wide>
        <AdminPanel view={view} isAdmin={!!me?.isAdmin} />
      </Modal>
      <Modal open={showProfile} title="Đặt biệt danh trước khi vào bàn" onClose={() => setShowProfile(false)}>
        <ProfileEditor
          compact
          onDone={async () => {
            setShowProfile(false);
            if (await act(EV.tableJoin)) playSfx('join');
          }}
        />
      </Modal>
    </div>
  );
}

export function SeatAvatar({ avatar, size = 44 }: { avatar: string; size?: number }) {
  return <Avatar avatar={avatar} size={size} />;
}
