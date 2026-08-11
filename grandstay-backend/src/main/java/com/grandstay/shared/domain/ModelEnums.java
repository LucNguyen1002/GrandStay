package com.grandstay.shared.domain;

public final class ModelEnums {
    private ModelEnums() {}

    public enum UserStatus { ACTIVE, INACTIVE, LOCKED }
    public enum Gender { MALE, FEMALE, OTHER, UNDISCLOSED }
    public enum IdentityType { NATIONAL_ID, PASSPORT, OTHER }
    public enum IdentityVerificationStatus { UNVERIFIED, PENDING, VERIFIED, REJECTED }
    public enum IdentityDocumentSide { FRONT, BACK }
    public enum RoomOperationalStatus { AVAILABLE, CLEANING, MAINTENANCE, OUT_OF_SERVICE }
    public enum PricingUnit { HOURLY, DAILY, NIGHTLY }
    public enum DiscountType { PERCENTAGE, FIXED_AMOUNT }
    public enum BookingSource { DIRECT, WALK_IN, ONLINE, PHONE, OTA }
    public enum BookingStatus { PENDING, CONFIRMED, CHECKED_IN, CHECKED_OUT, CANCELLED, NO_SHOW }
    public enum PaymentType { PAYMENT, REFUND }
    public enum PaymentPurpose { DEPOSIT, SETTLEMENT, EXTRA, REFUND }
    public enum PaymentMethod { CASH, QR, BANK_TRANSFER, CARD, MOMO, VNPAY }
    public enum PaymentStatus { PENDING, COMPLETED, FAILED, CANCELLED, REFUNDED, PARTIALLY_REFUNDED }
    public enum InvoiceStatus { DRAFT, ISSUED, PAID, VOID }
    public enum InvoiceItemType { ROOM, SERVICE, EXTRA_FEE, DISCOUNT, TAX }
}
