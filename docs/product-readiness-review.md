# Đánh giá mức độ hoàn thiện sản phẩm GrandStay HMS

## Phạm vi đã hoạt động

- Xác thực JWT, refresh-token rotation, đăng xuất, thu hồi phiên, RBAC và đổi mật khẩu.
- Dashboard doanh thu/công suất, sơ đồ phòng theo tầng và trạng thái suy ra từ lưu trú.
- Vòng đời đặt phòng: tạo, xác nhận, nhận phòng, trả phòng và hủy.
- Hồ sơ khách hàng, danh mục phòng, gói giá, dịch vụ, hóa đơn, thanh toán và báo cáo doanh thu.
- PostgreSQL/Flyway, chống trùng lịch ở application/database, Docker Compose, health check và OpenAPI.
- Giao diện responsive, điều hướng theo quyền, modal có accessibility, loading/error/empty state và animation có hỗ trợ `prefers-reduced-motion`.

## Cải tiến hoàn thành trong đợt rà soát này

- Luồng đổi mật khẩu hiển thị rõ điều kiện 12–72 ký tự, xác nhận trùng khớp, mật khẩu mới khác mật khẩu cũ, lỗi API tiếng Việt và trạng thái đang xử lý.
- Thêm hiện/ẩn mật khẩu, hỗ trợ submit bằng bàn phím và test tự động cho form đổi mật khẩu.
- Modal được render bằng portal, phủ toàn viewport, khóa cuộn nền, đóng bằng Escape và giữ focus trong hộp thoại.
- Animation chuyển trang, modal, menu hồ sơ, sidebar, loading, card, login hero và phản hồi nhấn nút.
- Sơ đồ phòng cho phép mở trực tiếp form đặt phòng hoặc hồ sơ lưu trú tương ứng.
- Hồ sơ lưu trú cho phép nhận/trả phòng, thêm dịch vụ, hủy và mở thu ngân ngay trong modal.
- Form đặt phòng hỗ trợ nhiều phòng, nhiều khách và chỉ cho chọn phòng trống trong toàn bộ khoảng lưu trú.
- Thu ngân chọn theo mã đặt phòng, có lịch sử giao dịch, hoàn tất giao dịch chờ, hoàn tiền, xem và in hóa đơn.
- Tìm kiếm đặt phòng chạy ở phía server theo mã đặt phòng hoặc tên khách, kết hợp được với bộ lọc trạng thái và phân trang.
- Các thao tác xóa/hủy quan trọng dùng dialog xác nhận thống nhất; tài khoản đang đăng nhập không thể tự xóa.
- Route được bảo vệ theo quyền ở cả điều hướng và nội dung trang.
- Bổ sung cấu hình ESLint 9 để `npm run lint` hoạt động thực sự.
- Landing Page có slider ba ảnh đồng bộ theo ba giai đoạn trải nghiệm và nút quay lại đầu trang có hỗ trợ giảm chuyển động.
- Hóa đơn có thể tải trực tiếp dưới dạng PDF Unicode từ backend, giữ đúng quyền `payment:read` và không phụ thuộc hộp thoại in của trình duyệt.
- VNPay Sandbox hỗ trợ thanh toán cọc phía khách hàng và thanh toán tại thu ngân; backend ký HMAC-SHA512, kiểm tra số tiền/mã tham chiếu, xử lý IPN idempotent và đối soát bằng `querydr` khi callback chưa tới.
- Danh mục phòng hỗ trợ sửa/xóa tầng, hạng phòng, phòng và gói giá; dữ liệu bị xóa được ẩn bằng `deleted_at` và thao tác nguy hiểm bị chặn khi còn booking hoạt động.
- Danh mục dịch vụ hiển thị cả trạng thái tạm ngưng và cho phép bật lại trực tiếp, trong khi màn hình vận hành chỉ nhận các dịch vụ đang bán.
- Tiện nghi được quản lý và gán theo hạng phòng; chương trình ưu đãi có thời hạn, điều kiện đơn tối thiểu, mức giảm tối đa, giới hạn lượt dùng và được chọn trực tiếp khi tạo booking.
- Quản trị viên có thể sửa tài khoản nhân viên, khóa/mở khóa, xem tối đa 20 token family gần nhất và thu hồi riêng từng thiết bị hoặc toàn bộ phiên.
- Nhật ký kiểm toán tự ghi các request thay đổi thành công với actor, đối tượng, hành động, IP và request ID; không ghi request body, mật khẩu hoặc token.
- Dashboard có so sánh doanh thu kỳ trước, top phòng, nguồn booking và danh sách khách đến/đi hôm nay mở trực tiếp được hồ sơ lưu trú.
- Báo cáo bao gồm doanh thu, công suất phòng, dịch vụ và công nợ; mỗi báo cáo tải được CSV tương thích Excel và PDF Unicode từ backend.

## Khoảng trống cần hoàn thiện tiếp

### Ưu tiên P0 — vận hành cốt lõi

- Chưa còn khoảng trống P0 đã biết trong phạm vi rà soát hiện tại.

### Ưu tiên P1 — quản trị thương mại

- Chưa còn khoảng trống P1 đã biết trong phạm vi khách sạn vừa và nhỏ hiện tại.

### Ưu tiên P2 — độ tin cậy và trải nghiệm

- Realtime room matrix bằng SSE/WebSocket thay cho polling một phút.
- Error boundary, trang 404/403 chuyên biệt, offline indicator và retry thống nhất.
- Skeleton theo từng màn hình, optimistic update ở các thao tác phù hợp.
- Kiểm thử controller/security, E2E trình duyệt và kiểm tra responsive tự động.
- Phân tách các page đang viết quá cô đọng thành feature component/form schema để dễ bảo trì.

## Tiêu chí hoàn tất

Một hạng mục chỉ được đánh dấu hoàn tất khi có đủ API/UI, validation, quyền truy cập, phản hồi loading/error/success, test phù hợp và chạy được trong Docker Compose.
