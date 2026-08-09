package com.grandstay.booking.application;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.grandstay.booking.application.BookingCommands.CreateBooking;
import com.grandstay.booking.application.BookingCommands.GuestInput;
import com.grandstay.booking.application.BookingCommands.RoomSelection;
import com.grandstay.customer.domain.Customer;
import com.grandstay.customer.infrastructure.CustomerRepository;
import com.grandstay.dashboard.application.DashboardApplicationService;
import com.grandstay.room.domain.Floor;
import com.grandstay.room.domain.RatePlan;
import com.grandstay.room.domain.Room;
import com.grandstay.room.domain.RoomType;
import com.grandstay.room.application.RoomCatalogApplicationService;
import com.grandstay.room.infrastructure.FloorRepository;
import com.grandstay.room.infrastructure.RatePlanRepository;
import com.grandstay.room.infrastructure.RoomRepository;
import com.grandstay.room.infrastructure.RoomTypeRepository;
import com.grandstay.service.application.ServiceUsageApplicationService;
import com.grandstay.service.domain.HotelService;
import com.grandstay.service.infrastructure.HotelServiceRepository;
import com.grandstay.payment.application.PaymentApplicationService;
import com.grandstay.payment.application.PaymentCommands.RecordPayment;
import com.grandstay.payment.application.PaymentCommands.RefundPayment;
import com.grandstay.shared.domain.ModelEnums.BookingSource;
import com.grandstay.shared.domain.ModelEnums.BookingStatus;
import com.grandstay.shared.domain.ModelEnums.PricingUnit;
import com.grandstay.shared.domain.ModelEnums.RoomOperationalStatus;
import com.grandstay.shared.domain.ModelEnums.PaymentMethod;
import com.grandstay.shared.domain.ModelEnums.PaymentPurpose;
import com.grandstay.shared.exception.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
@Testcontainers(disabledWithoutDocker = true)
class BookingApplicationServiceIntegrationTest {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine");

    @Autowired BookingApplicationService bookingService;
    @Autowired BookingQueryService bookingQueryService;
    @Autowired FloorRepository floorRepository;
    @Autowired RoomTypeRepository roomTypeRepository;
    @Autowired RoomRepository roomRepository;
    @Autowired RatePlanRepository ratePlanRepository;
    @Autowired HotelServiceRepository hotelServiceRepository;
    @Autowired ServiceUsageApplicationService usageService;
    @Autowired BookingLifecycleService lifecycleService;
    @Autowired PaymentApplicationService paymentService;
    @Autowired RoomCatalogApplicationService roomCatalogService;
    @Autowired CustomerRepository customerRepository;
    @Autowired DashboardApplicationService dashboardService;

    private Room room;
    private RatePlan ratePlan;
    private HotelService hotelService;

    @BeforeEach
    void setUpCatalog() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Floor floor = new Floor();
        floor.setCode("IT-F-" + suffix); floor.setName("Integration floor");
        floor.setFloorNumber(1000 + Math.abs(suffix.hashCode() % 1000000));
        floor = floorRepository.save(floor);

        RoomType type = new RoomType();
        type.setCode("IT-RT-" + suffix); type.setName("Integration Deluxe");
        type.setCapacityAdults(2); type.setCapacityChildren(1);
        type.setBaseNightlyRate(new BigDecimal("1000000")); type.setCurrency("VND");
        type = roomTypeRepository.save(type);

        room = new Room(); room.setRoomNumber("IT-" + suffix); room.setFloorId(floor.getId());
        room.setRoomTypeId(type.getId()); room.setOperationalStatus(RoomOperationalStatus.AVAILABLE);
        room = roomRepository.save(room);

        ratePlan = new RatePlan(); ratePlan.setRoomTypeId(type.getId()); ratePlan.setCode("IT-RP-" + suffix);
        ratePlan.setName("Integration nightly"); ratePlan.setPricingUnit(PricingUnit.NIGHTLY);
        ratePlan.setRate(new BigDecimal("1000000")); ratePlan.setCurrency("VND");
        ratePlan.setMinStayUnits(1); ratePlan.setRefundable(true); ratePlan.setActive(true);
        ratePlan = ratePlanRepository.save(ratePlan);

