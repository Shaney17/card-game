import { CATS_CARDS, CATS_EXPANSIONS } from '@chieu-bai/shared';
import { CatsCardFace } from '../../assets/cats-cards';

interface CatsCfg {
  maxPlayers: number;
  expansions: string[];
  handSize: number;
  extraDefuses: number;
  attackStacking: boolean;
  turnTimeMs: number;
  nopeWindowMs: number;
  disconnectPolicy: 'autoDraw' | 'eliminate';
}

export function CatsRules({ config }: { config: unknown }) {
  const c = config as CatsCfg;
  const enabled = new Set(['base', ...c.expansions]);
  return (
    <div className="rules">
      <p className="rules-lead">
        2–{c.maxPlayers} người. Mỗi người nhận {c.handSize} lá và 1 Gỡ Bom. Chồng bài có số Mèo Nổ bằng số người trừ một. Người cuối cùng còn sống
        chiến thắng.
      </p>
      <h3>Một lượt chơi</h3>
      <ol>
        <li>Đánh bao nhiêu lá hành động tuỳ thích (hoặc không đánh lá nào).</li>
        <li>Mỗi lá hành động có {Math.round(c.nopeWindowMs / 1000)} giây để mọi người phản ứng bằng "Không!". Ai cũng có thể bấm "Cho qua" để xử lý nhanh.</li>
        <li>Kết thúc lượt bằng cách <b>rút 1 lá</b> từ chồng bài (trừ khi bạn dùng Né Lượt, Tấn Công…).</li>
        <li>Rút phải Mèo Nổ: nếu có Gỡ Bom thì tự động dùng và bạn bí mật giấu Mèo Nổ lại chồng bài; nếu không có thì bị loại.</li>
      </ol>
      <ul>
        <li>Hết {Math.round(c.turnTimeMs / 1000)} giây mà chưa rút, hệ thống sẽ rút thay bạn.</li>
        <li>{c.attackStacking ? 'Tấn Công cộng dồn: nếu bạn đang bị tấn công mà đánh Tấn Công, người kế tiếp phải chơi số lượt còn lại của bạn cộng 2.' : 'Tấn Công không cộng dồn: người kế tiếp luôn chơi 2 lượt.'}</li>
        <li>Rời bàn giữa ván sẽ bị loại khỏi ván đó.</li>
        <li>{c.disconnectPolicy === 'eliminate' ? 'Mất kết nối quá lâu sẽ bị loại.' : 'Mất kết nối thì hệ thống tự rút bài khi hết giờ lượt.'}</li>
      </ul>
      {CATS_EXPANSIONS.filter((e) => enabled.has(e.id)).map((e) => (
        <section key={e.id}>
          <h3>{e.name}</h3>
          <div className="rules-cards">
            {CATS_CARDS.filter((d) => d.expansionId === e.id).map((d) => (
              <div key={d.id} className="rules-card">
                <div className="rules-card-img">
                  <CatsCardFace defId={d.id} small />
                </div>
                <div>
                  <b>{d.name}</b>
                  <p>{d.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
      <p className="muted small">Bộ bài, tên gọi và hình minh hoạ là thiết kế nguyên bản của dự án, lấy cảm hứng từ thể loại "mèo nổ".</p>
    </div>
  );
}
