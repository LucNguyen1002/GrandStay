package com.grandstay.customer.api;

import java.io.IOException;
import java.time.LocalDate;
import java.util.UUID;

import com.grandstay.customer.application.CustomerApplicationService;
import com.grandstay.customer.application.CustomerApplicationService.CustomerCommand;
import com.grandstay.customer.application.CustomerProfileApplicationService;
import com.grandstay.customer.application.CustomerProfileApplicationService.CustomerProfile;
import com.grandstay.customer.application.CustomerProfileApplicationService.IdentityCommand;
import com.grandstay.customer.application.CustomerProfileApplicationService.VerificationCommand;
import com.grandstay.shared.domain.ModelEnums.Gender;
import com.grandstay.shared.domain.ModelEnums.IdentityDocumentSide;
import com.grandstay.shared.domain.ModelEnums.IdentityType;
import com.grandstay.shared.dto.EntityDtos.CustomerDto;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/customers")
@Tag(name = "Customers")
public class CustomerController {
    private final CustomerApplicationService service;
    private final CustomerProfileApplicationService profiles;

    public CustomerController(CustomerApplicationService service, CustomerProfileApplicationService profiles) {
        this.service = service;
        this.profiles = profiles;
    }

    @GetMapping @PreAuthorize("hasAuthority('booking:read')")
    public Page<CustomerDto> list(@RequestParam(required=false) String search,
            @ParameterObject @PageableDefault(size=20,sort="fullName") Pageable pageable) {
        return service.list(search, pageable);
    }

    @GetMapping("/{id}") @PreAuthorize("hasAuthority('booking:read')")
    public CustomerDto get(@PathVariable UUID id) { return service.get(id); }

    @GetMapping("/{id}/profile") @PreAuthorize("hasAuthority('booking:read')")
    public CustomerProfile profile(@PathVariable UUID id) { return profiles.getForStaff(id); }

    @PostMapping @ResponseStatus(HttpStatus.CREATED) @PreAuthorize("hasAuthority('booking:write')")
    public CustomerDto create(@Valid @RequestBody CustomerRequest request) { return service.create(request.command()); }

    @PutMapping("/{id}") @PreAuthorize("hasAuthority('booking:write')")
    public CustomerDto update(@PathVariable UUID id, @Valid @RequestBody CustomerRequest request) {
        return service.update(id, request.command());
    }

    @PutMapping("/{id}/identity") @PreAuthorize("hasAuthority('booking:write')")
    public CustomerProfile identity(@PathVariable UUID id, @Valid @RequestBody IdentityRequest request) {
        return profiles.updateIdentityForStaff(id, new IdentityCommand(request.type(), request.number()));
    }

    @PutMapping(value="/{id}/identity/documents/{side}", consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('booking:write')")
    public CustomerProfile upload(@PathVariable UUID id, @PathVariable IdentityDocumentSide side,
                                  @RequestPart("file") MultipartFile file) throws IOException {
        return profiles.uploadForStaff(id, side, file.getContentType(), file.getBytes());
    }

    @GetMapping("/{id}/identity/documents/{side}") @PreAuthorize("hasAuthority('booking:read')")
    public ResponseEntity<byte[]> document(@PathVariable UUID id, @PathVariable IdentityDocumentSide side) {
        var document = profiles.documentForStaff(id, side);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .contentType(MediaType.parseMediaType(document.contentType()))
                .header("Content-Disposition", "inline; filename=identity-" + side.name().toLowerCase() + ".bin")
                .body(document.content());
    }

    @PostMapping("/{id}/identity/verification") @PreAuthorize("hasAuthority('booking:write')")
    public CustomerProfile verify(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt,
                                  @Valid @RequestBody VerificationRequest request) {
        return profiles.verify(id, UUID.fromString(jwt.getSubject()), new VerificationCommand(request.approved(), request.reason()));
    }

    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) @PreAuthorize("hasAuthority('booking:write')")
    public void delete(@PathVariable UUID id) { service.delete(id); }

    public record CustomerRequest(@NotBlank @Size(max=30) String customerCode,
            @NotBlank @Size(max=150) String fullName, @Email @Size(max=254) String email,
            @Pattern(regexp="^(?:\\+84|0)(?:3|5|7|8|9)\\d{8}$") String phone,
            @Pattern(regexp="[A-Za-z]{2}") String nationality, @Past LocalDate dateOfBirth,
            Gender gender, @Size(max=500) String address, @Size(max=1000) String notes) {
        CustomerCommand command() { return new CustomerCommand(customerCode, fullName, email, phone, nationality, dateOfBirth, gender, address, notes); }
    }
    public record IdentityRequest(@NotNull IdentityType type, @NotBlank @Size(min=4,max=30) String number) {}
    public record VerificationRequest(boolean approved, @Size(max=500) String reason) {}
}
