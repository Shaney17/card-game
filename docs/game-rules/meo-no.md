# Luật Mèo Nổ đang triển khai (`meo-no-1.0.0`)

Game **lấy cảm hứng** từ thể loại "mèo nổ", dùng bộ bài, tên gọi, mô tả và minh hoạ **nguyên bản** của dự án. Không mô phỏng chính xác một phiên bản thương mại.

## Chuẩn bị
- 2–8 người. Mỗi người nhận `handSize` (7) lá thường + 1 Gỡ Bom.
- Chồng bài: phần còn lại + (số người − 1) Mèo Nổ + `extraDefuses` (2) Gỡ Bom (giới hạn theo số Gỡ Bom còn lại).
- `deckCopies = auto`: dùng 2 bộ khi trên 5 người. Server từ chối bắt đầu nếu không đủ Gỡ Bom/Mèo Nổ/lá thường (thông báo cụ thể).

## Lượt
1. Đánh 0..n lá hành động. Mỗi lá mở **cửa sổ phản ứng** `nopeWindowMs` (4s); ai cũng bấm "Cho qua" được để xử lý sớm (không lộ ai có "Không!").
2. Kết thúc bằng rút 1 lá (trừ khi lá đã đánh kết thúc lượt).
3. Rút Mèo Nổ: có Gỡ Bom → tự dùng, bí mật nhét lại vị trí 0..n (hết `choiceTimeMs` → ngẫu nhiên); không có → bị loại.
4. Còn 1 người → thắng.
- Hết `turnTimeMs` (45s) → tự rút bài.
- Rời bàn giữa ván = bị loại. Mất kết nối quá `disconnectTimeoutMs` (60s) → bị loại (hoặc chỉ tự rút khi hết giờ nếu `disconnectPolicy = autoDraw`).

## Lá bài (dữ liệu: `packages/shared/src/cats-cards.ts`, handler: `apps/server/src/games/exploding-cats/effects`)

| Lá | Số lượng/bộ | Hiệu ứng |
|---|---|---|
| Mèo Nổ | 4 | Rút phải mà không có Gỡ Bom thì bị loại |
| Gỡ Bom | 6 | Tự dùng khi rút Mèo Nổ; chọn vị trí nhét lại |
| Tấn Công | 4 | Kết thúc lượt không rút; người kế chơi 2 lượt (`attackStacking`: đang bị tấn công thì cộng dồn lượt còn lại + 2) |
| Né Lượt | 4 | Kết thúc 1 lượt không rút |
| Xin Xỏ | 4 | Mục tiêu (còn bài) tự chọn 1 lá đưa cho bạn |
| Xáo Tung | 4 | Xáo chồng bài |
| Mắt Thần | 5 | Xem bí mật 3 lá trên cùng |
| Không! | 5 | Chặn hành động vừa đánh (trừ Mèo Nổ/Gỡ Bom); chồng "Không!" lên "Không!" được |
| 5 loại mèo sưu tập (Bánh Bao, Trà Sữa, Xôi Gấc, Phở Bò, Chè Ba Màu) | 4 mỗi loại | 2 lá giống nhau: cướp ngẫu nhiên 1 lá; 3 lá giống nhau: gọi tên 1 lá, có thì phải đưa |

**Mở rộng "Hỗn Loạn"** (bật/tắt trong cấu hình): Quay Xe (đảo chiều + kết thúc 1 lượt), Rút Đáy (kết thúc lượt bằng lá dưới cùng), Sắp Đặt Tương Lai (xem & xếp lại 3 lá trên), Tấn Công Chỉ Định (chọn người chơi 2 lượt, lượt tiếp tục từ người đó).

Mục tiêu bị loại/hết bài lúc hiệu ứng được xử lý → hiệu ứng mất tác dụng. Lá bị "Không!" vẫn vào chồng bỏ, lượt tiếp tục.

## Dữ liệu công khai / riêng tư
Công khai: số bài mỗi người, số lá & số Mèo Nổ còn trong chồng, 5 lá trên cùng chồng bỏ, lượt, chiều chơi, người bị loại, chuỗi "Không!". Riêng tư: bài trên tay, kết quả Mắt Thần/Sắp Đặt Tương Lai, lá bị cướp/được đưa (chỉ hai bên thấy), vị trí nhét bom.
