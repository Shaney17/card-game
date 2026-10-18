# Luật Sâm đang triển khai (`sam-loc-1.0.0`)

Biến thể: **Sâm lốc miền Bắc**, 2–5 người, 52 lá, mỗi người 10 lá. Mọi con số dưới đây là **giá trị mặc định có thể cấu hình**, chưa được chủ sở hữu xác nhận.

## Thứ tự & tổ hợp
- 3 < 4 < … < K < A < 2. Chất không có giá trị; bằng nhau không chặn được.
- Lẻ, đôi, sám cô (3), tứ quý (4), sảnh ≥ 3 lá liên tiếp.
- `lowStraights` (mặc định bật): cho sảnh A-2-3, 2-3-4…; không bao giờ nối vòng K-A-2.
- Không có đôi thông.

## Lượt
- Người dẫn đánh bộ bất kỳ; người sau đánh bộ cùng loại, cùng số lá, lớn hơn — hoặc bỏ lượt.
- Bỏ lượt thì không vào lại vòng đó. Mọi người bỏ hết → người đánh cuối dẫn vòng mới.
- Ván đầu: người đánh trước chọn ngẫu nhiên (CSPRNG); ván sau: người thắng ván trước.
- Hết giờ (`turnTimeMs`, 30s): đang dẫn → tự đánh bộ nhỏ nhất; đang chặn → tự bỏ lượt.
- `lastCardTwo = forbidden` (mặc định): không được về bằng bộ chứa quân 2. Nếu đang dẫn vòng mà chỉ còn đúng 1 quân 2 → được nhường lượt dẫn.
- Rời bàn giữa ván: máy đánh thay (nhịp 1,2s) tới hết ván, vẫn quyết toán bình thường.

## Chặt
- `quadBeatsTwo` (bật): tứ quý chặt 2 lẻ → người có 2 trả người chặt `cutTwoPenalty` (100).
- `quadBeatsPairTwo` (tắt): tứ quý chặt đôi 2 → `cutPairTwoPenalty` (200).
- Tứ quý lớn chặt tứ quý nhỏ → `cutQuadPenalty` (200).

## Báo Sâm
- Đầu ván có `samDeclareMs` (10s) để báo. Ai báo trước được đánh trước.
- Người khác chặn được bất kỳ bộ nào của người báo → ván kết thúc ngay, người chặn thắng.
- Thành công: mỗi người trả `samReward` (200). Thất bại: `samFailMode` = trả mỗi người `samPenalty` (mặc định) hoặc trả người chặn `samPenalty × (n−1)`.

## Ăn trắng (kiểm tra ngay khi chia, theo thứ tự từ người đánh trước)
Tứ quý 2, sảnh rồng 10 lá, 5 đôi, 3 sám cô, 10 lá đồng màu — bật/tắt từng loại. Mỗi người trả `instantWinAmount` (200).

## Tính tiền khi thua thường (`SamScoringEngine`)
- `perCardPlusPenalties` (mặc định): `số lá còn lại × perCardPenalty (10)`; nếu **cóng** (chưa đánh lá nào, còn đủ 10) thì trả `congPenalty (150)` thay cho tiền lá; cộng thêm **thối 2** = `số quân 2 × thoiTwoPenalty (50)`.
- `flat`: mỗi người thua trả `flatLossAmount`.
- Tiền chặt cộng dồn ở mọi kết cục. Mọi khoản là chuyển tiền giữa hai người ⇒ tổng luôn bằng 0.

## Điểm chưa chốt
Xem [../open-questions.md](../open-questions.md#sâm).
