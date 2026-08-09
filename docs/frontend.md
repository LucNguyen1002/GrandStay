# GrandStay frontend

Frontend là React 19 SPA viết bằng TypeScript. Giao diện responsive có sidebar theo quyền, trạng thái tải/rỗng/lỗi và thông báo thao tác.

## Chức năng

- Landing page công khai tại `/` với nội dung giới thiệu, CTA và form chọn ngày/số khách; dashboard vận hành được tách riêng tại `/dashboard`.
- Đăng ký tài khoản khách hàng, đăng nhập truyền thống hoặc Google, tự xoay refresh token khi API trả `401`, đăng xuất một hoặc mọi thiết bị.
- Dashboard doanh thu, công suất phòng và dịch vụ bán chạy.
- Sơ đồ phòng theo tầng với trạng thái vận hành/lưu trú.
- Danh sách, tạo, xác nhận, hủy, nhận và trả phòng.
- CRUD khách hàng và dịch vụ; cấu hình tầng, hạng phòng, phòng, gói giá.
- Tra cứu công nợ/hóa đơn và ghi nhận thanh toán.
- Báo cáo doanh thu có biểu đồ và xuất CSV.
- Quản trị người dùng, thu hồi phiên và đổi mật khẩu cá nhân.

## Kiến trúc client

- `src/api`: Axios client, type contract, token store và refresh interceptor dùng một promise chung để tránh xoay token đồng thời.
- `src/auth`: trạng thái xác thực và kiểm tra role/permission.
- `src/components`: application shell và UI primitives theo phong cách shadcn.
- `src/pages`: màn hình nghiệp vụ, được lazy-load theo route.

Access/refresh token được giữ trong local storage để khôi phục phiên sau khi tải lại trang. CSP của Nginx chỉ mở thêm các nguồn Google cần cho Identity Services; production phải phục vụ qua HTTPS.
