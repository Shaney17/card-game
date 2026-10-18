# Quyết định đang dùng tạm & câu hỏi cần chốt (spec §14)

Các lựa chọn dưới đây được chọn để có bản chạy được end-to-end. Tất cả đều **cấu hình được** hoặc tách thành module riêng; không coi là luật chính thức cho tới khi chủ sở hữu xác nhận.

| # | Câu hỏi | Đang dùng tạm |
|---|---|---|
| 1 | Luật Sâm | Sâm lốc miền Bắc, 10 lá, không đôi thông, chất không phân biệt |
| 2 | Tính tiền Sâm | Người thua trả người thắng theo số lá + cóng + thối 2; tiền chặt trả trực tiếp cho người chặt |
| 3 | Mèo Nổ | Bộ bài nguyên bản lấy cảm hứng, 1 module mở rộng "Hỗn Loạn" |
| 4 | Định danh | Vào nhanh bằng biệt danh (token lưu trình duyệt); quản trị bằng `ADMIN_PASSWORD` |
| 5 | Triển khai | Chạy local, một tiến trình Node + SQLite; sẵn sàng đặt sau reverse proxy |
| 6 | Phong cách | Kết hợp bản sắc Việt (chiếu cói, sơn mài, món ăn Việt trên lá mèo) + hoạt hình vui nhộn |

## Sâm
- Có áp dụng **"báo 1 / chặn 1"** (người kế tiếp còn 1 lá thì phải đánh lá lớn nhất khi đánh lẻ, sai thì đền) không? — _Chưa triển khai, chỉ hiển thị cảnh báo "Báo 1"._
- "Về bằng 2" khi bị cấm: hiện là **chặn ở server** (không cho đánh). Có cần biến thể "cho về nhưng bị phạt/coi như thua" không?
- Tiền chặt có áp dụng khi ván kết thúc do báo Sâm/ăn trắng không? — _Hiện: có, cộng dồn mọi kết cục._
- Chặt chồng (tứ quý chặt tứ quý đã chặt 2): người bị chặt sau có phải gánh luôn tiền chặt 2 trước đó không? — _Hiện: mỗi lần chặt là một khoản riêng._
- Thứ tự ưu tiên khi nhiều người ăn trắng cùng lúc — _Hiện: xét từ người đánh trước theo chiều chơi._
- Có giới hạn tiền thua theo số dư không (không cho âm)? — _Hiện: cho phép âm (tiền ảo)._
- Mức tiền mặc định (10/lá, cóng 150, thối 2 50, chặt 100/200, Sâm 200, ăn trắng 200, số dư đầu 10.000).

## Mèo Nổ
- Có muốn mô phỏng đúng một bản thương mại cụ thể không (tên/luật/số lượng)? Nếu có cần xác định phiên bản & quyền sử dụng.
- Cặp 2 lá: chỉ mèo sưu tập + Mèo Hoang (hiện tại) hay mọi lá giống nhau?
- Bộ ba gồm toàn Mèo Hoang có hợp lệ không? — _Hiện: có._
- Bom Nguyên Tử khi đang bị tấn công: kết thúc 1 lượt (hiện tại) hay toàn bộ lượt?
- Chôn Bài với Mèo Sập Nguồn đã lật ngửa ở trên cùng: hiện coi là rút bài → bị loại.
- Mèo Liều: có được gọi tên "Mèo Nổ" trong bộ ba để lấy bom của người khác không? — _Hiện: không cho gọi tên Mèo Nổ/Mèo Sập Nguồn._
- Mèo Hẹn Giờ: đếm theo lượt của người giữ (hiện tại) hay theo mọi lượt của cả bàn? Gỡ Bom có nên cho nhét bom hẹn giờ lại chồng bài thay vì vô hiệu?
- Ta Lấy Nhé: có được "Không!" khi mục tiêu đang rút không (hiện chỉ chặn được lúc đánh lá)?
- Ngưỡng rút gọn chồng bài `max(12, số người × 5)` có phù hợp không?
- Combo 5 mèo khác nhau (lấy lá từ chồng bỏ) — _chưa triển khai._
- Chính sách người chơi rời giữa ván: hiện là bị loại ngay; có cần giữ chỗ cho kết nối lại lâu hơn không?

## Nền tảng
- Có cần tài khoản đăng nhập thật (email/OAuth) thay cho biệt danh không?
- Có cần nạp lại tiền ảo khi số dư âm/hết không?
- Có cần chuyển sang PostgreSQL/Prisma ngay (đa instance) hay SQLite là đủ cho giai đoạn đầu?
