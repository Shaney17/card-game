import { useEffect, useState } from 'react';
import { EV, TABLE_STATUS_LABEL, type GameId, type SessionInfo, type TableView } from '@chieu-bai/shared';
import { call, session } from '../../net/client';
import { IconLock } from '../../assets/icons';
import { toast } from '../../ui/ui';

type Field =
  | { key: string; label: string; kind: 'int'; min: number; max: number; hint?: string }
  | { key: string; label: string; kind: 'seconds'; min: number; max: number; hint?: string }
  | { key: string; label: string; kind: 'bool'; hint?: string }
  | { key: string; label: string; kind: 'select'; options: [string | number, string][]; hint?: string }
  | { key: string; label: string; kind: 'multi'; options: [string, string][]; hint?: string };

interface Group {
  title: string;
  fields: Field[];
}

const SAM_FIELDS: Group[] = [
  {
    title: 'Bàn chơi',
    fields: [
      { key: 'maxPlayers', label: 'Số người tối đa', kind: 'int', min: 2, max: 5 },
      { key: 'turnTimeMs', label: 'Thời gian mỗi lượt (giây)', kind: 'seconds', min: 5, max: 120 },
      { key: 'disconnectTimeoutMs', label: 'Mất kết nối bao lâu thì máy đánh thay (giây)', kind: 'seconds', min: 15, max: 600 },
      { key: 'midRoundJoin', label: 'Vào bàn khi đang có ván', kind: 'select', options: [['waitNextRound', 'Cho vào, chờ ván sau'], ['reject', 'Không cho vào']] },
    ],
  },
  {
    title: 'Tổ hợp & chặt',
    fields: [
      { key: 'lowStraights', label: 'Cho phép sảnh thấp A-2-3, 2-3-4…', kind: 'bool' },
      { key: 'quadBeatsTwo', label: 'Tứ quý chặt 2 lẻ', kind: 'bool' },
      { key: 'quadBeatsPairTwo', label: 'Tứ quý chặt đôi 2', kind: 'bool' },
      { key: 'lastCardTwo', label: 'Đánh 2 cuối cùng', kind: 'select', options: [['forbidden', 'Cấm về bằng 2'], ['allowed', 'Cho phép']] },
    ],
  },
  {
    title: 'Tiền ảo (số nguyên)',
    fields: [
      { key: 'startingBalance', label: 'Số dư khởi đầu', kind: 'int', min: 0, max: 10_000_000 },
      { key: 'lossFormula', label: 'Công thức khi thua', kind: 'select', options: [['perCardPlusPenalties', 'Theo số lá + phạt'], ['flat', 'Mức cố định']] },
      { key: 'perCardPenalty', label: 'Phạt mỗi lá còn lại', kind: 'int', min: 0, max: 100_000 },
      { key: 'congPenalty', label: 'Phạt cóng', kind: 'int', min: 0, max: 1_000_000 },
      { key: 'thoiTwoPenalty', label: 'Phạt thối 2 (mỗi quân)', kind: 'int', min: 0, max: 1_000_000 },
      { key: 'flatLossAmount', label: 'Mức thua cố định', kind: 'int', min: 0, max: 10_000_000 },
      { key: 'cutTwoPenalty', label: 'Phạt bị chặt 2', kind: 'int', min: 0, max: 1_000_000 },
      { key: 'cutPairTwoPenalty', label: 'Phạt bị chặt đôi 2', kind: 'int', min: 0, max: 1_000_000 },
      { key: 'cutQuadPenalty', label: 'Phạt bị chặt tứ quý', kind: 'int', min: 0, max: 1_000_000 },
    ],
  },
  {
    title: 'Báo Sâm & ăn trắng',
    fields: [
      { key: 'enableSam', label: 'Cho phép báo Sâm', kind: 'bool' },
      { key: 'samDeclareMs', label: 'Thời gian báo Sâm (giây)', kind: 'seconds', min: 3, max: 30 },
      { key: 'samReward', label: 'Thưởng báo Sâm (mỗi người trả)', kind: 'int', min: 0, max: 10_000_000 },
      { key: 'samPenalty', label: 'Phạt báo Sâm thất bại', kind: 'int', min: 0, max: 10_000_000 },
      { key: 'samFailMode', label: 'Cách đền Sâm', kind: 'select', options: [['payEachOpponent', 'Trả mỗi người'], ['payBlockerForAll', 'Trả người chặn thay cả bàn']] },
      { key: 'enableInstantWin', label: 'Bật luật ăn trắng', kind: 'bool' },
      {
        key: 'instantWinKinds',
        label: 'Trường hợp ăn trắng',
        kind: 'multi',
        options: [['fourTwos', 'Tứ quý 2'], ['dragon', 'Sảnh rồng'], ['fivePairs', '5 đôi'], ['threeTriples', '3 sám cô'], ['sameColor', 'Đồng màu']],
      },
      { key: 'instantWinAmount', label: 'Tiền ăn trắng (mỗi người trả)', kind: 'int', min: 0, max: 10_000_000 },
    ],
  },
];

