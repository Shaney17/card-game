# Chiếu Bài

Nền tảng game bài multiplayer realtime bằng tiếng Việt. Mỗi game có **đúng một bàn chơi chung** — không có phòng, mã phòng hay danh sách bàn.

| Game | Người chơi | Bàn cố định |
|---|---|---|
| **Sâm** (Sâm lốc 10 lá, tiền ảo) | 2–5 | `sam-main-table` |
| **Mèo Nổ** (bộ bài nguyên bản + 4 bộ mở rộng Hỗn Loạn / Tăng Tốc / Đào Bới / Hẹn Giờ) | 2–8 | `exploding-cats-main-table` |

Tiền trong game là tiền ảo, không có giá trị quy đổi.

## Chạy local

Yêu cầu: Node.js ≥ 22.13 (dùng `node:sqlite` có sẵn), pnpm ≥ 10.

```bash
pnpm install
```

```bash
cp .env.example .env
```

Chế độ phát triển (server :3001 + Vite :5190, tự reload):

```bash
pnpm dev
```

Mở http://localhost:5190. Để thử nhiều người, mở thêm cửa sổ ẩn danh hoặc trình duyệt khác (mỗi trình duyệt là một danh tính), hoặc dùng bot dev:

```bash
pnpm --filter @chieu-bai/server bot sam 2
```

Chạy kiểu production (server phục vụ luôn bản build web tại :3001):

```bash
pnpm build && pnpm start
```

### Biến môi trường

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `PORT` | `3001` | Cổng HTTP + WebSocket |
| `ADMIN_PASSWORD` | _(trống)_ | Mật khẩu quản trị để đổi luật. Trống = khoá chức năng cấu hình |
| `DATA_FILE` | `data/chieu-bai.db` | File SQLite |
| `STATIC_DIR` | `apps/web/dist` | Thư mục web đã build |
| `CORS_ORIGIN` | _(trống)_ | Origin khác được phép kết nối (phân tách bằng dấu phẩy) |

## Kiểm thử

```bash
pnpm test
```

- `apps/server/test/sam` — tổ hợp hợp lệ/không hợp lệ, chặn bài, chặt, báo Sâm, ăn trắng, hết giờ, quyết toán.
- `apps/server/test/cats` — bộ bài theo số người, lượt, Tấn Công cộng dồn, Gỡ Bom, chuỗi "Không!", combo mèo, bộ mở rộng, dữ liệu riêng tư.
- `apps/server/test/integration` — bàn cố định (giới hạn người, trạng thái, vào giữa ván, hành động gửi lặp/lỗi thời, quyết toán một lần, tạm dừng, khôi phục sau khi khởi động lại) và **nhiều client Socket.IO thật** (đồng bộ, không lộ bài, quyền quản trị, kết nối lại, giới hạn tần suất).
- `apps/web/src/assets` — mọi lá bài/avatar/game đều có asset trong manifest.

```bash
pnpm typecheck
```

### End-to-end (Playwright)

Chạy trên trình duyệt thật với server thật phục vụ bản build web tại :3001. Lần đầu cần tải Chromium:

```bash
pnpm exec playwright install chromium
```

```bash
pnpm build && pnpm test:e2e
```

- `playwright.config.ts` tự khởi động server (`webServer`) với `ADMIN_PASSWORD=e2e-admin` và `DATA_FILE` là file SQLite tạm trong thư mục tmp của hệ điều hành — không đụng tới `data/`. Cổng 3001 phải trống; nếu đang chạy `pnpm dev`, đặt cổng khác bằng `E2E_PORT`, ví dụ `E2E_PORT=3102 pnpm test:e2e`.
- Mỗi browser context là một danh tính riêng (token nằm trong localStorage). Chỗ ngồi được lấp thêm bằng client Socket.IO trần (`tests/e2e/helpers.ts`).
- `tests/e2e/home.spec.ts` — trang chủ có Sâm, Mèo Nổ và mục "Sắp ra mắt".
- `tests/e2e/sam.spec.ts` — bàn đủ 5 người từ chối người thứ 6; đặt biệt danh, vào bàn, sẵn sàng, mỗi người thấy đúng 10 lá của mình và không có bài đối thủ trong DOM; đánh một lá và người kia thấy trên bàn; tải lại trang giữa ván vẫn giữ chỗ và bài. Trước khi chia bài, test dùng kênh quản trị tắt "ăn trắng" để ván không tình cờ kết thúc ngay khi chia.
- `tests/e2e/exploding-cats.spec.ts` — hai người vào bàn Mèo Nổ, rút bài (giấu bom nếu rút trúng Mèo Nổ) và lượt chuyển sang người kia.

