package com.grandstay.auth.application;

import com.grandstay.shared.exception.BusinessException;
import com.grandstay.shared.exception.ErrorCode;
import org.springframework.http.HttpStatus;

public class AuthenticationFailureException extends BusinessException {
    public AuthenticationFailureException() {
        super(ErrorCode.INVALID_CREDENTIALS, HttpStatus.UNAUTHORIZED, "Invalid username or password");
    }
}