const CATS_FIELDS: Group[] = [
  {
    title: 'Bàn chơi',
    fields: [
      { key: 'maxPlayers', label: 'Số người tối đa', kind: 'int', min: 2, max: 8 },
      { key: 'turnTimeMs', label: 'Thời gian mỗi lượt (giây)', kind: 'seconds', min: 10, max: 180 },
      { key: 'nopeWindowMs', label: 'Thời gian phản ứng "Không!" (giây)', kind: 'seconds', min: 2, max: 10 },
      { key: 'choiceTimeMs', label: 'Thời gian lựa chọn (giây)', kind: 'seconds', min: 5, max: 60 },
      { key: 'disconnectPolicy', label: 'Mất kết nối', kind: 'select', options: [['eliminate', 'Loại sau thời gian chờ'], ['autoDraw', 'Tự rút bài khi hết giờ']] },
      { key: 'disconnectTimeoutMs', label: 'Thời gian chờ mất kết nối (giây)', kind: 'seconds', min: 15, max: 600 },
      { key: 'midRoundJoin', label: 'Vào bàn khi đang có ván', kind: 'select', options: [['waitNextRound', 'Cho vào, chờ ván sau'], ['reject', 'Không cho vào']] },
    ],
  },
  {
    title: 'Bộ bài',
    fields: [
      { key: 'expansions', label: 'Bộ mở rộng', kind: 'multi', options: [['hon-loan', 'Hỗn Loạn']] },
      { key: 'deckCopies', label: 'Số bộ bài', kind: 'select', options: [['auto', 'Tự động (2 bộ khi trên 5 người)'], [1, '1 bộ'], [2, '2 bộ']] },
      { key: 'handSize', label: 'Số lá chia mỗi người (chưa tính Gỡ Bom)', kind: 'int', min: 4, max: 8 },
      { key: 'extraDefuses', label: 'Gỡ Bom thêm vào chồng bài', kind: 'int', min: 0, max: 6 },
      { key: 'attackStacking', label: 'Tấn Công cộng dồn', kind: 'bool' },
    ],
  },
];

