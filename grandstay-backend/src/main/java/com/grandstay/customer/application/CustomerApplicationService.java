package com.grandstay.customer.application;

import java.time.LocalDate;
import java.time.Clock;
import java.util.Locale;
import java.util.UUID;

import com.grandstay.customer.domain.Customer;
import com.grandstay.customer.infrastructure.CustomerRepository;
import com.grandstay.shared.domain.ModelEnums.Gender;
import com.grandstay.shared.dto.EntityDtos.CustomerDto;
import com.grandstay.shared.exception.BusinessException;
import com.grandstay.shared.infrastructure.mapping.EntityMapper;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CustomerApplicationService {
    private final CustomerRepository repository; private final EntityMapper mapper; private final Clock clock;
    public CustomerApplicationService(CustomerRepository repository, EntityMapper mapper, Clock clock) {
        this.repository = repository; this.mapper = mapper; this.clock = clock;
    }
    @Transactional(readOnly=true) public Page<CustomerDto> list(String search, Pageable pageable) {
        return (search == null || search.isBlank() ? repository.findAllByDeletedAtIsNull(pageable)
                : repository.searchActive(search.trim(), pageable)).map(mapper::toDto);
    }
    @Transactional(readOnly=true) public CustomerDto get(UUID id) { return repository.findById(id).filter(c -> c.getDeletedAt()==null)
            .map(mapper::toDto).orElseThrow(() -> BusinessException.notFound("Customer", id)); }
    @Transactional public CustomerDto create(CustomerCommand c) {
        Customer entity = new Customer(); apply(entity,c); return mapper.toDto(repository.save(entity));
    }
    @Transactional public CustomerDto update(UUID id, CustomerCommand c) {
        Customer entity=repository.findById(id).filter(x->x.getDeletedAt()==null)
                .orElseThrow(()->BusinessException.notFound("Customer",id)); apply(entity,c); return mapper.toDto(repository.save(entity));
    }
    @Transactional public void delete(UUID id) { Customer entity=repository.findById(id).filter(x->x.getDeletedAt()==null)
            .orElseThrow(()->BusinessException.notFound("Customer",id)); entity.setDeletedAt(clock.instant()); repository.save(entity); }
    private void apply(Customer e, CustomerCommand c) {
        e.setCustomerCode(c.customerCode().trim().toUpperCase(Locale.ROOT)); e.setFullName(c.fullName().trim());
        e.setEmail(c.email()); e.setPhone(c.phone()); e.setNationality(c.nationality()==null?null:c.nationality().toUpperCase(Locale.ROOT));
        e.setDateOfBirth(c.dateOfBirth()); e.setGender(c.gender()); e.setAddress(c.address()); e.setNotes(c.notes());
    }
    public record CustomerCommand(String customerCode,String fullName,String email,String phone,String nationality,
                                  LocalDate dateOfBirth,Gender gender,String address,String notes) {}
}
