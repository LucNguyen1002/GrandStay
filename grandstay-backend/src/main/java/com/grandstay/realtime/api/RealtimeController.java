package com.grandstay.realtime.api;

import com.grandstay.realtime.application.RealtimeUpdateHub;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/v1/realtime")
public class RealtimeController {
    private final RealtimeUpdateHub hub;

    public RealtimeController(RealtimeUpdateHub hub) {
        this.hub = hub;
    }

    @GetMapping("/handshake")
    public ResponseEntity<Void> handshake() {
        return ResponseEntity.noContent().build();
    }

    @GetMapping(path = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<SseEmitter> stream() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .header(HttpHeaders.VARY, HttpHeaders.AUTHORIZATION)
                .header("X-Accel-Buffering", "no")
                .body(hub.subscribe());
    }
}
