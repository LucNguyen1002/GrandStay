package com.grandstay.report.application;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.grandstay.shared.exception.BusinessException;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RevenueReportService {
    private final NamedParameterJdbcTemplate jdbc;

    public RevenueReportService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public List<RevenueBucket> revenue(Instant from, Instant to, Granularity granularity) {
        Map<String, Object> params = period(from, to);
        String unit = switch (granularity) { case DAILY -> "day"; case MONTHLY -> "month"; case YEARLY -> "year"; };
        String sql = "select date_trunc('" + unit + "',timezone('Asia/Ho_Chi_Minh',issued_at)) bucket,"
                + "count(*) invoice_count,sum(grand_total) revenue from invoices "
                + "where status in ('ISSUED','PAID') and issued_at>=:from and issued_at<:to group by 1 order by 1";
        return jdbc.query(sql, params, (rs, n) -> new RevenueBucket(rs.getTimestamp("bucket").toLocalDateTime(),
                rs.getLong("invoice_count"), rs.getBigDecimal("revenue")));
    }

    @Transactional(readOnly = true)
    public List<OccupancyRow> occupancy(Instant from, Instant to) {
        Map<String, Object> params = period(from, to);
        String sql = """
                with room_counts as (
                  select rt.id,rt.name,count(r.id) room_count
                  from room_types rt left join rooms r on r.room_type_id=rt.id
                    and r.deleted_at is null and r.operational_status<>'OUT_OF_SERVICE'
                  where rt.deleted_at is null group by rt.id,rt.name
                ), occupied as (
                  select r.room_type_id,
                    coalesce(sum(extract(epoch from (least(upper(br.stay_period),cast(:to as timestamptz))-
                      greatest(lower(br.stay_period),cast(:from as timestamptz))))/3600),0) occupied_hours,
                    coalesce(sum(br.room_charge),0) revenue
                  from booking_rooms br join rooms r on r.id=br.room_id
                  where br.allocation_status in ('CONFIRMED','CHECKED_IN','CHECKED_OUT')
                    and br.stay_period && tstzrange(cast(:from as timestamptz),cast(:to as timestamptz),'[)')
                  group by r.room_type_id
                )
                select rc.id room_type_id,rc.name,rc.room_count,
                  coalesce(o.occupied_hours,0) occupied_hours,
                  rc.room_count*(extract(epoch from (cast(:to as timestamptz)-cast(:from as timestamptz)))/3600) available_hours,
                  coalesce(o.revenue,0) revenue
                from room_counts rc left join occupied o on o.room_type_id=rc.id
                order by rc.name
                """;
        return jdbc.query(sql, params, (rs, n) -> {
            BigDecimal occupied = rs.getBigDecimal("occupied_hours");
            BigDecimal available = rs.getBigDecimal("available_hours");
            BigDecimal rate = available.signum() == 0 ? BigDecimal.ZERO : occupied.multiply(BigDecimal.valueOf(100))
                    .divide(available, 2, RoundingMode.HALF_UP).min(BigDecimal.valueOf(100));
            return new OccupancyRow(rs.getObject("room_type_id", UUID.class), rs.getString("name"),
                    rs.getInt("room_count"), occupied.setScale(1, RoundingMode.HALF_UP),
                    available.setScale(1, RoundingMode.HALF_UP), rate, rs.getBigDecimal("revenue"));
        });
    }

    @Transactional(readOnly = true)
    public List<ServiceSalesRow> services(Instant from, Instant to) {
        Map<String, Object> params = period(from, to);
        return jdbc.query("""
                select service_id,service_name,unit,sum(quantity) quantity,
                       sum(unit_price*quantity) revenue,count(distinct booking_id) booking_count
                from booking_services where service_at>=:from and service_at<:to
                group by service_id,service_name,unit order by revenue desc
                """, params, (rs, n) -> new ServiceSalesRow(rs.getObject("service_id", UUID.class),
                rs.getString("service_name"), rs.getString("unit"), rs.getBigDecimal("quantity"),
                rs.getBigDecimal("revenue"), rs.getLong("booking_count")));
    }

    @Transactional(readOnly = true)
    public List<ReceivableRow> receivables(Instant from, Instant to) {
        Map<String, Object> params = period(from, to);
        return jdbc.query("""
                with paid as (
                  select booking_id,coalesce(sum(case when payment_type='REFUND' then -amount else amount end),0) amount
                  from payments where status in ('COMPLETED','PARTIALLY_REFUNDED','REFUNDED')
                    and coalesce(paid_at,created_at)<:to group by booking_id
                )
                select i.id invoice_id,i.invoice_number,i.booking_id,i.customer_name,i.issued_at,i.due_at,
                       i.grand_total,coalesce(p.amount,0) paid_amount,
                       greatest(i.grand_total-coalesce(p.amount,0),0) outstanding,
                       case when i.due_at is null or i.due_at>=:to then 0
                            else floor(extract(epoch from (cast(:to as timestamptz)-i.due_at))/86400)::int end overdue_days
                from invoices i left join paid p on p.booking_id=i.booking_id
                where i.status='ISSUED' and i.issued_at>=:from and i.issued_at<:to
                  and i.grand_total-coalesce(p.amount,0)>0
                order by i.due_at nulls last,i.issued_at
                """, params, (rs, n) -> new ReceivableRow(rs.getObject("invoice_id", UUID.class),
                rs.getString("invoice_number"), rs.getObject("booking_id", UUID.class),
                rs.getString("customer_name"), instant(rs.getTimestamp("issued_at")),
                instant(rs.getTimestamp("due_at")), rs.getBigDecimal("grand_total"),
                rs.getBigDecimal("paid_amount"), rs.getBigDecimal("outstanding"), rs.getInt("overdue_days")));
    }

    private static Map<String, Object> period(Instant from, Instant to) {
        if (from == null || to == null || !to.isAfter(from)) {
            throw BusinessException.invalid("Valid report period is required");
        }
        return Map.of("from", Timestamp.from(from), "to", Timestamp.from(to));
    }

    private static Instant instant(Timestamp value) { return value == null ? null : value.toInstant(); }

    public enum Granularity { DAILY, MONTHLY, YEARLY }
    public enum ReportType { REVENUE, OCCUPANCY, SERVICES, RECEIVABLES }
    public record RevenueBucket(LocalDateTime period, long invoiceCount, BigDecimal revenue) {}
    public record OccupancyRow(UUID roomTypeId, String roomTypeName, int roomCount,
                               BigDecimal occupiedHours, BigDecimal availableHours,
                               BigDecimal occupancyRate, BigDecimal roomRevenue) {}
    public record ServiceSalesRow(UUID serviceId, String serviceName, String unit,
                                  BigDecimal quantity, BigDecimal revenue, long bookingCount) {}
    public record ReceivableRow(UUID invoiceId, String invoiceNumber, UUID bookingId,
                                String customerName, Instant issuedAt, Instant dueAt,
                                BigDecimal grandTotal, BigDecimal paidAmount,
                                BigDecimal outstandingAmount, int overdueDays) {}
}
