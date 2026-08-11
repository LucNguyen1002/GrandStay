package com.grandstay.customer.application;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;

import com.grandstay.customer.domain.Customer;
import com.grandstay.customer.domain.CustomerIdentityDocument;
import com.grandstay.customer.infrastructure.CustomerIdentityDocumentRepository;
import com.grandstay.customer.infrastructure.CustomerRepository;
import com.grandstay.shared.domain.ModelEnums.Gender;
import com.grandstay.shared.domain.ModelEnums.IdentityDocumentSide;
import com.grandstay.shared.domain.ModelEnums.IdentityType;
import com.grandstay.shared.domain.ModelEnums.IdentityVerificationStatus;
import com.grandstay.shared.exception.BusinessException;
import com.grandstay.shared.exception.ErrorCode;
import com.grandstay.user.domain.User;
import com.grandstay.user.infrastructure.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CustomerProfileApplicationService {
    private static final Pattern VIETNAMESE_PHONE = Pattern.compile("^(?:\\+84|0)(?:3|5|7|8|9)\\d{8}$");
    private static final Pattern NATIONAL_ID = Pattern.compile("^\\d{12}$");
    private static final Pattern PASSPORT = Pattern.compile("^[A-Z0-9]{6,20}$");
    private static final int MAX_DOCUMENT_SIZE = 2 * 1024 * 1024;

    private final CustomerIdentityService identities;
    private final CustomerRepository customers;
    private final CustomerIdentityDocumentRepository documents;
    private final UserRepository users;
    private final CustomerDataCrypto crypto;
    private final Clock clock;

    public CustomerProfileApplicationService(CustomerIdentityService identities, CustomerRepository customers,
            CustomerIdentityDocumentRepository documents, UserRepository users, CustomerDataCrypto crypto, Clock clock) {
        this.identities = identities;
        this.customers = customers;
        this.documents = documents;
        this.users = users;
        this.crypto = crypto;
        this.clock = clock;
    }

    @Transactional
    public CustomerProfile get(UUID userId) { return view(identities.resolve(userId)); }

    @Transactional
    public CustomerProfile update(UUID userId, ProfileCommand command) {
        Customer customer = identities.resolve(userId);
        User user = users.findById(userId).filter(candidate -> candidate.getDeletedAt() == null)
                .orElseThrow(() -> BusinessException.notFound("User", userId));
        String fullName = command.fullName() == null ? "" : command.fullName().trim();
        String email = command.email() == null ? "" : command.email().trim().toLowerCase(Locale.ROOT);
        String phone = blankToNull(command.phone());
        if (fullName.length() < 2 || fullName.length() > 150 || !fullName.matches("^[\\p{L}][\\p{L}\\p{M} .'-]*$")) {
            throw BusinessException.invalid("Full name is invalid");
        }
        if (!email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$") || email.length() > 254) {
            throw BusinessException.invalid("Email is invalid");
        }
        users.findByEmailIgnoreCaseAndDeletedAtIsNull(email)
                .filter(existing -> !existing.getId().equals(userId))
                .ifPresent(existing -> { throw new BusinessException(ErrorCode.EMAIL_TAKEN, HttpStatus.CONFLICT, "Email is already in use"); });
        if (phone != null) {
            phone = phone.replaceAll("[ .-]", "");
            if (!VIETNAMESE_PHONE.matcher(phone).matches()) throw BusinessException.invalid("Vietnamese phone number is invalid");
        }
        if (command.dateOfBirth() != null && !command.dateOfBirth().isBefore(LocalDate.now(clock))) {
            throw BusinessException.invalid("Date of birth must be in the past");
        }
        String nationality = blankToNull(command.nationality());
        if (nationality != null && !nationality.matches("[A-Za-z]{2}")) throw BusinessException.invalid("Nationality must use a two-letter code");

        user.setFullName(fullName); user.setEmail(email); user.setPhone(phone); users.save(user);
        customer.setFullName(fullName); customer.setEmail(email); customer.setPhone(phone);
        customer.setNationality(nationality == null ? null : nationality.toUpperCase(Locale.ROOT));
        customer.setDateOfBirth(command.dateOfBirth()); customer.setGender(command.gender());
        customer.setAddress(limit(blankToNull(command.address()), 500));
        return view(customers.save(customer));
    }

    @Transactional
    public CustomerProfile updateIdentity(UUID userId, IdentityCommand command) {
        Customer customer = identities.resolve(userId);
        applyIdentity(customer, command);
        return view(customers.save(customer));
    }

    @Transactional
    public CustomerProfile updateIdentityForStaff(UUID customerId, IdentityCommand command) {
        Customer customer = requireCustomer(customerId);
        applyIdentity(customer, command);
        return view(customers.save(customer));
    }

    @Transactional
    public CustomerProfile upload(UUID userId, IdentityDocumentSide side, String contentType, byte[] content) {
        Customer customer = identities.resolve(userId);
        saveDocument(customer, side, contentType, content);
        return view(customer);
    }

    @Transactional
    public CustomerProfile uploadForStaff(UUID customerId, IdentityDocumentSide side, String contentType, byte[] content) {
        Customer customer = requireCustomer(customerId);
        saveDocument(customer, side, contentType, content);
        return view(customer);
    }

    @Transactional(readOnly = true)
    public IdentityDocumentContent documentForCustomer(UUID userId, IdentityDocumentSide side) {
        return document(identities.resolve(userId).getId(), side);
    }

    @Transactional(readOnly = true)
    public IdentityDocumentContent documentForStaff(UUID customerId, IdentityDocumentSide side) {
        requireCustomer(customerId);
        return document(customerId, side);
    }

    @Transactional
    public CustomerProfile verify(UUID customerId, UUID staffUserId, VerificationCommand command) {
        Customer customer = requireCustomer(customerId);
        if (customer.getIdentityCiphertext() == null || customer.getIdentityType() == null) {
            throw BusinessException.invalid("Identity number is required before verification");
        }
        long documentCount = documents.countByCustomerId(customerId);
        long required = customer.getIdentityType() == IdentityType.NATIONAL_ID ? 2 : 1;
        if (command.approved() && documentCount < required) {
            throw BusinessException.invalid("Required identity document images are missing");
        }
        customer.setIdentityVerificationStatus(command.approved() ? IdentityVerificationStatus.VERIFIED : IdentityVerificationStatus.REJECTED);
        customer.setIdentityVerifiedAt(command.approved() ? clock.instant() : null);
        customer.setIdentityVerifiedBy(command.approved() ? staffUserId : null);
        customer.setIdentityRejectionReason(command.approved() ? null : limit(blankToNull(command.reason()), 500));
        if (!command.approved() && customer.getIdentityRejectionReason() == null) throw BusinessException.invalid("A rejection reason is required");
        return view(customers.save(customer));
    }

    @Transactional(readOnly = true)
    public CustomerProfile getForStaff(UUID customerId) { return view(requireCustomer(customerId)); }

    private void applyIdentity(Customer customer, IdentityCommand command) {
        if (command == null || command.type() == null || command.number() == null) throw BusinessException.invalid("Identity information is required");
        String normalized = command.number().replaceAll("[\\s.-]", "").toUpperCase(Locale.ROOT);
        boolean valid = switch (command.type()) {
            case NATIONAL_ID -> NATIONAL_ID.matcher(normalized).matches();
            case PASSPORT -> PASSPORT.matcher(normalized).matches();
            case OTHER -> normalized.matches("^[A-Z0-9]{4,30}$");
        };
        if (!valid) throw BusinessException.invalid(command.type() == IdentityType.NATIONAL_ID
                ? "National ID must contain exactly 12 digits" : "Identity document number is invalid");
        String hash = crypto.blindIndex(command.type().name() + ':' + normalized);
        customers.findByIdentityHashAndDeletedAtIsNull(hash)
                .filter(existing -> !existing.getId().equals(customer.getId()))
                .ifPresent(existing -> { throw new BusinessException(ErrorCode.DATA_CONFLICT, HttpStatus.CONFLICT, "Identity document is already registered"); });
        if (!hash.equals(customer.getIdentityHash())) {
            documents.deleteAll(documents.findAllByCustomerId(customer.getId()));
        }
        customer.setIdentityType(command.type()); customer.setIdentityCiphertext(crypto.encryptText(normalized));
        customer.setIdentityHash(hash); customer.setIdentityLastFour(normalized.substring(Math.max(0, normalized.length() - 4)));
        customer.setIdentityVerificationStatus(IdentityVerificationStatus.PENDING);
        customer.setIdentityVerifiedAt(null); customer.setIdentityVerifiedBy(null); customer.setIdentityRejectionReason(null);
    }

    private void saveDocument(Customer customer, IdentityDocumentSide side, String contentType, byte[] content) {
        validateImage(contentType, content);
        CustomerIdentityDocument document = documents.findByCustomerIdAndSide(customer.getId(), side)
                .orElseGet(CustomerIdentityDocument::new);
        document.setCustomerId(customer.getId()); document.setSide(side); document.setContentType(contentType);
        document.setEncryptedContent(crypto.encrypt(content)); document.setContentSize(content.length);
        document.setContentHash(crypto.contentHash(content)); documents.save(document);
        if (customer.getIdentityVerificationStatus() == IdentityVerificationStatus.VERIFIED
                || customer.getIdentityVerificationStatus() == IdentityVerificationStatus.REJECTED) {
            customer.setIdentityVerificationStatus(IdentityVerificationStatus.PENDING);
            customer.setIdentityVerifiedAt(null); customer.setIdentityVerifiedBy(null);
        }
        customers.save(customer);
    }

    private void validateImage(String contentType, byte[] content) {
        if (content == null || content.length == 0 || content.length > MAX_DOCUMENT_SIZE) throw BusinessException.invalid("Identity image must be between 1 byte and 2 MB");
        boolean jpeg = content.length >= 3 && (content[0] & 0xff) == 0xff && (content[1] & 0xff) == 0xd8 && (content[2] & 0xff) == 0xff;
        boolean png = content.length >= 8 && (content[0] & 0xff) == 0x89 && content[1] == 0x50 && content[2] == 0x4e && content[3] == 0x47;
        if (!(jpeg && "image/jpeg".equals(contentType)) && !(png && "image/png".equals(contentType))) {
            throw BusinessException.invalid("Identity image must be a valid JPEG or PNG file");
        }
    }

    private IdentityDocumentContent document(UUID customerId, IdentityDocumentSide side) {
        CustomerIdentityDocument item = documents.findByCustomerIdAndSide(customerId, side)
                .orElseThrow(() -> BusinessException.notFound("Identity document", side));
        return new IdentityDocumentContent(item.getContentType(), crypto.decrypt(item.getEncryptedContent()));
    }

    private Customer requireCustomer(UUID id) {
        return customers.findById(id).filter(item -> item.getDeletedAt() == null)
                .orElseThrow(() -> BusinessException.notFound("Customer", id));
    }

    private CustomerProfile view(Customer customer) {
        List<CustomerIdentityDocument> identityDocuments = documents.findAllByCustomerId(customer.getId());
        boolean front = identityDocuments.stream().anyMatch(item -> item.getSide() == IdentityDocumentSide.FRONT);
        boolean back = identityDocuments.stream().anyMatch(item -> item.getSide() == IdentityDocumentSide.BACK);
        String masked = customer.getIdentityLastFour() == null ? null : "••••••••" + customer.getIdentityLastFour();
        return new CustomerProfile(customer.getId(), customer.getCustomerCode(), customer.getFullName(), customer.getEmail(),
                customer.getPhone(), customer.getNationality(), customer.getDateOfBirth(), customer.getGender(), customer.getAddress(),
                customer.getIdentityType(), masked, customer.getIdentityVerificationStatus(), customer.getIdentityRejectionReason(),
                front, back, customer.getVersion());
    }

    private static String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private static String limit(String value, int maximum) { return value == null ? null : value.substring(0, Math.min(value.length(), maximum)); }

    public record ProfileCommand(String fullName, String email, String phone, String nationality,
                                 LocalDate dateOfBirth, Gender gender, String address) {}
    public record IdentityCommand(IdentityType type, String number) {}
    public record VerificationCommand(boolean approved, String reason) {}
    public record IdentityDocumentContent(String contentType, byte[] content) {}
    public record CustomerProfile(UUID id, String customerCode, String fullName, String email, String phone,
            String nationality, LocalDate dateOfBirth, Gender gender, String address, IdentityType identityType,
            String identityMasked, IdentityVerificationStatus identityVerificationStatus,
            String identityRejectionReason, boolean identityFrontUploaded, boolean identityBackUploaded, long version) {}
}
