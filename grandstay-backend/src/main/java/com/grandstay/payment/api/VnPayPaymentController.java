package com.grandstay.payment.api;

import java.math.BigDecimal;
import java.net.URI;
import java.util.Map;
import java.util.UUID;

import com.grandstay.payment.application.PaymentApplicationService.ProviderPayment;
import com.grandstay.payment.application.VnPayPaymentApplicationService;
import com.grandstay.payment.application.VnPayPaymentApplicationService.VnPayAvailability;
import com.grandstay.payment.application.VnPayPaymentApplicationService.VnPayCheckout;
import com.grandstay.payment.application.VnPayPaymentApplicationService.VnPayIpnResponse;
import com.grandstay.payment.application.VnPayProperties;
import com.grandstay.shared.domain.ModelEnums.PaymentPurpose;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.UriComponentsBuilder;

@RestController
@RequestMapping("/api/v1/payments/vnpay")
@Tag(name = "VNPay payments")
public class VnPayPaymentController {
    private final VnPayPaymentApplicationService service;
    private final VnPayProperties properties;

    public VnPayPaymentController(VnPayPaymentApplicationService service, VnPayProperties properties) {
        this.service = service;
        this.properties = properties;
    }

    @GetMapping("/config")
    @PreAuthorize("hasAuthority('payment:read')")
    public VnPayAvailability availability() { return service.availability(); }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('payment:write')")
    @Operation(summary = "Create a pending VNPay Sandbox checkout")
    public VnPayCheckout create(@Valid @RequestBody CreateVnPayPaymentRequest request,
                                HttpServletRequest httpRequest) {
        return service.create(request.bookingId(), request.purpose(), request.amount(),
                httpRequest.getRemoteAddr());
    }

    @GetMapping("/ipn")
    @Operation(summary = "Receive and verify VNPay instant payment notifications")
    public Map<String, String> ipn(@RequestParam Map<String, String> parameters) {
        VnPayIpnResponse response = service.handleIpn(parameters);
        return Map.of("RspCode", response.rspCode(), "Message", response.message());
    }

    @GetMapping("/return")
    @Operation(summary = "Verify VNPay return data and redirect the customer's browser")
    public ResponseEntity<Void> returned(@RequestParam Map<String, String> parameters) {
        var result = service.inspectReturn(parameters);
        String location = UriComponentsBuilder.fromUriString(properties.getFrontendResultUrl())
                .queryParam("result", result.result())
                .queryParamIfPresent("paymentId", java.util.Optional.ofNullable(result.paymentId()))
                .queryParamIfPresent("bookingId", java.util.Optional.ofNullable(result.bookingId()))
                .build().encode().toUriString();
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(location)).build();
    }

    @PostMapping("/{paymentId}/reconcile")
    @PreAuthorize("hasAuthority('payment:write')")
    @Operation(summary = "Query VNPay and reconcile a pending payment")
    public ProviderPayment reconcile(@PathVariable UUID paymentId) {
        return service.reconcile(paymentId);
    }

    public record CreateVnPayPaymentRequest(@NotNull UUID bookingId,
                                             @NotNull PaymentPurpose purpose,
                                             @NotNull @DecimalMin("5000") BigDecimal amount) {}
}
