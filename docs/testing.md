# Chiến lược kiểm thử

## Backend

- Unit test: tính giá theo giờ/ngày/đêm, phí nhận sớm/trả muộn, chuyển trạng thái booking.
- PostgreSQL integration test: chống trùng phòng và biên thời gian liền kề; luồng booking → check-in → dịch vụ → check-out → hóa đơn → thanh toán/refund.
- Security integration test: đăng ký customer, chống trùng danh tính, đăng nhập, JWT, refresh rotation, token reuse, thu hồi token family, đổi mật khẩu và thu hồi phiên.
- Dashboard integration test: truy vấn báo cáo và kiểu `tstzrange` trên cơ sở dữ liệu thật.

Integration test dùng PostgreSQL 17 qua Testcontainers và chỉ bị skip khi môi trường không có Docker.

## Frontend

- Vitest/jsdom kiểm tra lưu, xóa và giải mã token.
- `tsc -b` kiểm tra type contract; Vite production build kiểm tra bundling và route lazy chunks.
- Docker smoke test kiểm tra health frontend/backend, đăng nhập qua reverse proxy và dashboard được bảo vệ.
