package com.grandstay.booking.api;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.grandstay.booking.application.BookingCommands.GuestInput;
import com.grandstay.booking.application.BookingCommands.RoomSelection;
import com.grandstay.booking.application.BookingQueryService;
import com.grandstay.booking.application.BookingResult;
import com.grandstay.booking.application.SelfBookingApplicationService;
import com.grandstay.booking.application.SelfBookingApplicationService.CreateSelfBooking;
import com.grandstay.shared.domain.ModelEnums.BookingStatus;
import com.grandstay.shared.dto.EntityDtos.BookingDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
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
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/self/bookings")
@PreAuthorize("hasRole('CUSTOMER')")
@Tag(name = "Customer self-service bookings")
public class SelfBookingController {
    private final SelfBookingApplicationService service;

    public SelfBookingController(SelfBookingApplicationService service) { this.service = service; }

    @GetMapping
    @Operation(summary = "List only bookings owned by the authenticated customer")
    public Page<BookingDto> list(@AuthenticationPrincipal Jwt jwt,
                                 @RequestParam(required = false) BookingStatus status,
                                 @RequestParam(required = false) @Size(max = 150) String search,
                                 @ParameterObject @PageableDefault(size = 20, sort = "createdAt") Pageable pageable) {
        return service.list(userId(jwt), status, search, pageable);
    }

    @GetMapping("/{id}")
    public BookingQueryService.BookingView get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return service.get(userId(jwt), id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Book available rooms for the authenticated customer")
    public BookingResult create(@AuthenticationPrincipal Jwt jwt,
                                @Valid @RequestBody CreateSelfBookingRequest request) {
        return service.create(userId(jwt), new CreateSelfBooking(request.promotionId(),
                request.expectedCheckInAt(), request.expectedCheckOutAt(), request.adults(), request.children(),
                request.specialRequests(), request.rooms().stream()
                        .map(room -> new RoomSelection(room.roomId(), room.ratePlanId(),
                                room.adults(), room.children())).toList(),
                request.guests().stream().map(guest -> new GuestInput(null, guest.fullName(), false,
                        guest.nationality(), guest.dateOfBirth())).toList()));
    }

    @PostMapping("/{id}/cancel")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancel(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                       @Valid @RequestBody ReasonRequest request) {
        service.cancel(userId(jwt), id, request.reason());
    }

    private UUID userId(Jwt jwt) { return UUID.fromString(jwt.getSubject()); }

    public record CreateSelfBookingRequest(UUID promotionId,
            @NotNull Instant expectedCheckInAt, @NotNull Instant expectedCheckOutAt,
            @Min(1) int adults, @Min(0) int children, @Size(max = 2000) String specialRequests,
            @NotEmpty List<@Valid RoomRequest> rooms,
            @NotNull List<@Valid GuestRequest> guests) {}
    public record RoomRequest(@NotNull UUID roomId, @NotNull UUID ratePlanId,
                              @Min(1) int adults, @Min(0) int children) {}
    public record GuestRequest(@NotBlank @Size(max = 150) String fullName,
                               @Pattern(regexp = "[A-Za-z]{2}") String nationality,
                               LocalDate dateOfBirth) {}
    public record ReasonRequest(@NotBlank @Size(max = 1000) String reason) {}
}
