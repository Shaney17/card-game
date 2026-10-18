import { useEffect, useState } from 'react';
import { AVATARS, EV, type SessionInfo } from '@chieu-bai/shared';
import { Avatar } from '../../assets/avatars';
import { call, session } from '../../net/client';
import { useSession } from '../../net/hooks';
import { toast } from '../../ui/ui';

/** Hồ sơ người chơi: biệt danh + avatar (định danh "vào nhanh"). */
export function ProfileEditor({ onDone, compact = false }: { onDone?: () => void; compact?: boolean }) {
  const me = useSession();
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<string>('meo-cam');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (me) {
      setName(me.player.nickname);
      setAvatar(me.player.avatar);
    }
  }, [me?.player.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const trimmed = name.trim();
  const valid = trimmed.length >= 2 && trimmed.length <= 20;

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (!valid) return;
    setSaving(true);
    const r = await call<SessionInfo>(EV.profile, { nickname: trimmed, avatar });
    setSaving(false);
    if (r.ok && r.data) {
      session.set(r.data);
      toast('Đã lưu hồ sơ.', 'success');
      onDone?.();
    } else if (!r.ok) toast(r.error, 'error');
  }

  return (
    <form className={`profile-editor ${compact ? 'compact' : ''}`} onSubmit={save}>
      <label className="field">
        <span>Biệt danh</span>
        <input
          value={name}
          maxLength={20}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nhập biệt danh (2–20 ký tự)"
          autoComplete="nickname"
          aria-invalid={!valid}
        />
      </label>
      <fieldset className="avatar-grid">
        <legend>Chọn avatar</legend>
        {AVATARS.map((a) => (
          <button
            type="button"
            key={a.key}
            className={`avatar-choice ${avatar === a.key ? 'selected' : ''}`}
            onClick={() => setAvatar(a.key)}
            aria-pressed={avatar === a.key}
            title={a.label}
          >
            <Avatar avatar={a.key} size={compact ? 44 : 52} />
          </button>
        ))}
      </fieldset>
      <button className="btn btn-primary" disabled={!valid || saving || !me}>
        {saving ? 'Đang lưu…' : 'Lưu hồ sơ'}
      </button>
    </form>
  );
}
