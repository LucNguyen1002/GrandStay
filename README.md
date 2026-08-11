# GrandStay Hotel Management System

GrandStay là hệ thống quản lý khách sạn dạng modular monolith, gồm API Spring Boot, giao diện React và PostgreSQL. Hệ thống hỗ trợ quản lý phòng, khách hàng, đặt/nhận/trả phòng, dịch vụ phát sinh, hóa đơn, thanh toán, dashboard, báo cáo doanh thu, người dùng và RBAC.

## Khởi chạy nhanh bằng Docker

Yêu cầu: Docker Desktop hoặc Docker Engine có Compose v2.

1. Tạo file `.env` ở thư mục gốc dự án (nếu file này đã tồn tại thì giữ nguyên).
2. Cấu hình `POSTGRES_PASSWORD`, `JWT_SECRET`, `PII_ENCRYPTION_KEY` và `ADMIN_BOOTSTRAP_PASSWORD` bằng các giá trị bí mật mạnh, khác nhau. Giữ `ADMIN_BOOTSTRAP_ENABLED=true` ở lần chạy đầu. Để bật đăng nhập Google, điền Web Client ID vào `GOOGLE_CLIENT_ID`.
3. Chạy `docker compose up -d --build`.
4. Lần chạy đầu với database trống, hệ thống tự tạo danh mục mẫu cho khách sạn vừa–nhỏ khi `CATALOG_BOOTSTRAP_ENABLED=true` (mặc định trong Compose): 3 tầng, 4 hạng phòng, 24 phòng, 12 gói giá, tiện nghi và dịch vụ cơ bản.
5. Mở landing page tại `http://localhost:3000`, chọn **Đăng nhập** và dùng tài khoản bootstrap đã cấu hình. Dashboard vận hành nằm tại `/dashboard`.
6. Đổi mật khẩu tại **Thiết lập & tài khoản**, đặt `ADMIN_BOOTSTRAP_ENABLED=false`, rồi chạy lại `docker compose up -d`.

Catalog bootstrap chỉ chạy khi cả tầng, hạng phòng, phòng và gói giá đều đang trống; nếu đã có bất kỳ dữ liệu danh mục nào, hệ thống sẽ bỏ qua để không trộn dữ liệu giả định vào dữ liệu nghiệp vụ. Có thể đặt `CATALOG_BOOTSTRAP_ENABLED=false` để tắt hoàn toàn.

Các địa chỉ mặc định:

- Web: `http://localhost:3000`
- API: `http://localhost:8080/api/v1`
- Health: `http://localhost:8080/actuator/health/readiness`
- OpenAPI (khi bật): `http://localhost:8080/swagger-ui.html`

## Phát triển cục bộ

Backend yêu cầu Java 17 và PostgreSQL 17:

```powershell
cd grandstay-backend
.\mvnw.cmd spring-boot:run
```

Profile `local` chạy ở `http://localhost:8081` để không xung đột backend Docker ở cổng `8080`. Vite mặc định dùng backend Docker `8080`; để frontend development gọi backend Java local, đặt `VITE_DEV_API_TARGET=http://localhost:8081` trước khi chạy `npm run dev`.

Frontend yêu cầu Node.js 22:

```powershell
cd grandstay-frontend
npm ci
npm run dev
```

Vite chuyển tiếp `/api` đến backend ở cổng `8080`.

### Cấu hình đăng nhập Google

Tạo OAuth 2.0 Client loại **Web application** trong Google Cloud Console và thêm origin của frontend (ví dụ `http://localhost:3000` và `http://localhost:5173`) vào **Authorized JavaScript origins**. Dùng cùng một Client ID cho backend và frontend:

- Docker Compose: đặt `GOOGLE_CLIENT_ID` trong file `.env`, rồi build lại frontend.
- Chạy cục bộ: đặt `GOOGLE_CLIENT_ID` cho backend và `VITE_GOOGLE_CLIENT_ID` cho Vite.

Không cần redirect URI vì frontend gửi Google ID token trực tiếp đến `POST /api/v1/auth/google` để backend kiểm tra.

## Thanh toán

Thu ngân có thể ghi nhận tiền mặt, thẻ, chuyển khoản, QR thủ công hoặc tạo giao dịch VNPay. Khách hàng có thể thanh toán đúng số tiền cọc do backend tính từ giá phòng sau ưu đãi và thuế dự kiến (mặc định 30%, cấu hình bằng `CUSTOMER_DEPOSIT_PERCENT`).

