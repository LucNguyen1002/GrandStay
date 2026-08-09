# GrandStay HMS — Authentication và RBAC (Bước 5)

## Thiết kế

- Access token là JWT HS256, TTL mặc định 15 phút, có `iss`, `sub`, `iat`, `exp`, `jti`, `roles` và `authorities`.
- Secret bắt buộc tối thiểu 32 byte; profile production không có default.
- Refresh token là 64 byte ngẫu nhiên từ `SecureRandom`; client nhận raw token đúng một lần, database chỉ lưu SHA-256 hash.
- Mỗi lần refresh tạo token mới, revoke token cũ với lý do `ROTATED` và giữ cùng `family_id`.
- Nếu token đã rotate bị dùng lại, toàn token family bị revoke trong transaction vẫn commit dù API trả 401.
- Logout hỗ trợ revoke một token hoặc toàn family; admin có thể revoke mọi session của một user.
- Password dùng BCrypt cost 12. Login không tiết lộ tài khoản có tồn tại; user không tồn tại vẫn chạy BCrypt dummy check để giảm timing enumeration.
- Hai lớp rate limit: theo IP+login và theo account failed attempts/temporary lock. Refresh có limit riêng theo IP.
- API stateless, CORS allow-list, RFC 7807 cho 401/403 và method security bằng permission.

## RBAC seed

Migration `V2__seed_rbac.sql` tạo bốn system roles `ADMIN`, `MANAGER`, `RECEPTIONIST`, `CUSTOMER`, 15 permissions và mapping mặc định. Không seed password mặc định.

## Đăng ký và Google Sign-In

- `POST /api/v1/auth/register` cho phép tự đăng ký bằng họ tên, username, email và mật khẩu. Username/email không phân biệt hoa thường khi kiểm tra trùng; mật khẩu có 12–72 ký tự và được băm BCrypt cost 12.
- Tài khoản tự đăng ký luôn nhận role `CUSTOMER`; client nhận ngay access/refresh token để bắt đầu phiên.
- `CUSTOMER` chỉ có `room:read`. Không cấp `booking:read/write` toàn cục cho tài khoản tự đăng ký khi API chưa thực thi ownership theo người dùng.
- Frontend dùng Google Identity Services lấy ID token rồi gửi đến `POST /api/v1/auth/google`.
- Backend xác minh chữ ký bằng Google JWK, thời hạn, issuer, audience khớp `GOOGLE_CLIENT_ID` và cờ `email_verified` trước khi tin dữ liệu.
- `sub` của Google được lưu ở `users.google_subject` làm khóa danh tính ổn định. Email đã xác minh trùng tài khoản cũ sẽ liên kết Google; Google login lần đầu với email mới tạo tài khoản `CUSTOMER`.
- Tài khoản chỉ dùng Google vẫn có password hash ngẫu nhiên không thể dùng để đăng nhập truyền thống. Người dùng không thể đặt lại hoặc suy ra giá trị này.

## Cấu hình

```text
JWT_SECRET                         >= 32 byte, bắt buộc ở dev/prod
JWT_ISSUER                         mặc định grandstay-hms
JWT_ACCESS_TTL                     mặc định 15m
JWT_REFRESH_TTL                    mặc định 30d
LOGIN_RATE_LIMIT                   mặc định 5/phút/key
REFRESH_RATE_LIMIT                 mặc định 30/phút/IP
ACCOUNT_FAILURE_LIMIT              mặc định 5
ACCOUNT_LOCK_DURATION              mặc định 15m
ALLOWED_ORIGINS                    danh sách origin phân tách bằng dấu phẩy
GOOGLE_CLIENT_ID                   OAuth 2.0 Web Client ID; để trống sẽ tắt Google Sign-In
GOOGLE_JWK_SET_URI                 mặc định Google OAuth JWK endpoint
```

## Kiểm thử đã thực hiện

Testcontainers integration test chứng minh BCrypt login, access token decode/issuer, refresh rotation, reuse detection, revoke family, RBAC seed và lưu PostgreSQL `inet` đều hoạt động trên PostgreSQL 17.
