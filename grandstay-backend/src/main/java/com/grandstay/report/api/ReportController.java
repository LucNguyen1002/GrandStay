package com.grandstay.report.api;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;

import com.grandstay.report.application.ReportPdfService;
import com.grandstay.report.application.RevenueReportService;
import com.grandstay.report.application.RevenueReportService.Granularity;
import com.grandstay.report.application.RevenueReportService.OccupancyRow;
import com.grandstay.report.application.RevenueReportService.ReceivableRow;
import com.grandstay.report.application.RevenueReportService.ReportType;
import com.grandstay.report.application.RevenueReportService.RevenueBucket;
import com.grandstay.report.application.RevenueReportService.ServiceSalesRow;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/reports")
@Tag(name = "Reports")
@PreAuthorize("hasAuthority('report:read')")
public class ReportController {
    private final RevenueReportService service;
    private final ReportPdfService pdf;

    public ReportController(RevenueReportService service, ReportPdfService pdf) {
        this.service = service;
        this.pdf = pdf;
    }

    @GetMapping("/revenue")
    public List<RevenueBucket> revenue(@RequestParam Instant from, @RequestParam Instant to,
                                       @RequestParam(defaultValue = "DAILY") Granularity granularity) {
        return service.revenue(from, to, granularity);
    }

    @GetMapping("/occupancy")
    public List<OccupancyRow> occupancy(@RequestParam Instant from, @RequestParam Instant to) {
        return service.occupancy(from, to);
    }

    @GetMapping("/services")
    public List<ServiceSalesRow> services(@RequestParam Instant from, @RequestParam Instant to) {
        return service.services(from, to);
    }

    @GetMapping("/receivables")
    public List<ReceivableRow> receivables(@RequestParam Instant from, @RequestParam Instant to) {
        return service.receivables(from, to);
    }

    @GetMapping(value = "/export.pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> exportPdf(@RequestParam ReportType type,
                                             @RequestParam Instant from,
                                             @RequestParam Instant to,
                                             @RequestParam(defaultValue = "DAILY") Granularity granularity) {
        ReportPdfService.PdfReport report = pdf.generate(type, from, to, granularity);
        ContentDisposition disposition = ContentDisposition.attachment()
                .filename(report.fileName(), StandardCharsets.UTF_8).build();
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString()).body(report.bytes());
    }
}
