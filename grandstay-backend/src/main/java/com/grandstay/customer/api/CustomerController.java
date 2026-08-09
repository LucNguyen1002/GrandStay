package com.grandstay.customer.api;
import java.time.LocalDate; import java.util.UUID; import com.grandstay.customer.application.CustomerApplicationService; import com.grandstay.customer.application.CustomerApplicationService.CustomerCommand; import com.grandstay.shared.domain.ModelEnums.Gender; import com.grandstay.shared.dto.EntityDtos.CustomerDto;
import io.swagger.v3.oas.annotations.tags.Tag; import jakarta.validation.Valid; import jakarta.validation.constraints.*; import org.springdoc.core.annotations.ParameterObject; import org.springframework.data.domain.*; import org.springframework.data.web.PageableDefault; import org.springframework.http.HttpStatus; import org.springframework.security.access.prepost.PreAuthorize; import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/v1/customers") @Tag(name="Customers")
public class CustomerController {
 private final CustomerApplicationService service; public CustomerController(CustomerApplicationService service){this.service=service;}
 @GetMapping @PreAuthorize("hasAuthority('booking:read')") public Page<CustomerDto> list(@RequestParam(required=false) String search,@ParameterObject @PageableDefault(size=20,sort="fullName") Pageable pageable){return service.list(search,pageable);}
 @GetMapping("/{id}") @PreAuthorize("hasAuthority('booking:read')") public CustomerDto get(@PathVariable UUID id){return service.get(id);}
 @PostMapping @ResponseStatus(HttpStatus.CREATED) @PreAuthorize("hasAuthority('booking:write')") public CustomerDto create(@Valid @RequestBody CustomerRequest r){return service.create(r.command());}
 @PutMapping("/{id}") @PreAuthorize("hasAuthority('booking:write')") public CustomerDto update(@PathVariable UUID id,@Valid @RequestBody CustomerRequest r){return service.update(id,r.command());}
 @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) @PreAuthorize("hasAuthority('booking:write')") public void delete(@PathVariable UUID id){service.delete(id);}
 public record CustomerRequest(@NotBlank @Size(max=30) String customerCode,@NotBlank @Size(max=150) String fullName,
  @Email @Size(max=254) String email,@Size(max=30) String phone,@Pattern(regexp="[A-Za-z]{2}") String nationality,
  @Past LocalDate dateOfBirth,Gender gender,@Size(max=500) String address,@Size(max=1000) String notes){CustomerCommand command(){return new CustomerCommand(customerCode,fullName,email,phone,nationality,dateOfBirth,gender,address,notes);}}
}
