# Triển khai GrandStay

## Thành phần

`compose.yml` tạo ba service trên mạng nội bộ:

1. `postgres`: PostgreSQL 17, volume bền vững và health check.
2. `backend`: JRE 17 chạy bằng user không đặc quyền, Flyway migrate khi khởi động, readiness probe.
3. `frontend`: Nginx phục vụ SPA, reverse proxy `/api`, cache asset bất biến, CSP và security headers.

## Cấu hình bắt buộc

- `POSTGRES_PASSWORD`: mật khẩu database riêng cho môi trường.
- `JWT_SECRET`: ít nhất 32 byte ngẫu nhiên; đổi giá trị sẽ vô hiệu access token hiện có.
- `ADMIN_BOOTSTRAP_*`: chỉ bật để tạo quản trị viên đầu tiên. Bootstrap idempotent theo username và không ghi mật khẩu rõ vào database.
- `ALLOWED_ORIGINS`: origin chính xác của web nếu backend được truy cập trực tiếp.
- `GOOGLE_CLIENT_ID`: OAuth 2.0 Web Client ID dùng chung cho backend và frontend. Origin triển khai phải có trong Authorized JavaScript origins của Google; thay đổi giá trị cần build lại image frontend.
- `OPENAPI_ENABLED=false` trên production trừ khi tài liệu API được bảo vệ ở lớp mạng.

## Vận hành

```bash
docker compose build
docker compose up -d
docker compose ps
docker compose logs -f backend
```

Flyway không cho clean và Hibernate chạy `validate`, nên lỗi schema làm backend fail-fast. Trước mỗi lần phát hành, sao lưu database, chạy migration trên staging, kiểm tra readiness và thực hiện smoke test đăng nhập/dashboard qua URL frontend.

Dữ liệu nằm trong volume `grandstay-postgres-data`. `docker compose down` giữ dữ liệu; không dùng cờ `-v` nếu chưa có bản sao lưu.
