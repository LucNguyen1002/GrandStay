package com.grandstay.billing.application;

import java.util.List;
import java.util.UUID;

import com.grandstay.billing.domain.Invoice;
import com.grandstay.billing.domain.InvoiceItem;
import com.grandstay.billing.infrastructure.InvoiceItemRepository;
import com.grandstay.billing.infrastructure.InvoiceRepository;
import com.grandstay.shared.exception.BusinessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InvoiceQueryService {
    private final InvoiceRepository invoiceRepository;
    private final InvoiceItemRepository itemRepository;
    public InvoiceQueryService(InvoiceRepository invoiceRepository, InvoiceItemRepository itemRepository) {
        this.invoiceRepository = invoiceRepository; this.itemRepository = itemRepository;
    }

    @Transactional(readOnly = true)
    public InvoiceView get(UUID id) {
        Invoice invoice = invoiceRepository.findById(id)
                .orElseThrow(() -> BusinessException.notFound("Invoice", id));
        return new InvoiceView(invoice, itemRepository.findAllByInvoiceIdOrderByDisplayOrderAsc(id));
    }

    @Transactional(readOnly = true)
    public List<Invoice> byBooking(UUID bookingId) {
        return invoiceRepository.findAllByBookingIdOrderByCreatedAtDesc(bookingId);
    }

    public record InvoiceView(Invoice invoice, List<InvoiceItem> items) {}
}