Để bật VNPay Sandbox, cấu hình trong `.env`:

```dotenv
VNPAY_ENABLED=true
VNPAY_TMN_CODE=ma-website-do-vnpay-cap
VNPAY_HASH_SECRET=chuoi-bi-mat-do-vnpay-cap
VNPAY_RETURN_URL=https://your-public-domain/api/v1/payments/vnpay/return
VNPAY_IPN_URL=https://your-public-domain/api/v1/payments/vnpay/ipn
VNPAY_FRONTEND_RESULT_URL=http://localhost:3000/payment/vnpay/result
```

Để giữ nguyên callback VNPay khi Docker khởi động lại, cấu hình dev domain cố định của ngrok:

```dotenv
NGROK_AUTHTOKEN=authtoken-do-ngrok-cap
NGROK_DOMAIN=dev-domain-do-ngrok-cap.ngrok-free.dev
```

Đặt `VNPAY_RETURN_URL` và `VNPAY_IPN_URL` theo `NGROK_DOMAIN`, sau đó chạy `docker compose up -d`.
Service `ngrok` trong Compose tự chờ backend khỏe, mở tunnel tới `backend:8080` và cung cấp giao diện kiểm tra tại `http://localhost:4040`.

`VNPAY_IPN_URL` phải là URL HTTPS mà máy chủ VNPay truy cập được; `localhost` không dùng được cho IPN. GrandStay tạo giao dịch `PENDING`, xác minh HMAC-SHA512, số tiền và mã tham chiếu trước khi cập nhật. Return URL chỉ điều hướng trình duyệt; chỉ IPN hợp lệ hoặc kết quả `querydr` được xác minh mới có thể ghi nhận `COMPLETED`. Tài liệu chính thức: [VNPay Sandbox PAY](https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html).

## Khách hàng tự đặt phòng và xác minh danh tính

Tài khoản có vai trò `CUSTOMER` có thể lọc và so sánh hạng phòng tại **Tìm & chọn phòng**, tạo booking, xem tiền cọc, lịch sử và hủy booking của chính mình. Backend liên kết tài khoản với một hồ sơ `Customer` qua `customers.user_id`; các API `/api/v1/self/**` không chấp nhận định danh chủ sở hữu do trình duyệt cung cấp và không trả booking hoặc payment của tài khoản khác.

Khách nhập CCCD/hộ chiếu và tải ảnh đối chiếu tại **Tài khoản**. Số giấy tờ và ảnh được mã hóa AES-GCM; mật khẩu được băm BCrypt cost 12. Lễ tân/admin duyệt hồ sơ bằng biểu tượng định danh trong trang **Khách hàng**. Hệ thống vẫn cho phép đặt trước nhưng chặn thao tác nhận phòng cho đến khi khách chính có trạng thái **Đã xác minh**. `PII_ENCRYPTION_KEY` phải được giữ ổn định: nếu đổi hoặc mất khóa này, dữ liệu giấy tờ đã mã hóa sẽ không thể giải mã.

## Kiểm thử

```powershell
cd grandstay-backend
.\mvnw.cmd clean verify

cd ..\grandstay-frontend
npm test
npm run build
```

Khi Docker hoạt động, backend chạy integration test trên PostgreSQL thật bằng Testcontainers. Pipeline trong `.github/workflows/ci.yml` kiểm tra backend, frontend và khả năng build cả hai container.

## Cấu trúc

- `grandstay-backend`: Java 17, Spring Boot 3, Security 6/JWT, JPA, Flyway, MapStruct.
- `grandstay-frontend`: React 19, TypeScript, Vite, Tailwind CSS, TanStack Query, React Hook Form/Zod, Recharts.
- `docs`: thiết kế dữ liệu, domain, nghiệp vụ, xác thực, API, frontend, kiểm thử và triển khai.
- `compose.yml`: PostgreSQL, backend, frontend Nginx và ngrok với health checks, tunnel cố định và persistent volume.

Không lưu `.env` hoặc bí mật thật vào source control. Sao lưu PostgreSQL trước khi nâng cấp production và luôn kiểm tra migration trên bản sao dữ liệu.
