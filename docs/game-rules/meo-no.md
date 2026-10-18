# Luật Mèo Nổ đang triển khai (`meo-no-2.2.0`)

Game **lấy cảm hứng** từ thể loại "mèo nổ", dùng bộ bài, tên gọi, mô tả và minh hoạ **nguyên bản** của dự án. Không mô phỏng chính xác một phiên bản thương mại.

## Chuẩn bị
- 2–8 người. Mỗi người nhận `handSize` (7) lá thường + 1 Gỡ Bom.
- Chồng bốc có **tối đa 1 Gỡ Bom** (`extraDefuses` 0–1, mặc định 1).
- Số Mèo Nổ = số người − 1 + `extraBombs` (mặc định **+1**), +1 nếu bật "Tăng Tốc" (Mèo Liều), −1 nếu bật "Hỗn Loạn" (thay bằng 1 Mèo Nổ Sập).
- "Kho Bom" thêm Mèo Hẹn Giờ (1 lá, 2 lá khi từ 5 người), 1 Mèo Nổ Dây Chuyền và 2 Mèo Bom Khói.
- `trimDeck` (bật mặc định): chồng bốc giữ tối đa `max(20, số người × 8)` lá thường, trong đó mèo sưu tập tối đa 30% — phần còn lại là lá hành động.
- Mặc định bật cả 4 bộ mở rộng; `deckCopies = auto` dùng 2 bộ khi trên 5 người. Server từ chối bắt đầu nếu không đủ Gỡ Bom/lá thường (thông báo cụ thể).

## Lượt
1. Đánh 0..n lá hành động. Mỗi lá mở **cửa sổ phản ứng** `nopeWindowMs` (6s); ai cũng bấm "Cho qua" được để xử lý sớm (không lộ ai có "Không!").
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
| Tấn Công | 5 | Kết thúc lượt không rút; người kế chơi 2 lượt (`attackStacking`: đang bị tấn công thì cộng dồn lượt còn lại + 2) |
| Qua Lượt | 6 | Kết thúc 1 lượt không rút |
| Thiện Ý | 4 | Mục tiêu (còn bài) tự chọn 1 lá đưa cho bạn |
| Xào Bài | 5 | Xáo chồng bài |
| Xem Trước Tương Lai | 6 | Xem bí mật 3 lá trên cùng |
| Không! | 6 | Chặn hành động vừa đánh (trừ Mèo Nổ/Gỡ Bom); chồng "Không!" lên "Không!" được |
| Rút Từ Đáy | 4 | Kết thúc lượt bằng lá dưới cùng |
| Biến Đổi Tương Lai | 5 | Xem & xếp lại 3 lá trên |
| Tấn Công Mục Tiêu | 4 | Chọn người chơi 2 lượt, lượt tiếp tục từ người đó |
| Mèo Hoang | 4 | Joker: ghép với mọi mèo sưu tập để tạo cặp/bộ ba |
| 5 loại mèo sưu tập (Bánh Bao, Trà Sữa, Xôi Gấc, Phở Bò, Chè Ba Màu) | 4 mỗi loại | **2 lá giống nhau: người đánh chọn 1 lá úp** trên tay mục tiêu (thứ tự được server xáo bí mật; lá đã bị Đánh Dấu thì lộ mặt; hết giờ chọn ngẫu nhiên). 3 lá giống nhau: gọi tên 1 lá, có thì phải đưa |

### Mở rộng "Hỗn Loạn" (lấy cảm hứng Imploding Kittens)
| Lá | SL | Hiệu ứng |
|---|---|---|
| Đổi Chiều | 4 | Đổi chiều chơi + kết thúc 1 lượt |
| Mèo Nổ Sập | 1 | Rút lần đầu: lật ngửa, người rút đặt lại vị trí tuỳ ý (cả bàn thấy vị trí). Rút lần hai: bị loại, không Gỡ Bom/"Không!" được |

### Mở rộng "Tăng Tốc" (lấy cảm hứng Streaking Kittens)
| Lá | SL | Hiệu ứng |
|---|---|---|
| Siêu Né | 2 | Kết thúc toàn bộ lượt đang phải chơi |
| Mèo Liều | 1 | Không đánh ra. Khi còn trên tay, rút Mèo Nổ thì giữ bí mật (công khai chỉ thấy "rút một lá"). Số bom giữ được ≤ số Mèo Liều; Mèo Liều rời tay (bị cướp, đưa, Dọn Rác…) thì bom phải Gỡ ngay hoặc bị loại — không mất lượt của người đang chơi |
| Đổi Đầu Đuôi | 3 | Đổi lá trên cùng và dưới cùng |
| Bom Nguyên Tử | 1 | Mọi Mèo Nổ trong chồng bài lên trên cùng, phần còn lại xáo; kết thúc 1 lượt không rút |
| Dọn Rác | 2 | Mọi người còn sống chọn 1 lá trên tay xáo vào chồng bài (chọn đồng thời) |
| Đánh Dấu | 3 | 1 lá ngẫu nhiên của mục tiêu lộ mặt cho cả bàn tới khi rời tay |

