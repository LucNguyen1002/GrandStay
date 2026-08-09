package com.grandstay.billing.application;

import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.grandstay.billing.domain.Invoice;
import com.grandstay.billing.domain.InvoiceItem;
import com.grandstay.shared.domain.ModelEnums.InvoiceItemType;
import com.grandstay.shared.domain.ModelEnums.InvoiceStatus;
import com.lowagie.text.pdf.PdfReader;
import com.lowagie.text.pdf.parser.PdfTextExtractor;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InvoicePdfServiceTest {
    private static final UUID INVOICE_ID = UUID.fromString("3d8473da-2a6c-4d92-bd7b-b6e0fe3ecadb");

    @Mock InvoiceQueryService queryService;

    @Test
    void generatesReadableUnicodeInvoicePdf() throws Exception {
        Invoice invoice = invoice();
        InvoiceItem room = item("Phòng Deluxe hướng vườn", "đêm", "2", "850000", "1700000", 1);
        InvoiceItem service = item("Dịch vụ giặt ủi", "lần", "1", "120000", "120000", 2);
        when(queryService.get(INVOICE_ID)).thenReturn(new InvoiceQueryService.InvoiceView(invoice, List.of(room, service)));

        InvoicePdfService.InvoicePdf result = new InvoicePdfService(queryService).generate(INVOICE_ID);

        assertThat(result.fileName()).isEqualTo("GrandStay-GS-20260807-001.pdf");
        assertThat(result.bytes()).startsWith("%PDF".getBytes());
        assertThat(result.bytes().length).isGreaterThan(20_000);

        PdfReader reader = new PdfReader(result.bytes());
        assertThat(reader.getNumberOfPages()).isEqualTo(1);
        String text = new PdfTextExtractor(reader).getTextFromPage(1);
        assertThat(text).contains("HÓA ĐƠN", "Nguyễn Thị Lan", "Phòng Deluxe hướng vườn", "1.820.000 VND");
        reader.close();

        String previewPath = System.getProperty("grandstay.pdf.preview");
        if (previewPath != null) {
            Path preview = Path.of(previewPath);
            Files.createDirectories(preview.getParent());
            Files.write(preview, result.bytes());
        }
    }

    private static Invoice invoice() {
        Invoice invoice = new Invoice();
        invoice.setId(INVOICE_ID);
        invoice.setInvoiceNumber("GS-20260807-001");
        invoice.setBookingId(UUID.randomUUID());
        invoice.setStatus(InvoiceStatus.ISSUED);
        invoice.setIssuedAt(Instant.parse("2026-08-07T08:30:00Z"));
        invoice.setDueAt(Instant.parse("2026-08-08T08:30:00Z"));
        invoice.setCustomerName("Nguyễn Thị Lan");
        invoice.setCustomerTaxCode("0312345678");
        invoice.setBillingAddress("12 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh");
        invoice.setCurrency("VND");
        invoice.setRoomCharge(new BigDecimal("1700000"));
        invoice.setServiceCharge(new BigDecimal("120000"));
        invoice.setExtraFee(BigDecimal.ZERO);
        invoice.setDiscountAmount(BigDecimal.ZERO);
        invoice.setTaxAmount(BigDecimal.ZERO);
        invoice.setGrandTotal(new BigDecimal("1820000"));
        invoice.setNotes("Thanh toán tại quầy lễ tân.");
        return invoice;
    }

    private static InvoiceItem item(String description, String unit, String quantity,
                                    String unitPrice, String lineTotal, int order) {
        InvoiceItem item = new InvoiceItem();
        item.setId(UUID.randomUUID());
        item.setInvoiceId(INVOICE_ID);
        item.setItemType(order == 1 ? InvoiceItemType.ROOM : InvoiceItemType.SERVICE);
        item.setDescription(description);
        item.setUnit(unit);
        item.setQuantity(new BigDecimal(quantity));
        item.setUnitPrice(new BigDecimal(unitPrice));
        item.setDiscountAmount(BigDecimal.ZERO);
        item.setTaxRate(BigDecimal.ZERO);
        item.setTaxAmount(BigDecimal.ZERO);
        item.setLineTotal(new BigDecimal(lineTotal));
        item.setDisplayOrder(order);
        return item;
    }
}
