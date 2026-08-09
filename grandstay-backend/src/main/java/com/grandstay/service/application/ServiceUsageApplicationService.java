package com.grandstay.service.application;

import java.math.BigDecimal;
import java.time.Clock;
import java.util.UUID;

import com.grandstay.booking.domain.Booking;
import com.grandstay.booking.domain.BookingRoom;
import com.grandstay.booking.infrastructure.BookingRepository;
import com.grandstay.booking.infrastructure.BookingRoomRepository;
import com.grandstay.service.domain.BookingService;
import com.grandstay.service.domain.HotelService;
import com.grandstay.service.infrastructure.BookingServiceRepository;
import com.grandstay.service.infrastructure.HotelServiceRepository;
import com.grandstay.shared.domain.ModelEnums.BookingStatus;
import com.grandstay.shared.exception.BusinessException;
import com.grandstay.shared.exception.ErrorCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ServiceUsageApplicationService {
    private final BookingRepository bookingRepository;
    private final BookingRoomRepository bookingRoomRepository;
    private final HotelServiceRepository serviceRepository;
    private final BookingServiceRepository bookingServiceRepository;
    private final Clock clock;

    public ServiceUsageApplicationService(BookingRepository bookingRepository,
                                          BookingRoomRepository bookingRoomRepository,
                                          HotelServiceRepository serviceRepository,
                                          BookingServiceRepository bookingServiceRepository,
                                          Clock clock) {
        this.bookingRepository = bookingRepository;
        this.bookingRoomRepository = bookingRoomRepository;
        this.serviceRepository = serviceRepository;
        this.bookingServiceRepository = bookingServiceRepository;
        this.clock = clock;
    }

    @Transactional
    public UsageResult add(UUID bookingId, UUID bookingRoomId, UUID serviceId,
                           BigDecimal quantity, String notes) {
        if (quantity == null || quantity.signum() <= 0) {
            throw BusinessException.invalid("Service quantity must be positive");
        }
        Booking booking = bookingRepository.findByIdForUpdate(bookingId)
                .orElseThrow(() -> BusinessException.notFound("Booking", bookingId));
        if (booking.getStatus() != BookingStatus.CHECKED_IN) {
            throw BusinessException.conflict(ErrorCode.INVALID_STATE_TRANSITION,
                    "Services can only be added to a checked-in booking");
        }
        if (bookingRoomId != null) {
            BookingRoom room = bookingRoomRepository.findById(bookingRoomId)
                    .orElseThrow(() -> BusinessException.notFound("Booking room", bookingRoomId));
            if (!room.getBookingId().equals(bookingId)) {
                throw BusinessException.invalid("Booking room does not belong to the booking");
            }
        }
        HotelService service = serviceRepository.findById(serviceId)
                .orElseThrow(() -> BusinessException.notFound("Service", serviceId));
        if (!service.isActive() || service.getDeletedAt() != null) {
            throw BusinessException.conflict(ErrorCode.DATA_CONFLICT, "Service is not active");
        }
        if (!service.getCurrency().equalsIgnoreCase(booking.getCurrency())) {
            throw BusinessException.invalid("Service and booking currencies must match");
        }
        BookingService usage = new BookingService();
        usage.setBookingId(bookingId); usage.setBookingRoomId(bookingRoomId); usage.setServiceId(serviceId);
        usage.setServiceName(service.getName()); usage.setUnit(service.getUnit());
        usage.setUnitPrice(service.getUnitPrice()); usage.setQuantity(quantity); usage.setTaxRate(service.getTaxRate());
        usage.setServiceAt(clock.instant()); usage.setNotes(notes);
        usage = bookingServiceRepository.save(usage);
        return new UsageResult(usage.getId(), usage.getServiceName(), usage.getQuantity(),
                usage.getUnitPrice(), usage.getUnitPrice().multiply(usage.getQuantity()));
    }

    public record UsageResult(UUID id, String serviceName, BigDecimal quantity,
                              BigDecimal unitPrice, BigDecimal subtotal) {}
}
