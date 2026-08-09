package com.grandstay.auth.application;

import com.grandstay.shared.exception.BusinessException;
import com.grandstay.shared.exception.ErrorCode;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class GoogleIdentityVerifierTest {
    @Test
    void reportsUnavailableWhenGoogleClientIdIsNotConfigured() {
        GoogleAuthProperties properties = new GoogleAuthProperties();
        GoogleIdentityVerifier verifier = new GoogleIdentityVerifier(properties);

        assertThatThrownBy(() -> verifier.verify("credential"))
                .isInstanceOfSatisfying(BusinessException.class, exception -> {
                    assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.GOOGLE_AUTH_UNAVAILABLE);
                    assertThat(exception.getStatus().value()).isEqualTo(503);
                });
    }
}
