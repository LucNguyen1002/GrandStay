package com.grandstay.auth.application;

import com.grandstay.shared.exception.BusinessException;
import com.grandstay.shared.exception.ErrorCode;
import org.springframework.http.HttpStatus;

public class RefreshTokenReuseException extends BusinessException {
    public RefreshTokenReuseException() {
        super(ErrorCode.TOKEN_REUSED, HttpStatus.UNAUTHORIZED,
                "Refresh token reuse detected; the token family has been revoked");
    }
}
