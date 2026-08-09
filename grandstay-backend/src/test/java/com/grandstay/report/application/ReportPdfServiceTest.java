package com.grandstay.report.application;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;

import com.grandstay.report.application.RevenueReportService.Granularity;
import com.grandstay.report.application.RevenueReportService.ReportType;
import com.grandstay.report.application.RevenueReportService.RevenueBucket;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReportPdfServiceTest {
    @Mock RevenueReportService reports;

    @Test
    void generatesUnicodeRevenueReportAsPdf() {
        Instant from = Instant.parse("2026-08-01T00:00:00Z");
        Instant to = Instant.parse("2026-09-01T00:00:00Z");
        when(reports.revenue(from, to, Granularity.DAILY)).thenReturn(List.of(
                new RevenueBucket(LocalDateTime.parse("2026-08-01T00:00:00"), 2, new BigDecimal("2500000"))));

        var result = new ReportPdfService(reports).generate(ReportType.REVENUE, from, to, Granularity.DAILY);

        assertThat(result.fileName()).isEqualTo("GrandStay-revenue.pdf");
        assertThat(new String(result.bytes(), 0, 4, StandardCharsets.US_ASCII)).isEqualTo("%PDF");
        assertThat(result.bytes().length).isGreaterThan(1_000);
    }
}
