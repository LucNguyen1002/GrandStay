package com.grandstay.user.api;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import com.grandstay.auth.application.AuthApplicationService;
import com.grandstay.shared.domain.ModelEnums.UserStatus;
import com.grandstay.shared.dto.EntityDtos.UserDto;
import com.grandstay.user.application.UserAdminApplicationService;
import com.grandstay.user.application.UserAdminApplicationService.CreateUser;
import com.grandstay.user.application.UserAdminApplicationService.UpdateUser;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/users")
@Tag(name = "Users")
@PreAuthorize("hasRole('ADMIN')")
public class UserController {
    private final UserAdminApplicationService users;
    private final AuthApplicationService auth;

    public UserController(UserAdminApplicationService users, AuthApplicationService auth) {
        this.users = users;
        this.auth = auth;
    }

    @GetMapping
    public Page<UserDto> list(@RequestParam(required = false) UserStatus status,
                              @ParameterObject @PageableDefault(size = 20, sort = "username") Pageable pageable) {
        return users.list(status, pageable);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserDto create(@Valid @RequestBody CreateUserRequest request) {
        return users.create(new CreateUser(request.username(), request.email(), request.fullName(),
                request.phone(), request.password(), request.status(), request.roles()));
    }

    @PutMapping("/{id}")
    public UserDto update(@PathVariable UUID id, @Valid @RequestBody UpdateUserRequest request,
                          @AuthenticationPrincipal Jwt jwt) {
        UUID actingUserId = UUID.fromString(jwt.getSubject());
        if (id.equals(actingUserId)
                && (request.status() != UserStatus.ACTIVE || !request.roles().contains("ADMIN"))) {
            throw com.grandstay.shared.exception.BusinessException.invalid(
                    "Administrators cannot remove their own access");
        }
        UserDto updated = users.update(id, new UpdateUser(request.email(), request.fullName(), request.phone(),
                request.password(), request.status(), request.roles()));
        if ((request.password() != null && !request.password().isBlank()) || request.status() != UserStatus.ACTIVE) {
            auth.revokeAllSessions(id);
        }
        return updated;
    }

    @GetMapping("/{id}/roles")
    public List<String> roles(@PathVariable UUID id) {
        return users.roles(id);
    }

    @GetMapping("/{id}/sessions")
    public List<AuthApplicationService.SessionView> sessions(@PathVariable UUID id) {
        return auth.sessions(id);
    }

    @DeleteMapping("/{id}/sessions/{familyId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revokeSession(@PathVariable UUID id, @PathVariable UUID familyId) {
        auth.revokeSession(id, familyId);
    }

    @PostMapping("/{id}/lock")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void lock(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        users.lock(id, UUID.fromString(jwt.getSubject()));
        auth.revokeAllSessions(id);
    }

    @PostMapping("/{id}/unlock")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unlock(@PathVariable UUID id) {
        users.unlock(id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        users.delete(id);
        auth.revokeAllSessions(id);
    }

    @PostMapping("/{id}/revoke-sessions")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revoke(@PathVariable UUID id) {
        auth.revokeAllSessions(id);
    }

    public record CreateUserRequest(
            @NotBlank @Size(max = 80) String username,
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank @Size(max = 150) String fullName,
            @Size(max = 30) String phone,
            @NotBlank @Size(min = 12, max = 72) String password,
            @NotNull UserStatus status,
            @NotEmpty Set<@Pattern(regexp = "ADMIN|MANAGER|RECEPTIONIST|CUSTOMER") String> roles) {
    }

    public record UpdateUserRequest(
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank @Size(max = 150) String fullName,
            @Size(max = 30) String phone,
            @Size(min = 12, max = 72) String password,
            @NotNull UserStatus status,
            @NotEmpty Set<@Pattern(regexp = "ADMIN|MANAGER|RECEPTIONIST|CUSTOMER") String> roles) {
    }
}
