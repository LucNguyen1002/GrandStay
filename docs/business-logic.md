# GrandStay HMS — Business Logic (Bước 4)

## Kiến trúc xử lý

Application service là transaction boundary và điều phối aggregate/repository. Domain service giữ thuật toán thuần như pricing, transition policy và phụ phí. PostgreSQL exclusion constraint là hàng rào cuối cùng khi hai transaction cùng vượt qua application pre-check.

```text
BookingApplicationService
  -> validate room/capacity/rate/promotion
  -> application overlap query
  -> snapshot price + tstzrange
  -> confirm booking
  -> database trigger + GiST exclusion constraint

BookingLifecycleService
  -> check-in -> actual timestamps + CHECKED_IN
  -> service usage snapshots
  -> check-out -> actual timestamps + CHECKED_OUT
  -> BillingApplicationService -> immutable invoice snapshot
  -> PaymentApplicationService -> multiple payments/refunds
```

## Quy tắc đã triển khai

### Booking và pricing

- Một booking bắt buộc có ít nhất một phòng và đúng một primary guest.
- Tổng người ở booking phải khớp tổng phân bổ theo phòng và không vượt sức chứa room type.
- Phòng `MAINTENANCE`, `OUT_OF_SERVICE` hoặc soft-deleted không thể được đặt; check-in yêu cầu `AVAILABLE`.
- Rate plan phải active, đúng room type/currency/thời gian hiệu lực và thỏa minimum stay.
- `HOURLY`/`DAILY` làm tròn lên theo đơn vị bắt đầu; `NIGHTLY` tính theo ngày lịch `Asia/Ho_Chi_Minh`, tối thiểu một đêm.
- Giá/đơn vị/số lượng/tax được snapshot trong `booking_rooms`.
- Booking tạo ở `PENDING`; tùy command có thể confirm trong cùng transaction.
- Trạng thái hợp lệ: `PENDING -> CONFIRMED/CANCELLED`, `CONFIRMED -> CHECKED_IN/CANCELLED/NO_SHOW`, `CHECKED_IN -> CHECKED_OUT`.
- Promotion được khóa pessimistic khi sử dụng; kiểm tra hiệu lực, minimum amount, usage limit và tăng counter trong cùng transaction.

### Chống overlap

- Application query kiểm tra `stay_period && requested_period` cho `CONFIRMED`/`CHECKED_IN` để trả lỗi thân thiện.
- Khi confirm, trigger đồng bộ trạng thái xuống `booking_rooms`.
- Exclusion constraint `booking_rooms_no_overlap` đảm bảo hai request đồng thời không thể giữ cùng phòng cho khoảng giao nhau.
- Khoảng là nửa mở `[check-in, check-out)`, nên booking kế tiếp bắt đầu đúng lúc booking trước checkout được phép.

### Check-in, check-out và dịch vụ

- Check-in khóa booking, kiểm tra transition và trạng thái vận hành của mọi phòng, rồi snapshot actual check-in.
- Chỉ booking `CHECKED_IN` được thêm dịch vụ. Tên, unit price, unit và tax rate của dịch vụ được snapshot.
- Check-out yêu cầu thời điểm sau actual check-in, cập nhật toàn bộ room allocations và lập invoice trong cùng transaction; lỗi billing rollback cả checkout.
- Grace mặc định: early check-in 60 phút, late checkout 30 phút. Phí 10% room charge mỗi giờ bắt đầu, tối đa 50% cho mỗi loại; tất cả cấu hình được qua biến môi trường.

### Billing

- `grand total = room charge + service charge + extra fee - discount + tax`.
- Discount được phân bổ tỷ lệ lên từng invoice item trước khi tính thuế; dòng cuối hấp thụ sai số làm tròn.
- Invoice và item snapshot toàn bộ giá trị, không đọc giá động sau khi phát hành.
- Deposit không bị trừ trực tiếp khỏi invoice; balance tính riêng từ payment ledger.
- Booking tự phục vụ dùng mức cọc cấu hình (mặc định 30%) trên tổng tiền phòng dự kiến sau ưu đãi và thuế. Backend khóa mức tiền, tính phần còn thiếu và ngăn nhiều khoản cọc `PENDING` hoặc vượt mức yêu cầu.

### Payment và refund

- Hỗ trợ deposit/settlement, nhiều payment và bốn payment methods.
- Settlement không được vượt outstanding balance và yêu cầu invoice đã phát hành.
- Refund tham chiếu payment gốc, khóa payment/booking và không được vượt phần còn refundable.
- Payment gốc chuyển `PARTIALLY_REFUNDED` hoặc `REFUNDED`; net paid vẫn tính đúng từ payment ledger.
- Invoice chuyển `PAID` khi aggregate outstanding bằng 0 và quay lại `ISSUED` sau refund tạo số dư.

### Exception và transaction

- Business error có stable `ErrorCode`, HTTP status và RFC 7807 `ProblemDetail`.
- Exclusion/data constraint, optimistic locking và validation được ánh xạ thành lỗi an toàn, không trả SQL hoặc stack trace.
- Mọi use case thay đổi dữ liệu có `@Transactional`; các state transition dùng pessimistic lock kết hợp `@Version`.

## File chính

- `booking/application/BookingApplicationService.java`
- `booking/application/BookingLifecycleService.java`
- `booking/domain/PricingService.java`
- `booking/domain/EarlyLateFeePolicy.java`
- `service/application/ServiceUsageApplicationService.java`
- `billing/application/BillingApplicationService.java`
- `payment/application/PaymentApplicationService.java`
- `shared/exception/GlobalExceptionHandler.java`
- `shared/infrastructure/persistence/PostgresTstzRangeType.java`

## Kiểm thử

```powershell
Set-Location grandstay-backend
.\mvnw.cmd clean verify
```

Testcontainers integration test chạy PostgreSQL 17 thật và kiểm tra:

- overlap bị từ chối, adjacent stay được chấp nhận;
- `tstzrange` bind/read qua JDBC;
- booking -> check-in -> add service -> checkout -> invoice;
- settlement payment -> paid balance -> partial refund;
- Flyway migration và Hibernate schema validation.
