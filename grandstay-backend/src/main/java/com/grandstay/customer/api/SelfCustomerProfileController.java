package com.grandstay.customer.api;

import java.io.IOException;
import java.time.LocalDate;
import java.util.UUID;

import com.grandstay.customer.application.CustomerProfileApplicationService;
import com.grandstay.customer.application.CustomerProfileApplicationService.CustomerProfile;
import com.grandstay.customer.application.CustomerProfileApplicationService.IdentityCommand;
import com.grandstay.customer.application.CustomerProfileApplicationService.ProfileCommand;
import com.grandstay.shared.domain.ModelEnums.Gender;
import com.grandstay.shared.domain.ModelEnums.IdentityDocumentSide;
import com.grandstay.shared.domain.ModelEnums.IdentityType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/self/profile")
@PreAuthorize("hasRole('CUSTOMER')")
public class SelfCustomerProfileController {
    private final CustomerProfileApplicationService service;
    public SelfCustomerProfileController(CustomerProfileApplicationService service) { this.service = service; }

    @GetMapping public CustomerProfile get(@AuthenticationPrincipal Jwt jwt) { return service.get(userId(jwt)); }

    @PutMapping public CustomerProfile update(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ProfileRequest request) {
        return service.update(userId(jwt), new ProfileCommand(request.fullName(), request.email(), request.phone(),
                request.nationality(), request.dateOfBirth(), request.gender(), request.address()));
    }

    @PutMapping("/identity")
    public CustomerProfile identity(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody IdentityRequest request) {
        return service.updateIdentity(userId(jwt), new IdentityCommand(request.type(), request.number()));
    }

    @PutMapping(value = "/identity/documents/{side}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public CustomerProfile upload(@AuthenticationPrincipal Jwt jwt, @PathVariable IdentityDocumentSide side,
                                  @RequestPart("file") MultipartFile file) throws IOException {
        return service.upload(userId(jwt), side, file.getContentType(), file.getBytes());
    }

    @GetMapping("/identity/documents/{side}")
    public ResponseEntity<byte[]> document(@AuthenticationPrincipal Jwt jwt, @PathVariable IdentityDocumentSide side) {
        var document = service.documentForCustomer(userId(jwt), side);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(MediaType.parseMediaType(document.contentType()))
                .header("Content-Disposition", "inline; filename=identity-" + side.name().toLowerCase() + ".bin")
                .body(document.content());
    }

    private UUID userId(Jwt jwt) { return UUID.fromString(jwt.getSubject()); }

    public record ProfileRequest(@NotBlank @Size(min=2,max=150) String fullName,
            @NotBlank @Email @Size(max=254) String email,
            @Pattern(regexp="^(?:\\+84|0)(?:3|5|7|8|9)\\d{8}$") String phone,
            @Pattern(regexp="[A-Za-z]{2}") String nationality, @Past LocalDate dateOfBirth,
            Gender gender, @Size(max=500) String address) {}
    public record IdentityRequest(@NotNull IdentityType type, @NotBlank @Size(min=4,max=30) String number) {}
}
