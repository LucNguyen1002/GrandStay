package com.grandstay.customer.application;

import java.util.Optional;
import java.util.UUID;

import com.grandstay.customer.domain.Customer;
import com.grandstay.customer.infrastructure.CustomerRepository;
import com.grandstay.shared.domain.ModelEnums.UserStatus;
import com.grandstay.user.domain.User;
import com.grandstay.user.infrastructure.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CustomerIdentityServiceTest {
    @Mock CustomerRepository customers;
    @Mock UserRepository users;

    @Test
    void linksAnExistingCustomerProfileByEmail() {
        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        user.setEmail("guest@grandstay.test");
        user.setFullName("GrandStay Guest");
        user.setStatus(UserStatus.ACTIVE);
        Customer customer = new Customer();
        customer.setId(UUID.randomUUID());
        customer.setCustomerCode("CUS-EXISTING");
        customer.setFullName("GrandStay Guest");
        customer.setEmail(user.getEmail());

        when(customers.findByUserIdAndDeletedAtIsNull(userId)).thenReturn(Optional.empty());
        when(users.findById(userId)).thenReturn(Optional.of(user));
        when(customers.findFirstByEmailIgnoreCaseAndDeletedAtIsNullOrderByCreatedAtAsc(user.getEmail()))
                .thenReturn(Optional.of(customer));
        when(customers.saveAndFlush(customer)).thenReturn(customer);

        Customer resolved = new CustomerIdentityService(customers, users).resolve(userId);

        assertThat(resolved.getUserId()).isEqualTo(userId);
        assertThat(resolved.getCustomerCode()).isEqualTo("CUS-EXISTING");
        verify(customers).saveAndFlush(customer);
    }
}
