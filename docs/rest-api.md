# GrandStay HMS — REST API

Base path: `/api/v1`. OpenAPI JSON: `/v3/api-docs`. Swagger UI: `/swagger-ui.html` khi được bật.

## Nhóm endpoint

| Nhóm | Endpoint chính | Quyền |
|---|---|---|
| Xác thực | `POST /auth/register`, `/login`, `/google`, `/refresh`, `/logout`, `/change-password` | Public cho register/login/google/refresh/logout; đổi mật khẩu cần JWT |
| Đặt phòng | `GET/POST /bookings`, `POST /bookings/{id}/confirm`, `/cancel`, `/check-in`, `/check-out` | `booking:*` |
| Khách tự đặt phòng | `GET/POST /self/bookings`, `GET /self/bookings/{id}`, `POST /self/bookings/{id}/cancel` | `CUSTOMER`; chỉ dữ liệu thuộc tài khoản đăng nhập |
| Khách thanh toán cọc | `GET /self/payments/bookings/{bookingId}/deposit`, `POST /self/payments/bookings/{bookingId}/vnpay`, `GET /self/payments/{paymentId}`, `POST /self/payments/{paymentId}/vnpay/reconcile` | `CUSTOMER`; ownership bắt buộc, số tiền cọc do backend tính |
| Dịch vụ lưu trú | `POST /bookings/{id}/services` | `service:write` |
| Phòng | `GET/POST/PUT/DELETE /rooms`, `GET /rooms/matrix`, `GET /rooms/available?from=&to=` | `room:*` |
| Hạng/tầng/gói giá | `/room-types`, `/floors`, `/rate-plans` | `room:*` |
| Tiện nghi | `GET/POST/PUT/DELETE /amenities` | Đọc bằng `room:read`, quản lý bằng `room:write` |
| Khuyến mãi | `GET/POST/PUT/DELETE /promotions` | `promotion:read/write` |
| Khách hàng | `GET/POST/PUT/DELETE /customers` | `booking:read/write` |
| Dịch vụ | `GET/POST/PUT/DELETE /services` | `service:*` |
| Thanh toán | `POST /payments`, `/payments/{id}/complete`, `/payments/{id}/refunds`, `GET /payments/{id}`, `/payments/bookings/{bookingId}`, `/balance` | `payment:*` |
| VNPay | `GET /payments/vnpay/config`, `POST /payments/vnpay`, `POST /payments/vnpay/{paymentId}/reconcile` | `payment:read/write` |
| VNPay callback | `GET /payments/vnpay/ipn`, `GET /payments/vnpay/return` | Public; bắt buộc chữ ký HMAC-SHA512 hợp lệ |
| Hóa đơn | `GET /invoices/{id}`, `/invoices/bookings/{bookingId}` | `payment:read` |
| Người dùng | `GET/POST/PUT/DELETE /users`, `GET /users/{id}/roles`, `/sessions`, `POST /users/{id}/lock`, `/unlock`, `/revoke-sessions`, `DELETE /users/{id}/sessions/{familyId}` | `ADMIN` |
| Ảnh đại diện | `PUT/DELETE /users/me/avatar`, `GET /users/{id}/avatar` | Chủ tài khoản cập nhật/xóa; ảnh được phép hiển thị công khai theo UUID |
| Dashboard/báo cáo | `GET /dashboard`, `/reports/revenue`, `/occupancy`, `/services`, `/receivables`, `/export.pdf` | `report:read` |
| Nhật ký kiểm toán | `GET /audit-logs` với bộ lọc actor/action/entity/thời gian | `audit:read` |

Các list endpoint dùng Spring pageable (`page`, `size`, `sort`) và filter phù hợp. `GET /bookings` nhận thêm `status` và `search`; `search` tìm không phân biệt hoa thường theo mã đặt phòng hoặc tên khách trên toàn bộ dữ liệu. Request dùng Jakarta Validation. Lỗi nghiệp vụ, validation, concurrency và security trả `application/problem+json` với mã `code` ổn định; SQL, stack trace, token và dữ liệu định danh không xuất hiện trong response.

Room matrix suy ra `RESERVED`/`OCCUPIED` tại thời điểm query từ `booking_rooms`, không lưu hai trạng thái này trong bảng `rooms`. Trường `bookingId` chỉ được trả cho tài khoản có `booking:read`; tài khoản customer chỉ thấy trạng thái tổng quát.

Endpoint `GET /rooms/available` kiểm tra toàn bộ khoảng lưu trú bằng toán tử overlap của PostgreSQL range. Giao diện đặt phòng sử dụng endpoint này trước khi cho phép phân một hoặc nhiều phòng; exclusion constraint vẫn là lớp bảo vệ cuối cùng khi có nhiều nhân viên thao tác đồng thời.

`GET /promotions` mặc định chỉ trả các ưu đãi đang bật, nằm trong thời gian hiệu lực và chưa hết lượt để dùng trong form đặt phòng. Quản trị viên dùng `includeInactive=true` để xem đầy đủ danh mục. Mức giảm cuối cùng vẫn được backend kiểm tra và tính trong transaction tạo booking. Tiện nghi được gán theo hạng phòng kèm số lượng qua payload của `/amenities`.

## Xác thực

Gửi access token bằng `Authorization: Bearer <token>`. Access token mặc định sống 15 phút; refresh token 30 ngày và được xoay sau mỗi lần sử dụng. Nếu một refresh token cũ bị dùng lại, toàn bộ token family bị thu hồi. Đổi mật khẩu cũng thu hồi mọi refresh token của tài khoản.

Đăng ký truyền thống nhận `fullName`, `username`, `email`, `password` và trả về token pair với HTTP `201`. Google login nhận `{ "credential": "<Google ID token>" }`; backend chỉ phát hành token GrandStay sau khi xác minh token với Google và đúng audience đã cấu hình.

Ảnh đại diện được gửi bằng `multipart/form-data`, trường file tên `file`. Hệ thống chỉ nhận JPEG/PNG hợp lệ, tối đa 2 MB và kích thước tối đa 2048 × 2048 px; dữ liệu ảnh được lưu trong bảng `user_avatars` của PostgreSQL.

Danh sách phiên đăng nhập chỉ trả metadata thiết bị, IP, thời điểm và trạng thái theo token family; hash hoặc giá trị token không được trả về. Nhật ký kiểm toán cũng chỉ ghi metadata của request thay đổi thành công, không ghi request body hay dữ liệu xác thực.
