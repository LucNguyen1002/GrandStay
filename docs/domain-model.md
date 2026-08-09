# GrandStay HMS — Domain Model và Persistence (Bước 3)

## Quyết định thiết kế

- Mỗi bảng trong migration V1 có một entity JPA tương ứng; tổng cộng 23 entity/table mappings và 23 Spring Data repositories.
- Aggregate dùng UUID và optimistic locking từ `BaseEntity`; audit timestamp dùng Spring Data JPA Auditing và `Clock` UTC.
- Các module chỉ giữ UUID tham chiếu tới aggregate của module khác, không tạo object graph JPA xuyên bounded context. Điều này tránh lazy-loading ẩn, vòng lặp serialization và coupling giữa module.
- Enum được lưu dạng chuỗi để dữ liệu có thể đọc trực tiếp và không bị hỏng khi thay đổi thứ tự enum.
- Tiền dùng `BigDecimal`; thời điểm dùng `Instant`; ngày thuần túy dùng `LocalDate`.
- PostgreSQL `tstzrange` được ánh xạ bằng Hibernate `UserType` bind trực tiếp `Types.OTHER`. Exclusion constraint trong database vẫn là hàng rào cuối cùng chống race condition.
- DTO là Java record immutable và không chứa password hash, identity ciphertext/hash, token hash hoặc payment provider detail nhạy cảm.
- MapStruct bật `ReportingPolicy.ERROR`; thay đổi entity mà quên cập nhật DTO sẽ làm build thất bại.
- Repository chứa range/overlap query tại module booking và query revoke token family tại module auth. Không cung cấp hard-delete use case cho booking, payment hoặc invoice.

## Nhóm file

| Module | Entity chính | Repository |
|---|---|---|
| `auth` | `RefreshToken` | `RefreshTokenRepository` |
| `user` | `User`, `Role`, `Permission`, `UserRole`, `RolePermission` | 5 repositories |
| `customer` | `Customer` | `CustomerRepository` |
| `room` | `Floor`, `RoomType`, `Amenity`, `RoomTypeAmenity`, `Room`, `RatePlan` | 6 repositories |
| `booking` | `Promotion`, `Booking`, `BookingRoom`, `BookingGuest` | 4 repositories |
| `service` | `HotelService`, `BookingService` | 2 repositories |
| `payment` | `Payment` | `PaymentRepository` |
| `billing` | `Invoice`, `InvoiceItem` | 2 repositories |
| `audit` | `AuditLog` | `AuditLogRepository` |

DTO tập trung tại `shared/dto/EntityDtos.java`; mapper tập trung tại `shared/infrastructure/mapping/EntityMapper.java`. Các DTO/request chuyên biệt theo use case sẽ được bổ sung cùng business logic và REST API để không biến persistence model thành API contract.

## Xác minh

```powershell
Set-Location grandstay-backend
.\mvnw.cmd clean verify
```

Ngoài compile/test, full application đã được chạy trên PostgreSQL 17 sạch với `spring.jpa.hibernate.ddl-auto=validate`: Flyway V1 thành công, Hibernate khởi tạo `EntityManagerFactory`, 23 repositories được đăng ký và health probe trả về `UP`.
