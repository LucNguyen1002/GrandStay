package com.grandstay.customer.application;

import java.nio.ByteBuffer;
import java.util.Base64;
import java.util.UUID;

import com.grandstay.customer.domain.Customer;
import com.grandstay.customer.infrastructure.CustomerRepository;
import com.grandstay.shared.domain.ModelEnums.UserStatus;
import com.grandstay.shared.exception.BusinessException;
import com.grandstay.user.domain.User;
import com.grandstay.user.infrastructure.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CustomerIdentityService {
    private final CustomerRepository customers;
    private final UserRepository users;

    public CustomerIdentityService(CustomerRepository customers, UserRepository users) {
        this.customers = customers;
        this.users = users;
    }

    @Transactional
    public Customer resolve(UUID userId) {
        if (userId == null) throw BusinessException.invalid("Authenticated user is required");
        return customers.findByUserIdAndDeletedAtIsNull(userId).orElseGet(() -> linkOrCreate(userId));
    }

    private Customer linkOrCreate(UUID userId) {
        User user = users.findById(userId)
                .filter(candidate -> candidate.getDeletedAt() == null
                        && candidate.getStatus() == UserStatus.ACTIVE)
                .orElseThrow(() -> BusinessException.notFound("User", userId));

        Customer customer = customers
                .findFirstByEmailIgnoreCaseAndDeletedAtIsNullOrderByCreatedAtAsc(user.getEmail())
                .filter(candidate -> candidate.getUserId() == null || userId.equals(candidate.getUserId()))
                .orElseGet(Customer::new);
        if (customer.getId() == null) {
            customer.setCustomerCode(customerCode(userId));
            customer.setFullName(user.getFullName());
            customer.setEmail(user.getEmail());
            customer.setPhone(user.getPhone());
            customer.setNationality("VN");
        }
        customer.setUserId(userId);
        return customers.saveAndFlush(customer);
    }

    private String customerCode(UUID userId) {
        ByteBuffer bytes = ByteBuffer.allocate(16)
                .putLong(userId.getMostSignificantBits())
                .putLong(userId.getLeastSignificantBits());
        return "WEB-" + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes.array());
    }
}
