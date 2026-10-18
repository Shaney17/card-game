import type { TableView } from '@chieu-bai/shared';
import { Avatar } from '../../assets/avatars';
import { IconCheck, IconWifiOff } from '../../assets/icons';
import { formatMoney } from '../../ui/ui';

export function PlayerList({ view, meId }: { view: TableView; meId: string | null }) {
  return (
    <section className="panel players-panel" aria-label="Người chơi tại bàn">
      <h3>
        Người chơi <span className="muted">({view.seats.length}/{view.maxPlayers})</span>
      </h3>
      {view.seats.length === 0 && <p className="muted small">Chưa có ai ngồi vào bàn.</p>}
      <ul>
        {view.seats.map((s) => (
          <li key={s.player.id} className={`${s.player.id === meId ? 'me' : ''} ${s.connected ? '' : 'offline'}`}>
            <Avatar avatar={s.player.avatar} size={36} />
            <div className="pl-info">
              <b>
                {s.player.nickname}
                {s.player.id === meId && <span className="you-tag">Bạn</span>}
              </b>
              <span className="pl-tags">
                {!s.connected && (
                  <span className="tag tag-off">
                    <IconWifiOff width={12} height={12} /> Mất kết nối
                  </span>
                )}
                {s.waitingNextRound && <span className="tag tag-wait">Chờ ván sau</span>}
                {s.leaving && <span className="tag tag-off">Đã rời</span>}
                {s.ready && view.status !== 'PLAYING' && (
                  <span className="tag tag-ready">
                    <IconCheck width={12} height={12} /> Sẵn sàng
                  </span>
                )}
              </span>
            </div>
            {s.balance !== null && (
              <span className="balance" title="Tiền ảo">
                {formatMoney(s.balance)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
