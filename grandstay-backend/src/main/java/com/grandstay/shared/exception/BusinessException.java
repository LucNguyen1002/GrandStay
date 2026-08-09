package com.grandstay.shared.exception;

import org.springframework.http.HttpStatus;

public class BusinessException extends RuntimeException {
    private final ErrorCode errorCode;
    private final HttpStatus status;

    public BusinessException(ErrorCode errorCode, HttpStatus status, String message) {
        super(message);
        this.errorCode = errorCode;
        this.status = status;
    }

    public ErrorCode getErrorCode() { return errorCode; }
    public HttpStatus getStatus() { return status; }

    public static BusinessException notFound(String resource, Object id) {
        return new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, HttpStatus.NOT_FOUND,
                resource + " not found: " + id);
    }

    public static BusinessException conflict(ErrorCode code, String message) {
        return new BusinessException(code, HttpStatus.CONFLICT, message);
    }

    public static BusinessException invalid(String message) {
        return new BusinessException(ErrorCode.VALIDATION_FAILED, HttpStatus.UNPROCESSABLE_ENTITY, message);
    }
}
