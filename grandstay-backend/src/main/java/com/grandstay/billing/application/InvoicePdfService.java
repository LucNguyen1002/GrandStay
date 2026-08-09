package com.grandstay.billing.application;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.UUID;

import com.grandstay.billing.domain.Invoice;
import com.grandstay.billing.domain.InvoiceItem;
import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.Rectangle;
import com.lowagie.text.pdf.ColumnText;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPageEventHelper;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import org.librepdf.openpdf.fonts.Liberation;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InvoicePdfService {
    private static final Color INK = new Color(16, 42, 67);
    private static final Color MUTED = new Color(91, 112, 133);
    private static final Color GOLD = new Color(188, 139, 60);
    private static final Color PALE = new Color(246, 248, 250);
    private static final Color LINE = new Color(222, 228, 234);
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private final InvoiceQueryService queryService;

    public InvoicePdfService(InvoiceQueryService queryService) {
        this.queryService = queryService;
    }

    @Transactional(readOnly = true)
    public InvoicePdf generate(UUID invoiceId) {
        InvoiceQueryService.InvoiceView view = queryService.get(invoiceId);
        Invoice invoice = view.invoice();
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        Document document = new Document(PageSize.A4, 42, 42, 48, 48);

        try {
            Fonts fonts = Fonts.load();
            PdfWriter writer = PdfWriter.getInstance(document, output);
            writer.setPageEvent(new FooterEvent(fonts.footer(), invoice.getInvoiceNumber()));
            document.addTitle("Hóa đơn " + invoice.getInvoiceNumber());
            document.addAuthor("GrandStay Hotel");
            document.addCreator("GrandStay HMS");
            document.open();

            addHeader(document, invoice, fonts);
            addCustomer(document, invoice, fonts);
            addItems(document, view, invoice, fonts);
            addTotals(document, invoice, fonts);
            addNotes(document, invoice, fonts);
            document.close();
        } catch (DocumentException | IOException exception) {
            if (document.isOpen()) document.close();
            throw new IllegalStateException("Could not generate invoice PDF", exception);
        }

        String safeNumber = invoice.getInvoiceNumber().replaceAll("[^A-Za-z0-9._-]", "-");
        return new InvoicePdf("GrandStay-" + safeNumber + ".pdf", output.toByteArray());
    }

    private static void addHeader(Document document, Invoice invoice, Fonts fonts) throws DocumentException {
        PdfPTable header = new PdfPTable(new float[]{1.15f, 1f});
        header.setWidthPercentage(100);
        header.setSpacingAfter(22);

        PdfPCell brand = cell(null, Rectangle.NO_BORDER, Color.WHITE, 0);
        Paragraph hotel = new Paragraph("GRANDSTAY HOTEL", fonts.brand());
        hotel.setSpacingAfter(5);
        brand.addElement(hotel);
        brand.addElement(new Paragraph("Quản lý lưu trú chuyên nghiệp", fonts.small()));
        header.addCell(brand);

        PdfPCell identity = cell(null, Rectangle.NO_BORDER, Color.WHITE, 0);
        identity.setHorizontalAlignment(Element.ALIGN_RIGHT);
        Paragraph title = new Paragraph("HÓA ĐƠN", fonts.title());
        title.setAlignment(Element.ALIGN_RIGHT);
        identity.addElement(title);
        Paragraph number = new Paragraph(invoice.getInvoiceNumber(), fonts.strong());
        number.setAlignment(Element.ALIGN_RIGHT);
        identity.addElement(number);
        Paragraph status = new Paragraph(statusLabel(invoice), fonts.status());
        status.setAlignment(Element.ALIGN_RIGHT);
        identity.addElement(status);
        header.addCell(identity);
        document.add(header);

        PdfPTable rule = new PdfPTable(1);
        rule.setWidthPercentage(100);
        PdfPCell ruleCell = cell("", Rectangle.NO_BORDER, GOLD, 0);
        ruleCell.setFixedHeight(3);
        rule.addCell(ruleCell);
        rule.setSpacingAfter(22);
        document.add(rule);
    }

    private static void addCustomer(Document document, Invoice invoice, Fonts fonts) throws DocumentException {
        PdfPTable info = new PdfPTable(new float[]{1f, 1f});
        info.setWidthPercentage(100);
        info.setSpacingAfter(24);

        PdfPCell customer = cell(null, Rectangle.NO_BORDER, PALE, 14);
        customer.addElement(new Paragraph("KHÁCH HÀNG", fonts.label()));
        customer.addElement(new Paragraph(orDash(invoice.getCustomerName()), fonts.strong()));
        if (hasText(invoice.getBillingAddress())) customer.addElement(new Paragraph(invoice.getBillingAddress(), fonts.body()));
        if (hasText(invoice.getCustomerTaxCode())) customer.addElement(new Paragraph("Mã số thuế: " + invoice.getCustomerTaxCode(), fonts.body()));
        info.addCell(customer);

        PdfPCell dates = cell(null, Rectangle.NO_BORDER, PALE, 14);
        dates.addElement(new Paragraph("THÔNG TIN HÓA ĐƠN", fonts.label()));
        dates.addElement(new Paragraph("Ngày phát hành: " + formatDate(invoice.getIssuedAt()), fonts.body()));
        dates.addElement(new Paragraph("Hạn thanh toán: " + formatDate(invoice.getDueAt()), fonts.body()));
        dates.addElement(new Paragraph("Tiền tệ: " + invoice.getCurrency(), fonts.body()));
        info.addCell(dates);
        document.add(info);
    }

    private static void addItems(Document document, InvoiceQueryService.InvoiceView view, Invoice invoice, Fonts fonts)
            throws DocumentException {
        PdfPTable table = new PdfPTable(new float[]{3.25f, .65f, 1.2f, 1.05f, 1.35f});
        table.setWidthPercentage(100);
        table.setHeaderRows(1);
        table.setSplitRows(true);
        table.setSpacingAfter(18);
        addHeaderCell(table, "Nội dung", Element.ALIGN_LEFT, fonts);
        addHeaderCell(table, "SL", Element.ALIGN_RIGHT, fonts);
        addHeaderCell(table, "Đơn giá", Element.ALIGN_RIGHT, fonts);
        addHeaderCell(table, "Thuế", Element.ALIGN_RIGHT, fonts);
        addHeaderCell(table, "Thành tiền", Element.ALIGN_RIGHT, fonts);

        for (InvoiceItem item : view.items()) {
            PdfPCell description = tableCell(null, Element.ALIGN_LEFT, fonts.body());
            description.addElement(new Paragraph(item.getDescription(), fonts.body()));
            description.addElement(new Paragraph("Đơn vị: " + item.getUnit(), fonts.small()));
            table.addCell(description);
            table.addCell(tableCell(number(item.getQuantity()), Element.ALIGN_RIGHT, fonts.body()));
            table.addCell(tableCell(money(item.getUnitPrice(), invoice.getCurrency()), Element.ALIGN_RIGHT, fonts.body()));
            table.addCell(tableCell(money(item.getTaxAmount(), invoice.getCurrency()), Element.ALIGN_RIGHT, fonts.body()));
            table.addCell(tableCell(money(item.getLineTotal(), invoice.getCurrency()), Element.ALIGN_RIGHT, fonts.strong()));
        }
        document.add(table);
    }

    private static void addTotals(Document document, Invoice invoice, Fonts fonts) throws DocumentException {
        PdfPTable wrapper = new PdfPTable(new float[]{1.15f, 1f});
        wrapper.setWidthPercentage(100);
        wrapper.setSpacingAfter(20);
        wrapper.addCell(cell("", Rectangle.NO_BORDER, Color.WHITE, 0));

        PdfPCell totalsCell = cell(null, Rectangle.BOX, PALE, 14);
        totalsCell.setBorderColor(LINE);
        PdfPTable totals = new PdfPTable(new float[]{1.25f, 1f});
        totals.setWidthPercentage(100);
        totalRow(totals, "Tiền phòng", invoice.getRoomCharge(), invoice, fonts.body(), fonts.body());
        totalRow(totals, "Dịch vụ", invoice.getServiceCharge(), invoice, fonts.body(), fonts.body());
        totalRow(totals, "Phụ phí", invoice.getExtraFee(), invoice, fonts.body(), fonts.body());
        totalRow(totals, "Giảm giá", invoice.getDiscountAmount().negate(), invoice, fonts.body(), fonts.body());
        totalRow(totals, "Thuế", invoice.getTaxAmount(), invoice, fonts.body(), fonts.body());
        totalRow(totals, "TỔNG THANH TOÁN", invoice.getGrandTotal(), invoice, fonts.total(), fonts.total());
        totalsCell.addElement(totals);
        wrapper.addCell(totalsCell);
        document.add(wrapper);
    }

    private static void addNotes(Document document, Invoice invoice, Fonts fonts) throws DocumentException {
        if (hasText(invoice.getNotes())) {
            Paragraph label = new Paragraph("GHI CHÚ", fonts.label());
            label.setSpacingAfter(5);
            document.add(label);
            document.add(new Paragraph(invoice.getNotes(), fonts.body()));
        }
        Paragraph thanks = new Paragraph("Cảm ơn quý khách đã lựa chọn GrandStay.", fonts.thanks());
        thanks.setAlignment(Element.ALIGN_CENTER);
        thanks.setSpacingBefore(24);
        document.add(thanks);
    }

    private static void totalRow(PdfPTable table, String label, BigDecimal amount, Invoice invoice,
                                 Font labelFont, Font valueFont) {
        PdfPCell left = cell(label, Rectangle.NO_BORDER, Color.WHITE, 3);
        left.setPhrase(new Phrase(label, labelFont));
        PdfPCell right = cell(money(amount, invoice.getCurrency()), Rectangle.NO_BORDER, Color.WHITE, 3);
        right.setPhrase(new Phrase(money(amount, invoice.getCurrency()), valueFont));
        right.setHorizontalAlignment(Element.ALIGN_RIGHT);
        table.addCell(left);
        table.addCell(right);
    }

    private static void addHeaderCell(PdfPTable table, String text, int alignment, Fonts fonts) {
        PdfPCell cell = cell(text, Rectangle.NO_BORDER, INK, 9);
        cell.setPhrase(new Phrase(text, fonts.tableHeader()));
        cell.setHorizontalAlignment(alignment);
        cell.setVerticalAlignment(Element.ALIGN_MIDDLE);
        table.addCell(cell);
    }

    private static PdfPCell tableCell(String text, int alignment, Font font) {
        PdfPCell cell = cell(text, Rectangle.BOTTOM, Color.WHITE, 9);
        cell.setBorderColor(LINE);
        cell.setHorizontalAlignment(alignment);
        cell.setVerticalAlignment(Element.ALIGN_MIDDLE);
        if (text != null) cell.setPhrase(new Phrase(text, font));
        return cell;
    }

    private static PdfPCell cell(String text, int border, Color background, float padding) {
        PdfPCell cell = text == null ? new PdfPCell() : new PdfPCell(new Phrase(text));
        cell.setBorder(border);
        cell.setBackgroundColor(background);
        cell.setPadding(padding);
        return cell;
    }

    private static String statusLabel(Invoice invoice) {
        return switch (invoice.getStatus()) {
            case DRAFT -> "BẢN NHÁP";
            case ISSUED -> "ĐÃ PHÁT HÀNH";
            case PAID -> "ĐÃ THANH TOÁN";
            case VOID -> "ĐÃ HỦY";
        };
    }

    private static String formatDate(java.time.Instant value) {
        return value == null ? "-" : DATE_TIME.format(value.atZone(BUSINESS_ZONE));
    }

    private static String money(BigDecimal value, String currency) {
        return number(value) + " " + currency;
    }

    private static String number(BigDecimal value) {
        DecimalFormatSymbols symbols = DecimalFormatSymbols.getInstance(new Locale("vi", "VN"));
        DecimalFormat format = new DecimalFormat("#,##0.##", symbols);
        return format.format(value == null ? BigDecimal.ZERO : value);
    }

    private static String orDash(String value) {
        return hasText(value) ? value : "-";
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    public record InvoicePdf(String fileName, byte[] bytes) {}

    private record Fonts(Font brand, Font title, Font strong, Font body, Font small, Font label,
                         Font tableHeader, Font status, Font total, Font footer, Font thanks) {
        static Fonts load() throws IOException {
            return new Fonts(
                    font(Liberation.SANS_BOLD, 15, INK),
                    font(Liberation.SANS_BOLD, 22, INK),
                    font(Liberation.SANS_BOLD, 10, INK),
                    font(Liberation.SANS, 9, INK),
                    font(Liberation.SANS, 8, MUTED),
                    font(Liberation.SANS_BOLD, 8, GOLD),
                    font(Liberation.SANS_BOLD, 8, Color.WHITE),
                    font(Liberation.SANS_BOLD, 9, GOLD),
                    font(Liberation.SANS_BOLD, 11, INK),
                    font(Liberation.SANS, 8, MUTED),
                    font(Liberation.SANS_ITALIC, 9, GOLD));
        }

        private static Font font(Liberation family, int size, Color color) throws IOException {
            Font font = family.create(size);
            font.setColor(color);
            return font;
        }
    }

    private static final class FooterEvent extends PdfPageEventHelper {
        private final Font font;
        private final String invoiceNumber;

        private FooterEvent(Font font, String invoiceNumber) {
            this.font = font;
            this.invoiceNumber = invoiceNumber;
        }

        @Override
        public void onEndPage(PdfWriter writer, Document document) {
            Phrase left = new Phrase("GrandStay HMS | " + invoiceNumber, font);
            Phrase right = new Phrase("Trang " + writer.getPageNumber(), font);
            ColumnText.showTextAligned(writer.getDirectContent(), Element.ALIGN_LEFT, left,
                    document.left(), 24, 0);
            ColumnText.showTextAligned(writer.getDirectContent(), Element.ALIGN_RIGHT, right,
                    document.right(), 24, 0);
        }
    }
}
