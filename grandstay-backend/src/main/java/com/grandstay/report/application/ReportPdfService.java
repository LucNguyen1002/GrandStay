package com.grandstay.report.application;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import com.grandstay.report.application.RevenueReportService.Granularity;
import com.grandstay.report.application.RevenueReportService.ReportType;
import com.grandstay.shared.exception.BusinessException;
import org.librepdf.openpdf.fonts.Liberation;
import org.springframework.stereotype.Service;

@Service
public class ReportPdfService {
    private static final ZoneId HOTEL_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
    private static final NumberFormat NUMBER = NumberFormat.getNumberInstance(Locale.forLanguageTag("vi-VN"));
    private final RevenueReportService reports;

    public ReportPdfService(RevenueReportService reports) {
        this.reports = reports;
    }

    public PdfReport generate(ReportType type, Instant from, Instant to, Granularity granularity) {
        try {
            Font titleFont = font(Liberation.SANS_BOLD, 18, new Color(16, 42, 67));
            Font headerFont = font(Liberation.SANS_BOLD, 8, Color.WHITE);
            Font bodyFont = font(Liberation.SANS, 8, new Color(16, 42, 67));
            Font metaFont = font(Liberation.SANS, 8, new Color(90, 105, 120));
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            Document document = new Document(PageSize.A4.rotate(), 30, 30, 32, 30);
            PdfWriter.getInstance(document, output);
            document.open();
            document.add(new Paragraph(title(type), titleFont));
            document.add(new Paragraph("GrandStay Hotel · " + format(from) + " — " + format(to), metaFont));
            document.add(new Paragraph(" ", bodyFont));
            TableData data = data(type, from, to, granularity);
            PdfPTable table = new PdfPTable(data.headers().size());
            table.setWidthPercentage(100);
            for (String header : data.headers()) {
                PdfPCell cell = new PdfPCell(new Phrase(header, headerFont));
                cell.setBackgroundColor(new Color(40, 96, 82));
                cell.setPadding(7);
                table.addCell(cell);
            }
            for (List<String> row : data.rows()) for (String value : row) {
                PdfPCell cell = new PdfPCell(new Phrase(value, bodyFont));
                cell.setPadding(6);
                cell.setVerticalAlignment(Element.ALIGN_MIDDLE);
                table.addCell(cell);
            }
            document.add(table);
            document.close();
            return new PdfReport("GrandStay-" + type.name().toLowerCase(Locale.ROOT) + ".pdf", output.toByteArray());
        } catch (DocumentException | IOException exception) {
            throw BusinessException.invalid("Unable to generate report PDF");
        }
    }

    private TableData data(ReportType type, Instant from, Instant to, Granularity granularity) {
        return switch (type) {
            case REVENUE -> new TableData(List.of("Kỳ", "Số hóa đơn", "Doanh thu"), reports.revenue(from, to, granularity).stream()
                    .map(row -> List.of(row.period().toString(), String.valueOf(row.invoiceCount()), money(row.revenue()))).toList());
            case OCCUPANCY -> new TableData(List.of("Hạng phòng", "Số phòng", "Giờ sử dụng", "Công suất", "Doanh thu"), reports.occupancy(from, to).stream()
                    .map(row -> List.of(row.roomTypeName(), String.valueOf(row.roomCount()), number(row.occupiedHours()), number(row.occupancyRate()) + "%", money(row.roomRevenue()))).toList());
            case SERVICES -> new TableData(List.of("Dịch vụ", "Số lượng", "Đơn vị", "Booking", "Doanh thu"), reports.services(from, to).stream()
                    .map(row -> List.of(row.serviceName(), number(row.quantity()), row.unit(), String.valueOf(row.bookingCount()), money(row.revenue()))).toList());
            case RECEIVABLES -> new TableData(List.of("Hóa đơn", "Khách hàng", "Ngày phát hành", "Đã thu", "Còn phải thu", "Quá hạn"), reports.receivables(from, to).stream()
                    .map(row -> List.of(row.invoiceNumber(), row.customerName(), format(row.issuedAt()), money(row.paidAmount()), money(row.outstandingAmount()), row.overdueDays() + " ngày")).toList());
        };
    }

    private static String title(ReportType type) {
        return switch (type) {
            case REVENUE -> "BÁO CÁO DOANH THU";
            case OCCUPANCY -> "BÁO CÁO CÔNG SUẤT PHÒNG";
            case SERVICES -> "BÁO CÁO DỊCH VỤ";
            case RECEIVABLES -> "BÁO CÁO CÔNG NỢ";
        };
    }

    private static String format(Instant value) { return value == null ? "—" : DATE.format(value.atZone(HOTEL_ZONE)); }
    private static String money(BigDecimal value) { return NUMBER.format(value == null ? BigDecimal.ZERO : value) + " VND"; }
    private static String number(BigDecimal value) { return NUMBER.format(value == null ? BigDecimal.ZERO : value); }
    private static Font font(Liberation family, int size, Color color) throws IOException { Font font = family.create(size); font.setColor(color); return font; }

    private record TableData(List<String> headers, List<List<String>> rows) {
        private TableData { headers = List.copyOf(headers); rows = new ArrayList<>(rows); }
    }
    public record PdfReport(String fileName, byte[] bytes) {}
}
