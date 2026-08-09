package com.grandstay.shared.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import com.grandstay.shared.domain.ModelEnums.*;

public final class EntityDtos {
 private EntityDtos() {}
 public record UserDto(UUID id,String username,String email,String fullName,String phone,UserStatus status,long version) {}
 public record CustomerDto(UUID id,String customerCode,String fullName,String email,String phone,String nationality,LocalDate dateOfBirth,Gender gender,long version) {}
 public record FloorDto(UUID id,String code,String name,int floorNumber,String description,long version) {}
 public record AmenityDto(UUID id,String code,String name,String description,String icon,long version) {}
 public record RoomTypeDto(UUID id,String code,String name,String description,int capacityAdults,int capacityChildren,BigDecimal baseHourlyRate,BigDecimal baseDailyRate,BigDecimal baseNightlyRate,String currency,long version) {}
 public record RoomDto(UUID id,String roomNumber,UUID floorId,UUID roomTypeId,RoomOperationalStatus operationalStatus,String notes,long version) {}
 public record RatePlanDto(UUID id,UUID roomTypeId,String code,String name,PricingUnit pricingUnit,BigDecimal rate,String currency,LocalDate validFrom,LocalDate validTo,int minStayUnits,boolean refundable,boolean active,long version) {}
 public record BookingDto(UUID id,String bookingNumber,UUID customerId,BookingSource bookingSource,BookingStatus status,Instant expectedCheckInAt,Instant expectedCheckOutAt,int adults,int children,String currency,BigDecimal discountAmount,BigDecimal taxRate,long version) {}
 public record BookingRoomDto(UUID id,UUID bookingId,UUID roomId,UUID ratePlanId,String stayPeriod,BookingStatus allocationStatus,PricingUnit pricingUnit,BigDecimal unitRate,BigDecimal quantity,BigDecimal roomCharge,long version) {}
 public record BookingGuestDto(UUID id,UUID bookingId,UUID customerId,String fullName,boolean primary,String nationality,LocalDate dateOfBirth,long version) {}
 public record ServiceDto(UUID id,String code,String name,String category,String description,String unit,BigDecimal unitPrice,BigDecimal taxRate,String currency,boolean active,long version) {}
 public record PaymentDto(UUID id,UUID bookingId,String transactionCode,PaymentType paymentType,PaymentPurpose purpose,PaymentMethod method,PaymentStatus status,BigDecimal amount,String currency,Instant paidAt,long version) {}
 public record InvoiceDto(UUID id,String invoiceNumber,UUID bookingId,InvoiceStatus status,Instant issuedAt,String customerName,String currency,BigDecimal grandTotal,long version) {}
 public record PromotionDto(UUID id,String code,String name,String description,DiscountType discountType,
                            BigDecimal discountValue,BigDecimal maximumDiscount,
                            BigDecimal minimumBookingAmount,Instant validFrom,Instant validTo,
                            Integer usageLimit,int usedCount,boolean active,long version) {}
}
