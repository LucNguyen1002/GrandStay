package com.grandstay.shared.exception;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    ProblemDetail handleBusiness(BusinessException exception, HttpServletRequest request) {
        ProblemDetail problem = problem(exception.getStatus(), exception.getErrorCode().name(),
                exception.getMessage(), request);
        return problem;
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ProblemDetail handleValidation(MethodArgumentNotValidException exception, HttpServletRequest request) {
        ProblemDetail problem = problem(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED.name(),
                "Request validation failed", request);
        Map<String, String> errors = new LinkedHashMap<>();
        exception.getBindingResult().getFieldErrors()
                .forEach(error -> errors.putIfAbsent(error.getField(), error.getDefaultMessage()));
        problem.setProperty("errors", errors);
        return problem;
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ProblemDetail handleDataConflict(DataIntegrityViolationException exception, HttpServletRequest request) {
        String message = isOverlapViolation(exception)
                ? "One or more rooms are no longer available for the selected period"
                : "The operation conflicts with existing data";
        ErrorCode code = isOverlapViolation(exception) ? ErrorCode.ROOM_NOT_AVAILABLE : ErrorCode.DATA_CONFLICT;
        return problem(HttpStatus.CONFLICT, code.name(), message, request);
    }

    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    ProblemDetail handleOptimisticLock(ObjectOptimisticLockingFailureException exception,
                                        HttpServletRequest request) {
        return problem(HttpStatus.CONFLICT, ErrorCode.CONCURRENT_MODIFICATION.name(),
                "The resource was modified by another request; reload and retry", request);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ProblemDetail handleUploadTooLarge(MaxUploadSizeExceededException exception,
                                       HttpServletRequest request) {
        return problem(HttpStatus.PAYLOAD_TOO_LARGE, ErrorCode.VALIDATION_FAILED.name(),
                "Avatar image must not exceed 2 MB", request);
    }

    private static boolean isOverlapViolation(Throwable throwable) {
        Throwable current = throwable;
        while (current != null) {
            if (current.getMessage() != null && current.getMessage().contains("booking_rooms_no_overlap")) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }

    private static ProblemDetail problem(HttpStatus status, String code, String detail,
                                         HttpServletRequest request) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setTitle(status.getReasonPhrase());
        problem.setType(URI.create("https://grandstay.local/problems/" + code.toLowerCase()));
        problem.setInstance(URI.create(request.getRequestURI()));
        problem.setProperty("code", code);
        return problem;
    }
}
