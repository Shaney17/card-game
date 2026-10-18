/** Danh sách avatar mặc định. Hình vẽ nằm trong asset manifest phía client. */
export const AVATARS = [
  { key: 'meo-cam', label: 'Mèo Cam' },
  { key: 'cho-shiba', label: 'Chó Shiba' },
  { key: 'gau-truc', label: 'Gấu Trúc' },
  { key: 'tho-hong', label: 'Thỏ Hồng' },
  { key: 'cao-lua', label: 'Cáo Lửa' },
  { key: 'ech-com', label: 'Ếch Cốm' },
  { key: 'cu-meo', label: 'Cú Mèo' },
  { key: 'heo-dat', label: 'Heo Đất' },
  { key: 'khi-con', label: 'Khỉ Con' },
  { key: 'ga-trong', label: 'Gà Trống' },
  { key: 'vit-bau', label: 'Vịt Bầu' },
  { key: 'rong-xanh', label: 'Rồng Xanh' },
] as const;

export type AvatarKey = (typeof AVATARS)[number]['key'];

export function isAvatarKey(x: unknown): x is AvatarKey {
  return typeof x === 'string' && AVATARS.some((a) => a.key === x);
}