        hotelService = new HotelService(); hotelService.setCode("IT-SVC-" + suffix);
        hotelService.setName("Integration breakfast"); hotelService.setCategory("FOOD");
        hotelService.setUnit("PERSON"); hotelService.setUnitPrice(new BigDecimal("200000"));
        hotelService.setTaxRate(new BigDecimal("10")); hotelService.setCurrency("VND"); hotelService.setActive(true);
        hotelService = hotelServiceRepository.save(hotelService);
    }

    @Test
    void marksEarlyCheckInAsOccupiedImmediately() {
        Instant actualCheckIn = Instant.now().minusSeconds(1);
        Instant expectedCheckIn = actualCheckIn.plusSeconds(2 * 3600);
        Instant expectedCheckOut = expectedCheckIn.plusSeconds(24 * 3600);
        var booking = bookingService.create(command(expectedCheckIn, expectedCheckOut));

        assertThat(roomCatalogService.matrix(actualCheckIn).stream()
                .filter(row -> row.getRoomId().equals(room.getId()))
                .findFirst().orElseThrow().getDisplayStatus()).isEqualTo("AVAILABLE");

        lifecycleService.checkIn(booking.id(), actualCheckIn);

        var occupiedRoom = roomCatalogService.matrix(actualCheckIn).stream()
                .filter(row -> row.getRoomId().equals(room.getId()))
                .findFirst().orElseThrow();
        assertThat(occupiedRoom.getDisplayStatus()).isEqualTo("OCCUPIED");
        assertThat(occupiedRoom.getBookingId()).isEqualTo(booking.id());
        assertThat(dashboardService.dashboard(null, null).occupiedRooms()).isPositive();
    }

    @Test
    void preventsOverlapButAllowsAdjacentStay() {
        assertThat(roomCatalogService.availableRooms(Instant.parse("2030-01-01T07:00:00Z"),
                Instant.parse("2030-01-03T07:00:00Z"))).extracting(dto -> dto.id()).contains(room.getId());

        var first = bookingService.create(command(Instant.parse("2030-01-01T07:00:00Z"),
                Instant.parse("2030-01-03T07:00:00Z")));
        assertThat(first.status()).isEqualTo(BookingStatus.CONFIRMED);
        assertThat(first.roomTotal()).isEqualByComparingTo("2000000.00");
        assertThat(roomCatalogService.availableRooms(Instant.parse("2030-01-02T07:00:00Z"),
                Instant.parse("2030-01-04T07:00:00Z"))).extracting(dto -> dto.id()).doesNotContain(room.getId());
        assertThat(roomCatalogService.availableRooms(Instant.parse("2030-01-03T07:00:00Z"),
                Instant.parse("2030-01-04T07:00:00Z"))).extracting(dto -> dto.id()).contains(room.getId());

        assertThatThrownBy(() -> bookingService.create(command(Instant.parse("2030-01-02T07:00:00Z"),
                Instant.parse("2030-01-04T07:00:00Z"))))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("not available");

        var adjacent = bookingService.create(command(Instant.parse("2030-01-03T07:00:00Z"),
                Instant.parse("2030-01-04T07:00:00Z")));
        assertThat(adjacent.status()).isEqualTo(BookingStatus.CONFIRMED);
    }

    @Test
    void completesStayBillingPaymentAndPartialRefund() {
        Instant checkOut = Instant.now().minusSeconds(5);
        Instant checkIn = checkOut.minusSeconds(24 * 3600);
        var booking = bookingService.create(command(checkIn, checkOut));

        lifecycleService.checkIn(booking.id(), checkIn);
        usageService.add(booking.id(), booking.rooms().get(0).id(), hotelService.getId(),
                new BigDecimal("2"), null);
        var checkedOut = lifecycleService.checkOut(booking.id(), checkOut);

        assertThat(checkedOut.invoice().roomCharge()).isEqualByComparingTo("1000000.00");
        assertThat(checkedOut.invoice().serviceCharge()).isEqualByComparingTo("400000.00");
        assertThat(checkedOut.invoice().taxAmount()).isEqualByComparingTo("40000.00");
        assertThat(checkedOut.invoice().grandTotal()).isEqualByComparingTo("1440000.00");

        var payment = paymentService.record(new RecordPayment(booking.id(), "PAY-" + booking.id(),
                PaymentPurpose.SETTLEMENT, PaymentMethod.CARD, new BigDecimal("1440000"),
                "VND", true, "provider-ref", null));
        assertThat(payment.balance().outstanding()).isEqualByComparingTo("0.00");

        var refund = paymentService.refund(new RefundPayment(payment.id(), "REF-" + booking.id(),
                new BigDecimal("100000"), "Guest adjustment"));
        assertThat(refund.balance().netPaid()).isEqualByComparingTo("1340000.00");
        assertThat(refund.balance().outstanding()).isEqualByComparingTo("100000.00");
        assertThat(paymentService.byBooking(booking.id())).hasSize(2)
                .extracting(view -> view.transactionCode())
                .containsExactly("REF-" + booking.id(), "PAY-" + booking.id());
    }

    @Test
    void preventsCustomerDepositsFromExceedingTheBackendLimit() {
        var booking = bookingService.create(command(Instant.parse("2031-01-01T07:00:00Z"),
                Instant.parse("2031-01-02T07:00:00Z")));
        paymentService.recordCustomerProvider(new RecordPayment(booking.id(), "PROVIDER-ONE-" + booking.id(),
                        PaymentPurpose.DEPOSIT, PaymentMethod.QR, new BigDecimal("300000"),
                        "VND", false, null, "Customer deposit"),
                "ONLINE_PROVIDER", "ORDER-ONE-" + booking.id(), "REQUEST-ONE-" + booking.id(),
                new BigDecimal("300000"));

        assertThatThrownBy(() -> paymentService.recordCustomerProvider(
                new RecordPayment(booking.id(), "PROVIDER-TWO-" + booking.id(), PaymentPurpose.DEPOSIT,
                        PaymentMethod.QR, BigDecimal.ONE, "VND", false, null, "Duplicate deposit"),
                "ONLINE_PROVIDER", "ORDER-TWO-" + booking.id(), "REQUEST-TWO-" + booking.id(),
                new BigDecimal("300000")))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("exceed the required amount");
    }

    @Test
    void searchesBookingsAcrossPagesByBookingNumberAndGuestName() {
        String uniqueGuest = "Search Guest " + UUID.randomUUID().toString().substring(0, 8);
        var booking = bookingService.create(command(Instant.parse("2032-04-10T07:00:00Z"),
                Instant.parse("2032-04-12T07:00:00Z"), uniqueGuest));

        assertThat(bookingQueryService.list(null, booking.bookingNumber().substring(3),
                PageRequest.of(0, 20)).getContent())
                .extracting(dto -> dto.id())
                .contains(booking.id());
        assertThat(bookingQueryService.list(BookingStatus.CONFIRMED, uniqueGuest.toLowerCase(),
                PageRequest.of(0, 20)).getContent())
                .extracting(dto -> dto.id())
                .contains(booking.id());
        assertThat(bookingQueryService.list(BookingStatus.CANCELLED, uniqueGuest,
                PageRequest.of(0, 20))).isEmpty();
    }

    @Test
    void listsOnlyBookingsOwnedByTheSelectedCustomerWithoutASearchTerm() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Customer owner = new Customer();
        owner.setCustomerCode("IT-CUS-" + suffix);
        owner.setFullName("Self-service owner " + suffix);
        owner.setEmail("owner-" + suffix + "@grandstay.test");
        owner = customerRepository.save(owner);

        CreateBooking base = command(Instant.parse("2033-05-10T07:00:00Z"),
                Instant.parse("2033-05-11T07:00:00Z"), owner.getFullName());
        var created = bookingService.create(new CreateBooking(owner.getId(), base.promotionId(), base.source(),
                base.expectedCheckInAt(), base.expectedCheckOutAt(), base.adults(), base.children(),
                base.specialRequests(), base.currency(), base.confirmImmediately(), base.rooms(), base.guests()));

        assertThat(bookingQueryService.listForCustomer(owner.getId(), null, null,
                PageRequest.of(0, 20)).getContent())
                .extracting(dto -> dto.id())
                .containsExactly(created.id());
        assertThat(bookingQueryService.listForCustomer(UUID.randomUUID(), null, null,
                PageRequest.of(0, 20))).isEmpty();
    }

    private CreateBooking command(Instant checkIn, Instant checkOut) {
        return command(checkIn, checkOut, "Integration Guest");
    }

    private CreateBooking command(Instant checkIn, Instant checkOut, String guestName) {
        return new CreateBooking(null, null, BookingSource.DIRECT, checkIn, checkOut,
                1, 0, null, "VND", true,
                List.of(new RoomSelection(room.getId(), ratePlan.getId(), 1, 0)),
                List.of(new GuestInput(null, guestName, true, "VN", null)));
    }
}
