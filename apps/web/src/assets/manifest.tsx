import type { ComponentType } from 'react';
import { CatsCover, ComingSoonCover, SamCover } from './covers';

/**
 * Asset manifest: mọi hình ảnh được tham chiếu qua khoá ổn định (spec §9.2),
 * không rải đường dẫn trong code. Tất cả là SVG tự vẽ trong dự án.
 *
 * - "cover.<gameId>"          ảnh bìa game
 * - "cats.<cardId>"            minh hoạ lá Mèo Nổ  -> <CatsCardFace defId>
 * - "card.<code>"              mặt lá bài Tây      -> <CardFace code>
 * - "avatar.<key>"             avatar              -> <Avatar avatar>
 */
export const COVERS: Record<string, ComponentType> = {
  'cover.sam': SamCover,
  'cover.exploding-cats': CatsCover,
  'cover.coming-soon': ComingSoonCover,
};

export function Cover({ assetKey }: { assetKey: string }) {
  const C = COVERS[assetKey] ?? ComingSoonCover;
  return <C />;
}
