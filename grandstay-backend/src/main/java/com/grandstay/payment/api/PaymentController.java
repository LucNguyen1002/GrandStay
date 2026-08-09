package com.grandstay.payment.api;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import com.grandstay.payment.application.PaymentApplicationService;
import com.grandstay.payment.application.PaymentCommands.RecordPayment;
import com.grandstay.payment.application.PaymentCommands.RefundPayment;
import com.grandstay.shared.domain.ModelEnums.PaymentMethod;
import com.grandstay.shared.domain.ModelEnums.PaymentPurpose;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/payments")
@Tag(name = "Payments")
public class PaymentController {
    private final PaymentApplicationService paymentService;
    public PaymentController(PaymentApplicationService paymentService) { this.paymentService = paymentService; }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('payment:write')")
    @Operation(summary = "Record a pending or completed payment/deposit")
    public PaymentApplicationService.PaymentResult record(@Valid @RequestBody PaymentRequest request) {
        return paymentService.record(new RecordPayment(request.bookingId(), request.transactionCode(),
                request.purpose(), request.method(), request.amount(), request.currency(), request.completed(),
                request.providerReference(), request.notes()));
    }

    @PostMapping("/{id}/complete")
    @PreAuthorize("hasAuthority('payment:write')")
    public PaymentApplicationService.PaymentResult complete(@PathVariable UUID id) {
        return paymentService.complete(id);
    }

    @PostMapping("/{id}/refunds")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('payment:write')")
    public PaymentApplicationService.PaymentResult refund(@PathVariable UUID id,
                                                           @Valid @RequestBody RefundRequest request) {
        return paymentService.refund(new RefundPayment(id, request.transactionCode(), request.amount(), request.reason()));
    }

    @GetMapping("/bookings/{bookingId}/balance")
    @PreAuthorize("hasAuthority('payment:read')")
    public PaymentApplicationService.BalanceResult balance(@PathVariable UUID bookingId) {
        return paymentService.balance(bookingId);
    }

    @GetMapping("/bookings/{bookingId}")
    @PreAuthorize("hasAuthority('payment:read')")
    public List<PaymentApplicationService.PaymentView> byBooking(@PathVariable UUID bookingId) {
        return paymentService.byBooking(bookingId);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('payment:read')")
    public PaymentApplicationService.PaymentView get(@PathVariable UUID id) {
        return paymentService.get(id);
    }

    public record PaymentRequest(@NotNull UUID bookingId, @NotBlank @Size(max=100) String transactionCode,
            @NotNull PaymentPurpose purpose, @NotNull PaymentMethod method,
            @NotNull @DecimalMin("0.01") BigDecimal amount,
            @NotBlank @Pattern(regexp="[A-Za-z]{3}") String currency, boolean completed,
            @Size(max=150) String providerReference, @Size(max=500) String notes) {}
    public record RefundRequest(@NotBlank @Size(max=100) String transactionCode,
                                @NotNull @DecimalMin("0.01") BigDecimal amount,
                                @NotBlank @Size(max=500) String reason) {}
}