### Mở rộng "Đào Bới" (lấy cảm hứng Barking/Zombie Kittens)
| Lá | SL | Hiệu ứng |
|---|---|---|
| Chôn Bài | 4 | Kết thúc lượt: rút lá trên cùng, xem bí mật, chôn lại vị trí tuỳ ý (kể cả Mèo Nổ — không nổ) |
| Tự Tấn Công | 4 | Bản thân phải chơi thêm 2 lượt (tính là đang bị tấn công, nên Tấn Công tiếp theo cộng dồn) |
| Góp Lẩu | 2 | Lần lượt từ người đánh theo chiều chơi, mỗi người úp 1 lá lên trên cùng |
| Chia Sẻ Tương Lai | 3 | Xem & xếp 3 lá trên, sau đó người kế tiếp được xem |
| Đào Sâu | 3 | Kết thúc lượt: xem lá trên cùng, giữ nó hoặc trả lại và rút lá bên dưới |

### Mở rộng "Kho Bom" (nguyên bản; Ta Lấy Nhé lấy cảm hứng Barking Kittens)
| Lá | SL | Hiệu ứng |
|---|---|---|
| Mèo Hẹn Giờ | 1–2 | Không chia lên tay. Ai rút phải thì đặt ngửa trước mặt (công khai), đếm ngược `timeBombTurns` (3) lượt **của chính người giữ** — lượt rút không tính; mọi cách kết thúc lượt (rút, Né, Tấn Công, Siêu Né…) đều trừ 1. Về 0: có Gỡ Bom thì mất Gỡ Bom và bom bị vô hiệu; không có thì bị loại |
| Chuyền Bom | 3 | Chuyền Mèo Hẹn Giờ bạn đang giữ cho người khác, giữ nguyên số lượt còn lại; không kết thúc lượt |
| Tua Nhanh | 2 | Mọi Mèo Hẹn Giờ đang đếm bị trừ 1 ngay lập tức |
| Mèo Nổ Dây Chuyền | 1 | Rút phải: người nhận lá **và** người kế tiếp đều dính bom; ai có Gỡ Bom thì tự dùng (lá bị huỷ), không có thì bị loại |
| Mèo Bom Khói | 2 | Rút phải không bị loại nhưng rơi ngẫu nhiên 2 lá trên tay (Gỡ Bom không cứu) |
| Ta Lấy Nhé | 3 | Lá tiếp theo mục tiêu rút (kể cả Mèo Nổ/Mèo Nổ Sập/Mèo Hẹn Giờ) về tay bạn; lượt của mục tiêu vẫn kết thúc. Mỗi người chỉ bị giành 1 lần một lúc |

## Bài trên tay
Thứ tự bài là tuỳ chọn phía client: kéo thả để đổi chỗ (chuột: kéo ngay; cảm ứng: nhấn giữ ~0,25 giây rồi kéo, vuốt nhanh để cuộn), nút "Xếp bài" và công tắc "Tự xếp" (bom đang giữ → Gỡ Bom → Mèo Liều → "Không!" → hành động → mèo sưu tập theo loại).

Mục tiêu bị loại/hết bài lúc hiệu ứng được xử lý → hiệu ứng mất tác dụng. Lá bị "Không!" vẫn vào chồng bỏ, lượt tiếp tục.

## Dữ liệu công khai / riêng tư
Công khai: số bài mỗi người, Mèo Hẹn Giờ đang đếm và người giữ, ai đang bị "Ta Lấy Nhé", số lá trong chồng, số Mèo Nổ **chưa nổ** (trong chồng + đang bị giữ, để không lộ ai giữ bom), vị trí Mèo Nổ Sập đã lật ngửa, lá bị Đánh Dấu, 5 lá trên cùng chồng bỏ, lượt, chiều chơi, người bị loại, chuỗi "Không!". Riêng tư: bài trên tay, kết quả Xem Trước Tương Lai/Sắp Đặt/Chia Sẻ Tương Lai, lá Chôn Bài/Đào Sâu, lá bị lấy/được đưa (chỉ hai bên thấy), vị trí nhét bom và chôn bài.

## Tên lá
Tên các lá cơ bản theo cách gọi phổ biến của cộng đồng chơi tiếng Việt (Qua Lượt, Xào Bài, Thiện Ý, Xem Trước Tương Lai, Rút Từ Đáy, Đổi Chiều, Biến Đổi Tương Lai, Tấn Công Mục Tiêu, Mèo Hoang, Mèo Nổ Sập).
