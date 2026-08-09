package com.grandstay.dashboard.application;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DashboardApplicationService {
    private final NamedParameterJdbcTemplate jdbc;
    private final Clock clock;
    public DashboardApplicationService(NamedParameterJdbcTemplate jdbc, Clock clock) { this.jdbc=jdbc;this.clock=clock; }

    @Transactional(readOnly=true)
    public DashboardView dashboard(Instant from, Instant to) {
        Instant end=to==null?clock.instant():to; Instant start=from==null?end.minus(30,ChronoUnit.DAYS):from;
        if(!end.isAfter(start)) throw com.grandstay.shared.exception.BusinessException.invalid("Report end must be after start");
        Instant previousStart=start.minusMillis(end.toEpochMilli()-start.toEpochMilli());
        Instant operationalAt=clock.instant();
        Map<String,Object> params=Map.of("from",Timestamp.from(start),"to",Timestamp.from(end),"at",Timestamp.from(operationalAt),"previousFrom",Timestamp.from(previousStart));
        BigDecimal revenue=jdbc.queryForObject("select coalesce(sum(grand_total),0) from invoices where status in ('ISSUED','PAID') and issued_at>=:from and issued_at<:to",params,BigDecimal.class);
        BigDecimal previousRevenue=jdbc.queryForObject("select coalesce(sum(grand_total),0) from invoices where status in ('ISSUED','PAID') and issued_at>=:previousFrom and issued_at<:from",params,BigDecimal.class);
        BigDecimal revenueChange=percentageChange(revenue,previousRevenue);
        Integer total=jdbc.queryForObject("select count(*) from rooms where deleted_at is null and operational_status<>'OUT_OF_SERVICE'",params,Integer.class);
        Integer occupied=jdbc.queryForObject("select count(distinct room_id) from booking_rooms where allocation_status='CHECKED_IN'",params,Integer.class);
        BigDecimal occupancy=total==null||total==0?BigDecimal.ZERO:new BigDecimal(occupied).multiply(BigDecimal.valueOf(100)).divide(BigDecimal.valueOf(total),2,java.math.RoundingMode.HALF_UP);
        List<RevenuePoint> series=jdbc.query("select date_trunc('day',timezone('Asia/Ho_Chi_Minh',issued_at)) as revenue_day,coalesce(sum(grand_total),0) revenue from invoices where status in ('ISSUED','PAID') and issued_at>=:from and issued_at<:to group by 1 order by 1",params,(rs,n)->new RevenuePoint(rs.getTimestamp("revenue_day").toLocalDateTime().toLocalDate(),rs.getBigDecimal("revenue")));
        List<TopService> services=jdbc.query("select service_name,sum(quantity) quantity,sum(unit_price*quantity) revenue from booking_services where service_at>=:from and service_at<:to group by service_name order by revenue desc limit 10",params,(rs,n)->new TopService(rs.getString("service_name"),rs.getBigDecimal("quantity"),rs.getBigDecimal("revenue")));
        List<TopRoom> topRooms=jdbc.query("""
                select r.id room_id,r.room_number,count(distinct br.booking_id) booking_count,
                       coalesce(sum(br.room_charge),0) revenue
                from booking_rooms br join rooms r on r.id=br.room_id
                where br.stay_period && tstzrange(cast(:from as timestamptz),cast(:to as timestamptz),'[)')
                  and br.allocation_status in ('CONFIRMED','CHECKED_IN','CHECKED_OUT')
                group by r.id,r.room_number order by revenue desc,booking_count desc limit 6
                """,params,(rs,n)->new TopRoom(rs.getObject("room_id",UUID.class),rs.getString("room_number"),rs.getLong("booking_count"),rs.getBigDecimal("revenue")));
        List<BookingSourcePoint> sources=jdbc.query("""
                select booking_source,count(*) booking_count from bookings
                where created_at>=:from and created_at<:to and status<>'CANCELLED'
                group by booking_source order by booking_count desc
                """,params,(rs,n)->new BookingSourcePoint(rs.getString("booking_source"),rs.getLong("booking_count")));
        List<StayMovement> arrivals=movements(params,true);
        List<StayMovement> departures=movements(params,false);
        return new DashboardView(start,end,revenue,previousRevenue,revenueChange,occupancy,total==null?0:total,
                occupied==null?0:occupied,series,services,topRooms,sources,arrivals,departures);
    }

    private List<StayMovement> movements(Map<String,Object> params,boolean arrivals) {
        String expectedColumn=arrivals?"expected_check_in_at":"expected_check_out_at";
        String statuses=arrivals?"('CONFIRMED')":"('CHECKED_IN')";
        String sql="""
                select b.id booking_id,b.booking_number,coalesce(bg.full_name,c.full_name,'Khách vãng lai') guest_name,
                       b.%s expected_at
                from bookings b left join customers c on c.id=b.customer_id
                left join booking_guests bg on bg.booking_id=b.id and bg.is_primary
                where b.status in %s
                  and timezone('Asia/Ho_Chi_Minh',b.%s)::date=timezone('Asia/Ho_Chi_Minh',cast(:at as timestamptz))::date
                order by b.%s limit 8
                """.formatted(expectedColumn,statuses,expectedColumn,expectedColumn);
        return jdbc.query(sql,params,(rs,n)->new StayMovement(rs.getObject("booking_id",UUID.class),
                rs.getString("booking_number"),rs.getString("guest_name"),rs.getTimestamp("expected_at").toInstant()));
    }

    private static BigDecimal percentageChange(BigDecimal current,BigDecimal previous) {
        if(previous==null||previous.signum()==0) return current!=null&&current.signum()>0?BigDecimal.valueOf(100):BigDecimal.ZERO;
        return current.subtract(previous).multiply(BigDecimal.valueOf(100))
                .divide(previous,2,java.math.RoundingMode.HALF_UP);
    }

    public record DashboardView(Instant from,Instant to,BigDecimal revenue,BigDecimal previousRevenue,
                                BigDecimal revenueChangePercent,BigDecimal occupancyRate,int totalRooms,
                                int occupiedRooms,List<RevenuePoint> revenueSeries,List<TopService> topServices,
                                List<TopRoom> topRooms,List<BookingSourcePoint> bookingSources,
                                List<StayMovement> arrivals,List<StayMovement> departures){}
    public record RevenuePoint(java.time.LocalDate date,BigDecimal revenue){}
    public record TopService(String name,BigDecimal quantity,BigDecimal revenue){}
    public record TopRoom(UUID roomId,String roomNumber,long bookingCount,BigDecimal revenue){}
    public record BookingSourcePoint(String source,long count){}
    public record StayMovement(UUID bookingId,String bookingNumber,String guestName,Instant expectedAt){}
}
