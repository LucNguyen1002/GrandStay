package com.grandstay.billing.infrastructure; import java.util.*; import com.grandstay.billing.domain.Invoice; import org.springframework.data.jpa.repository.JpaRepository;
public interface InvoiceRepository extends JpaRepository<Invoice,UUID> { Optional<Invoice> findByInvoiceNumber(String number); List<Invoice> findAllByBookingIdOrderByCreatedAtDesc(UUID bookingId); }
