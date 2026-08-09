package com.grandstay.payment.api;

import java.util.UUID;

import com.grandstay.payment.application.PaymentApplicationService.PaymentView;
import com.grandstay.payment.application.PaymentApplicationService.ProviderPayment;
import com.grandstay.payment.application.SelfPaymentApplicationService;
import com.grandstay.payment.application.SelfPaymentApplicationService.DepositQuote;
import com.grandstay.payment.application.VnPayPaymentApplicationService.VnPayCheckout;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.ResponseStatus;

@RestController
@RequestMapping("/api/v1/self/payments")
@PreAuthorize("hasRole('CUSTOMER')")
@Tag(name = "Customer payments")
public class SelfPaymentController {
    private final SelfPaymentApplicationService service;

    public SelfPaymentController(SelfPaymentApplicationService service) { this.service = service; }

    @GetMapping("/bookings/{bookingId}/deposit")
    @Operation(summary = "Get the deposit quote and payment history for the current customer's booking")
    public DepositQuote deposit(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID bookingId) {
        return service.quote(userId(jwt), bookingId);
    }

    @PostMapping("/bookings/{bookingId}/vnpay")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create a VNPay Sandbox deposit for the current customer's booking")
    public VnPayCheckout createVnPay(@AuthenticationPrincipal Jwt jwt,
                                     @PathVariable UUID bookingId,
                                     HttpServletRequest request) {
        return service.createVnPayDeposit(userId(jwt), bookingId, request.getRemoteAddr());
    }

    @GetMapping("/{paymentId}")
    @Operation(summary = "Get an owned payment")
    public PaymentView get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID paymentId) {
        return service.get(userId(jwt), paymentId);
    }

    @PostMapping("/{paymentId}/vnpay/reconcile")
    @Operation(summary = "Reconcile an owned VNPay payment")
    public ProviderPayment reconcileVnPay(@AuthenticationPrincipal Jwt jwt,
                                          @PathVariable UUID paymentId) {
        return service.reconcileVnPay(userId(jwt), paymentId);
    }

    private UUID userId(Jwt jwt) { return UUID.fromString(jwt.getSubject()); }
}
