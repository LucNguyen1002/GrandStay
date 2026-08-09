# GrandStay HMS — Kiến trúc Backend (Bước 2)

## 1. Kiến trúc được chọn

GrandStay là **modular monolith**: một ứng dụng Spring Boot, một database và một artifact triển khai. Biên module được tổ chức theo nghiệp vụ thay vì theo loại kỹ thuật toàn hệ thống. Cách này giữ transaction đặt phòng/thanh toán đơn giản, nhưng vẫn cho phép tách module sau này nếu quy mô thực sự yêu cầu.

Mỗi module sử dụng bốn lớp có chiều phụ thuộc hướng vào domain:

```text
api -> application -> domain
                     ^
infrastructure ------|
```

- `api`: REST controller, request/response model và OpenAPI annotations.
- `application`: use case, transaction boundary, port và orchestration.
- `domain`: entity/aggregate, value object, domain service, rule và event thuần nghiệp vụ.
- `infrastructure`: JPA adapter, external adapter và cấu hình kỹ thuật.
- `shared`: chỉ chứa primitive/cross-cutting thật sự dùng chung; không trở thành nơi chứa nghiệp vụ tùy tiện.

Không cho module truy cập repository nội bộ của module khác. Giao tiếp đồng bộ đi qua application port; side effect không bắt buộc đồng bộ sử dụng domain event trong cùng process.

## 2. Cấu trúc package

```text
com.grandstay
├── auth/{api,application,domain,infrastructure}
├── user/{api,application,domain,infrastructure}
├── customer/{api,application,domain,infrastructure}
├── room/{api,application,domain,infrastructure}
├── booking/{api,application,domain,infrastructure}
├── service/{api,application,domain,infrastructure}
├── payment/{api,application,domain,infrastructure}
├── billing/{api,application,domain,infrastructure}
├── report/{api,application,domain,infrastructure}
├── dashboard/{api,application,domain,infrastructure}
├── audit/{api,application,domain,infrastructure}
└── shared/{api,application,domain,infrastructure}
```

`promotion` và `rate plan` thuộc bounded context `booking`/`room`; `guest` thuộc `booking`. Chúng chưa cần module độc lập.

## 3. Nền tảng và dependency

- Java 17, Spring Boot 3.5.16.
- Web MVC, Validation, Spring Data JPA, Spring Security, Actuator.
- PostgreSQL JDBC, Flyway core và module PostgreSQL riêng.
- MapStruct 1.6.3 với annotation processor; Lombok chỉ giảm boilerplate.
- springdoc OpenAPI; Micrometer Prometheus.
- JUnit 5, Spring Security Test và Testcontainers PostgreSQL.

Phiên bản do Spring Boot BOM quản lý không được ghi đè nếu không có lý do tương thích cụ thể.

## 4. Cấu hình môi trường

| Profile | Mục đích | Secret/config |
|---|---|---|
| `local` | Chạy máy cá nhân | Có default chỉ dùng local. |
| `dev` | Môi trường tích hợp | Bắt buộc `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`. |
| `test` | Test tự động | Testcontainers sẽ cấp datasource động ở Bước 8. |
| `prod` | Production | Không có default database secret; OpenAPI mặc định tắt. |

Database/Jackson/Hibernate dùng UTC. HikariCP có giới hạn pool. `ddl-auto=validate`, Flyway là cơ chế duy nhất thay đổi schema. `clean` bị vô hiệu hóa.

## 5. Security baseline

Security starter được bật ngay từ đầu. Chỉ health probe và tài liệu OpenAPI được public; mọi API khác bị `denyAll` cho tới khi JWT/RBAC ở Bước 5 cung cấp filter và authorization policy. Session luôn stateless.

## 6. Docker

Dockerfile dùng multi-stage build, JRE 17 nhỏ gọn, user không phải root, giới hạn heap theo container và graceful shutdown. Compose khởi động PostgreSQL trước, chờ database healthy rồi mới chạy backend. Flyway migration chạy khi application startup.

## 7. Lệnh chạy

```powershell
docker compose up --build -d
docker compose ps
Invoke-RestMethod http://localhost:8080/actuator/health
```

Các biến bí mật và cấu hình theo môi trường được đặt trong file `.env` ở thư mục gốc; file này không được commit vào Git.

Build bằng Maven Wrapper:

```powershell
Set-Location grandstay-backend
.\mvnw.cmd clean verify
.\mvnw.cmd spring-boot:run
```

Khi chạy trực tiếp, PostgreSQL phải sẵn sàng tại cấu hình profile tương ứng.
