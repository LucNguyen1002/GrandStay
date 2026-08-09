package com.grandstay.billing.api;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

import com.grandstay.billing.application.InvoicePdfService;
import com.grandstay.billing.application.InvoiceQueryService;
import com.grandstay.billing.domain.Invoice;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/invoices")
@Tag(name = "Invoices")
@PreAuthorize("hasAuthority('payment:read')")
public class InvoiceController {
    private final InvoiceQueryService queryService;
    private final InvoicePdfService pdfService;
    public InvoiceController(InvoiceQueryService queryService, InvoicePdfService pdfService) {
        this.queryService = queryService;
        this.pdfService = pdfService;
    }
    @GetMapping("/{id}") public InvoiceQueryService.InvoiceView get(@PathVariable UUID id) { return queryService.get(id); }
    @GetMapping(value = "/{id}/pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> pdf(@PathVariable UUID id) {
        InvoicePdfService.InvoicePdf result = pdfService.generate(id);
        ContentDisposition disposition = ContentDisposition.attachment()
                .filename(result.fileName(), StandardCharsets.UTF_8)
                .build();
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .body(result.bytes());
    }
    @GetMapping("/bookings/{bookingId}") public List<Invoice> byBooking(@PathVariable UUID bookingId) {
        return queryService.byBooking(bookingId);
    }
}