Vì mỗi game chỉ có một bàn dùng chung, test chạy tuần tự với một worker. Khi lỗi, trace và ảnh chụp nằm trong `test-results/`; xem bằng `pnpm exec playwright show-trace <đường dẫn trace.zip>`.

## Kiến trúc

```
apps/server   Node + Socket.IO + Express (REST /api/games), SQLite
  src/game-registry   Giao diện GameEngine dùng chung + registry
  src/game-tables     GameTable: một bàn cố định/game, vòng đời, idempotency, timer, snapshot
  src/games/sam       engine, scoring (SamScoringEngine), config, instant-win
  src/games/exploding-cats  engine, deck, core lượt chơi, effects/ (registry handler)
  src/realtime        Gateway: chỉ chuyển ý định & phát trạng thái đã lọc cho từng người
  src/persistence     SQLite: players, game_tables, game_sessions, game_events, ledger, balances, table_snapshots
apps/web      React + Vite. features/{lobby,table,sam,exploding-cats,admin}, assets/ (SVG tự vẽ), audio/ (WebAudio)
packages/shared  Kiểu dữ liệu, giao thức, metadata game, dữ liệu bài Mèo Nổ, luật tổ hợp Sâm (dùng chung để gợi ý ở client)
```

Chi tiết: [docs/architecture.md](docs/architecture.md). Luật: [docs/game-rules/sam.md](docs/game-rules/sam.md), [docs/game-rules/meo-no.md](docs/game-rules/meo-no.md). Các quyết định chưa chốt: [docs/open-questions.md](docs/open-questions.md).

Nguyên tắc chính:

1. Server là nguồn trạng thái duy nhất; client gửi `ActionEnvelope` (actionId, gameId, tableId, roundId, stateVersion, type, payload).
2. Engine thuần (không phụ thuộc React/Socket.IO/DB), mỗi lần áp dụng trả state mới — lỗi luật thì không đổi gì.
3. `projectView(state, viewerId)` lọc dữ liệu riêng: không bao giờ gửi bài đối thủ hay chồng bài rút.
4. Hành động gửi lặp trả lại đúng kết quả cũ; `stateVersion` cũ bị từ chối.
5. Quyết toán trong transaction, khoá duy nhất `(session_id, settlement_key)` + cờ `settled` — mỗi ván chỉ quyết toán một lần. Tiền là số nguyên.
6. Cấu hình được kiểm tra bằng schema ở server và đóng băng khi ván bắt đầu; phiên bản luật lưu theo từng ván.
7. Xáo bài bằng Fisher–Yates + `crypto.randomInt`.

### Thêm game mới

1. Thêm metadata vào `packages/shared/src/games.ts` (id, `tableId` cố định, số người).
2. Viết engine cài đặt `GameEngine` trong `apps/server/src/games/<id>/` và đăng ký ở `game-registry/registry.ts`.
3. Thêm bàn chơi riêng ở `apps/web/src/features/<id>/` và ảnh bìa vào `assets/manifest.tsx`.

`TableManager`/`GameTable`/gateway không cần sửa.

## Asset

Toàn bộ hình ảnh là SVG tự vẽ trong `apps/web/src/assets` (52 lá bài Tây + mặt sau, 17 minh hoạ Mèo Nổ, 12 avatar, ảnh bìa, logo, icon); âm thanh tổng hợp bằng WebAudio (`apps/web/src/audio/sfx.ts`). Không dùng asset bên ngoài, không vướng bản quyền. Font: Be Vietnam Pro & Patrick Hand (Google Fonts, SIL OFL).

## Triển khai

Một tiến trình Node phục vụ cả web tĩnh và WebSocket:

```bash
pnpm install --frozen-lockfile && pnpm build
```

```bash
PORT=3001 ADMIN_PASSWORD=... DATA_FILE=/var/lib/chieu-bai/db.sqlite pnpm start
```

Đặt sau reverse proxy có hỗ trợ WebSocket (Nginx/Caddy). Trạng thái bàn được ghi snapshot vào SQLite nên khởi động lại không mất ván đang chơi. Vì mỗi game chỉ có một bàn, chạy **một** instance là đủ; muốn chạy nhiều instance cần chuyển lưu trữ sang PostgreSQL và dùng adapter Socket.IO (xem `docs/architecture.md`).
