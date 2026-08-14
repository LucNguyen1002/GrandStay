package com.grandstay.booking.api;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.grandstay.billing.application.BillingResult;
import com.grandstay.booking.application.BookingApplicationService;
import com.grandstay.booking.application.BookingCommands.CreateBooking;
import com.grandstay.booking.application.BookingCommands.GuestInput;
import com.grandstay.booking.application.BookingCommands.RoomSelection;
import com.grandstay.booking.application.BookingLifecycleService;
import com.grandstay.booking.application.BookingQueryService;
import com.grandstay.booking.application.BookingResult;
import com.grandstay.service.application.ServiceUsageApplicationService;
import com.grandstay.shared.domain.ModelEnums.BookingSource;
import com.grandstay.shared.domain.ModelEnums.BookingStatus;
import com.grandstay.shared.dto.EntityDtos.BookingDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/bookings")
@Tag(name = "Bookings")
public class BookingController {
    private final BookingApplicationService bookingService;
    private final BookingLifecycleService lifecycleService;
    private final BookingQueryService queryService;
    private final ServiceUsageApplicationService usageService;

    public BookingController(BookingApplicationService bookingService,
                             BookingLifecycleService lifecycleService,
                             BookingQueryService queryService,
                             ServiceUsageApplicationService usageService) {
        this.bookingService = bookingService;
        this.lifecycleService = lifecycleService;
        this.queryService = queryService;
        this.usageService = usageService;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('booking:read')")
    public Page<BookingDto> list(@RequestParam(required = false) BookingStatus status,
                                 @RequestParam(required = false) @Size(max = 150) String search,
                                 @ParameterObject @PageableDefault(size = 20, sort = "createdAt") Pageable pageable) {
        return queryService.list(status, search, pageable);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('booking:read')")
    public BookingQueryService.BookingView get(@PathVariable UUID id) { return queryService.get(id); }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('booking:write')")
    @Operation(summary = "Create a multi-room reservation or confirmed booking")
    public BookingResult create(@Valid @RequestBody CreateBookingRequest request) {
        return bookingService.create(new CreateBooking(request.customerId(), request.promotionId(), request.source(),
                request.expectedCheckInAt(), request.expectedCheckOutAt(), request.adults(), request.children(),
                request.specialRequests(), request.currency(), request.confirmImmediately(),
                request.rooms().stream().map(r -> new RoomSelection(r.roomId(), r.ratePlanId(), r.adults(), r.children())).toList(),
                request.guests().stream().map(g -> new GuestInput(g.customerId(), g.fullName(), g.primary(),
                        g.nationality(), g.dateOfBirth())).toList()));
    }

    @PostMapping("/{id}/confirm")
    @PreAuthorize("hasAuthority('booking:write')")
    public BookingResult confirm(@PathVariable UUID id) { return bookingService.confirm(id); }

    @PostMapping("/{id}/cancel")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('booking:write')")
    public void cancel(@PathVariable UUID id, @Valid @RequestBody ReasonRequest request) {
        bookingService.cancel(id, request.reason());
    }

    @PostMapping("/{id}/no-show")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('booking:write')")
    public void noShow(@PathVariable UUID id) { bookingService.markNoShow(id); }

    @PostMapping("/{id}/guests")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('booking:write')")
    public void addGuest(@PathVariable UUID id, @Valid @RequestBody GuestRequest request) {
        bookingService.addGuest(id, new GuestInput(request.customerId(), request.fullName(), false,
                request.nationality(), request.dateOfBirth()));
    }

    @PutMapping("/{id}/customer")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('booking:write')")
    public void assignCustomer(@PathVariable UUID id, @Valid @RequestBody AssignCustomerRequest request) {
        bookingService.assignCustomer(id, request.customerId());
    }

    @PostMapping("/{id}/check-in")
    @PreAuthorize("hasAuthority('booking:checkin')")
    public BookingLifecycleService.CheckInResult checkIn(@PathVariable UUID id,
                                                          @RequestBody(required = false) ActualTimeRequest request) {
        return lifecycleService.checkIn(id, request == null ? null : request.actualAt());
    }

    @PostMapping("/{id}/check-out")
    @PreAuthorize("hasAuthority('booking:checkout')")
    public BookingLifecycleService.CheckOutResult checkOut(@PathVariable UUID id,
                                                            @RequestBody(required = false) ActualTimeRequest request) {
        return lifecycleService.checkOut(id, request == null ? null : request.actualAt());
    }

    @PostMapping("/{id}/services")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('service:write')")
    public ServiceUsageApplicationService.UsageResult addService(@PathVariable UUID id,
                                                                  @Valid @RequestBody AddServiceRequest request) {
        return usageService.add(id, request.bookingRoomId(), request.serviceId(), request.quantity(), request.notes());
    }

    public record CreateBookingRequest(UUID customerId, UUID promotionId, @NotNull BookingSource source,
            @NotNull Instant expectedCheckInAt, @NotNull Instant expectedCheckOutAt,
            @Min(1) int adults, @Min(0) int children, @Size(max=2000) String specialRequests,
            @NotBlank @Pattern(regexp="[A-Za-z]{3}") String currency, boolean confirmImmediately,
            @NotEmpty List<@Valid RoomRequest> rooms, @NotEmpty List<@Valid GuestRequest> guests) {}
    public record RoomRequest(@NotNull UUID roomId, @NotNull UUID ratePlanId,
                              @Min(1) int adults, @Min(0) int children) {}
    public record GuestRequest(UUID customerId, @NotBlank @Size(max=150) String fullName,
                               boolean primary, @Pattern(regexp="[A-Za-z]{2}") String nationality,
                               LocalDate dateOfBirth) {}
    public record ReasonRequest(@NotBlank @Size(max=1000) String reason) {}
    public record ActualTimeRequest(Instant actualAt) {}
    public record AssignCustomerRequest(@NotNull UUID customerId) {}
    public record AddServiceRequest(UUID bookingRoomId, @NotNull UUID serviceId,
                                    @NotNull @DecimalMin(value="0.01") java.math.BigDecimal quantity,
                                    @Size(max=500) String notes) {}
}
