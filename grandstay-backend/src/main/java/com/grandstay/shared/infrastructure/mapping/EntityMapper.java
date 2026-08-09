package com.grandstay.shared.infrastructure.mapping;

import com.grandstay.billing.domain.Invoice;
import com.grandstay.booking.domain.*;
import com.grandstay.customer.domain.Customer;
import com.grandstay.payment.domain.Payment;
import com.grandstay.room.domain.*;
import com.grandstay.service.domain.HotelService;
import com.grandstay.shared.dto.EntityDtos.*;
import com.grandstay.user.domain.User;
import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;
import org.mapstruct.ReportingPolicy;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING, unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface EntityMapper {
 UserDto toDto(User entity);
 CustomerDto toDto(Customer entity);
 FloorDto toDto(Floor entity);
 AmenityDto toDto(Amenity entity);
 RoomTypeDto toDto(RoomType entity);
 RoomDto toDto(Room entity);
 RatePlanDto toDto(RatePlan entity);
 BookingDto toDto(Booking entity);
 BookingRoomDto toDto(BookingRoom entity);
 BookingGuestDto toDto(BookingGuest entity);
 ServiceDto toDto(HotelService entity);
 PaymentDto toDto(Payment entity);
 InvoiceDto toDto(Invoice entity);
 PromotionDto toDto(Promotion entity);
}