function ConfigEditor({ gameId, config, locked }: { gameId: GameId; config: Record<string, unknown>; locked: boolean }) {
  const [draft, setDraft] = useState<Record<string, unknown>>(config);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(config), [JSON.stringify(config)]); // eslint-disable-line react-hooks/exhaustive-deps
  const groups = gameId === 'sam' ? SAM_FIELDS : CATS_FIELDS;
  const set = (k: string, v: unknown) => setDraft((d) => ({ ...d, [k]: v }));

  async function save() {
    setSaving(true);
    const r = await call(EV.adminConfig, { gameId, config: draft });
    setSaving(false);
    if (r.ok) toast(locked ? 'Đã lưu — luật mới áp dụng từ ván sau.' : 'Đã lưu luật chơi.', 'success');
    else toast(r.error, 'error');
  }

  return (
    <div className="config-editor">
      {locked && <p className="notice">Ván đang diễn ra dùng cấu hình đã đóng băng. Thay đổi sẽ áp dụng từ ván sau.</p>}
      {groups.map((g) => (
        <fieldset key={g.title}>
          <legend>{g.title}</legend>
          {g.fields.map((f) => {
            const v = draft[f.key];
            const id = `cfg-${f.key}`;
            if (f.kind === 'bool')
              return (
                <label key={f.key} className="field check" htmlFor={id}>
                  <input id={id} type="checkbox" checked={!!v} onChange={(e) => set(f.key, e.target.checked)} />
                  <span>{f.label}</span>
                </label>
              );
            if (f.kind === 'select')
              return (
                <label key={f.key} className="field" htmlFor={id}>
                  <span>{f.label}</span>
                  <select
                    id={id}
                    value={String(v)}
                    onChange={(e) => {
                      const opt = f.options.find(([o]) => String(o) === e.target.value);
                      set(f.key, opt ? opt[0] : e.target.value);
                    }}
                  >
                    {f.options.map(([o, l]) => (
                      <option key={String(o)} value={String(o)}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
              );
            if (f.kind === 'multi') {
              const arr = (v as string[]) ?? [];
              return (
                <div key={f.key} className="field">
                  <span>{f.label}</span>
                  <div className="chips">
                    {f.options.map(([o, l]) => (
                      <label key={o} className={`chip ${arr.includes(o) ? 'on' : ''}`}>
                        <input type="checkbox" checked={arr.includes(o)} onChange={(e) => set(f.key, e.target.checked ? [...arr, o] : arr.filter((x) => x !== o))} />
                        {l}
                      </label>
                    ))}
                  </div>
                </div>
              );
            }
            const isSec = f.kind === 'seconds';
            const shown = isSec ? Math.round(Number(v) / 1000) : Number(v);
            return (
              <label key={f.key} className="field" htmlFor={id}>
                <span>
                  {f.label} <small className="muted">({f.min}–{f.max.toLocaleString('vi-VN')})</small>
                </span>
                <input
                  id={id}
                  type="number"
                  inputMode="numeric"
                  step={1}
                  min={f.min}
                  max={f.max}
                  value={Number.isFinite(shown) ? shown : ''}
                  onChange={(e) => {
                    const n = Math.trunc(Number(e.target.value));
                    set(f.key, isSec ? n * 1000 : n);
                  }}
                />
              </label>
            );
          })}
        </fieldset>
      ))}
      <div className="row">
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Đang lưu…' : 'Lưu cấu hình'}
        </button>
        <button className="btn btn-ghost" onClick={() => setDraft(config)}>
          Hoàn tác
        </button>
      </div>
      <p className="muted small">Máy chủ kiểm tra mọi giá trị; cấu hình sai sẽ bị từ chối kèm lý do.</p>
    </div>
  );
}

export function AdminPanel({ view, isAdmin }: { view: TableView; isAdmin: boolean }) {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);

  if (!isAdmin) {
    return (
      <form
        className="admin-login"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const r = await call<SessionInfo>(EV.adminLogin, { password: pw });
          setBusy(false);
          setPw('');
          if (r.ok && r.data) {
            session.set(r.data);
            toast('Đã đăng nhập quản trị.', 'success');
          } else if (!r.ok) toast(r.error, 'error');
        }}
      >
        <p>
          <IconLock /> Chỉ quản trị viên / chủ sở hữu mới được thay đổi luật chơi.
        </p>
        <label className="field">
          <span>Mật khẩu quản trị</span>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" />
        </label>
        <button className="btn btn-primary" disabled={!pw || busy}>
          Đăng nhập
        </button>
      </form>
    );
  }

  const setStatus = async (status: 'OPEN' | 'PAUSED' | 'CLOSED') => {
    const r = await call(EV.adminStatus, { gameId: view.gameId, status });
    if (!r.ok) toast(r.error, 'error');
  };

  return (
    <div className="admin-panel">
      <div className="row wrap admin-status">
        <span>
          Trạng thái bàn: <b>{TABLE_STATUS_LABEL[view.status]}</b>
        </span>
        <button className="btn btn-ghost sm" onClick={() => setStatus('OPEN')}>
          Mở bàn
        </button>
        <button className="btn btn-ghost sm" onClick={() => setStatus('PAUSED')}>
          Tạm dừng
        </button>
        <button className="btn btn-ghost sm" onClick={() => setStatus('CLOSED')}>
          Ngừng nhận người
        </button>
      </div>
      <ConfigEditor gameId={view.gameId} config={view.config as Record<string, unknown>} locked={view.status === 'PLAYING'} />
      <p className="muted small">Phiên bản luật: {view.rulesVersion}</p>
    </div>
  );
}
