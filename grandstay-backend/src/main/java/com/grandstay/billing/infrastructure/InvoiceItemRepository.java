package com.grandstay.billing.infrastructure; import java.util.*; import com.grandstay.billing.domain.InvoiceItem; import org.springframework.data.jpa.repository.JpaRepository;
public interface InvoiceItemRepository extends JpaRepository<InvoiceItem,UUID> { List<InvoiceItem> findAllByInvoiceIdOrderByDisplayOrderAsc(UUID invoiceId); }
