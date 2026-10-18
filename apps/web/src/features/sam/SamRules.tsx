import { formatMoney } from '../../ui/ui';

interface SamCfg {
  maxPlayers: number;
  perCardPenalty: number;
  congPenalty: number;
  thoiTwoPenalty: number;
  cutTwoPenalty: number;
  cutPairTwoPenalty: number;
  cutQuadPenalty: number;
  enableSam: boolean;
  samReward: number;
  samPenalty: number;
  samFailMode: 'payEachOpponent' | 'payBlockerForAll';
  enableInstantWin: boolean;
  instantWinKinds: string[];
  instantWinAmount: number;
  lowStraights: boolean;
  quadBeatsTwo: boolean;
  quadBeatsPairTwo: boolean;
  lastCardTwo: 'allowed' | 'forbidden';
  lossFormula: 'perCardPlusPenalties' | 'flat';
  flatLossAmount: number;
  turnTimeMs: number;
  startingBalance: number;
}

const INSTANT: Record<string, string> = {
  fourTwos: 'Tứ quý 2',
  dragon: 'Sảnh rồng 10 lá',
  fivePairs: '5 đôi',
  threeTriples: '3 sám cô',
  sameColor: '10 lá đồng màu',
};

export function SamRules({ config }: { config: unknown }) {
  const c = config as SamCfg;
  const m = formatMoney;
  return (
    <div className="rules">
      <p className="rules-lead">
        Sâm lốc dùng bộ bài Tây 52 lá, 2–{c.maxPlayers} người, mỗi người 10 lá. Ai đánh hết bài trước là thắng. Tiền trong game là <b>tiền ảo</b>
        (mỗi người bắt đầu với {m(c.startingBalance)} xu).
      </p>
      <h3>Thứ tự quân bài</h3>
      <p>
        3 &lt; 4 &lt; … &lt; 10 &lt; J &lt; Q &lt; K &lt; A &lt; 2. <b>Chất không có giá trị</b> — hai lá cùng số thì không chặn được nhau.
      </p>
      <h3>Tổ hợp</h3>
      <ul>
        <li><b>Bài lẻ</b>: 1 lá.</li>
        <li><b>Đôi</b>: 2 lá cùng số.</li>
        <li><b>Sám cô</b>: 3 lá cùng số.</li>
        <li><b>Tứ quý</b>: 4 lá cùng số.</li>
        <li>
          <b>Sảnh</b>: từ 3 lá liên tiếp trở lên, ví dụ 5-6-7, 10-J-Q-K-A.{' '}
          {c.lowStraights ? 'Được đánh sảnh thấp A-2-3, 2-3-4…' : 'Không có sảnh thấp A-2-3.'} Không được nối vòng K-A-2.
        </li>
      </ul>
      <h3>Lượt đánh</h3>
      <ul>
        <li>Người dẫn vòng đánh bộ bất kỳ. Người sau phải đánh bộ <b>cùng loại, cùng số lá và lớn hơn</b>, hoặc bỏ lượt.</li>
        <li>Đã bỏ lượt thì không được đánh lại trong vòng đó. Khi mọi người đều bỏ, người đánh cuối được dẫn vòng mới.</li>
        <li>Hết {Math.round(c.turnTimeMs / 1000)} giây mà chưa đánh: hệ thống tự bỏ lượt (hoặc đánh lá nhỏ nhất nếu bạn đang dẫn vòng).</li>
        <li>Khi còn 1 lá, cả bàn sẽ thấy cảnh báo "Báo 1".</li>
        {c.lastCardTwo === 'forbidden' && <li>Không được về (đánh lá cuối cùng) bằng bộ có quân 2.</li>}
      </ul>
      <h3>Chặt</h3>
      <ul>
        {c.quadBeatsTwo && <li>Tứ quý chặt được 2 lẻ — người bị chặt trả {m(c.cutTwoPenalty)}.</li>}
        {c.quadBeatsPairTwo && <li>Tứ quý chặt được đôi 2 — người bị chặt trả {m(c.cutPairTwoPenalty)}.</li>}
        <li>Tứ quý lớn chặt tứ quý nhỏ — người bị chặt trả {m(c.cutQuadPenalty)}.</li>
      </ul>
      {c.enableSam && (
        <>
          <h3>Báo Sâm</h3>
          <p>
            Đầu ván có vài giây để báo Sâm. Người báo Sâm được đánh trước và phải đánh hết bài mà không bị ai chặn. Thành công: mỗi người trả{' '}
            {m(c.samReward)}. Bị chặn: ván kết thúc ngay, người chặn thắng và người báo{' '}
            {c.samFailMode === 'payEachOpponent' ? `đền ${m(c.samPenalty)} cho mỗi người` : `đền cho người chặn ${m(c.samPenalty)} × số người còn lại`}.
          </p>
        </>
      )}
      {c.enableInstantWin && c.instantWinKinds.length > 0 && (
        <>
          <h3>Ăn trắng</h3>
          <p>
            Vừa chia bài đã có {c.instantWinKinds.map((k) => INSTANT[k]).join(', ')} thì thắng ngay, mỗi người trả {m(c.instantWinAmount)}.
          </p>
        </>
      )}
      <h3>Tính tiền khi thua</h3>
      {c.lossFormula === 'flat' ? (
        <p>Mỗi người thua trả người thắng {m(c.flatLossAmount)}.</p>
      ) : (
        <ul>
          <li>Mỗi lá còn lại: {m(c.perCardPenalty)}.</li>
          <li>Cóng (chưa đánh được lá nào): {m(c.congPenalty)} thay cho tiền lá.</li>
          <li>Thối 2: mỗi quân 2 còn trên tay trả thêm {m(c.thoiTwoPenalty)}.</li>
        </ul>
      )}
      <p className="muted small">Các mức tiền & biến thể luật do quản trị viên cấu hình; cấu hình được đóng băng khi ván bắt đầu.</p>
    </div>
  );
}
