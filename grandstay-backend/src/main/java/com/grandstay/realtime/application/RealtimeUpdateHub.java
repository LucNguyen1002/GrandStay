package com.grandstay.realtime.application;

import java.io.IOException;
import java.time.Clock;
import java.time.Instant;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArraySet;
import java.util.concurrent.atomic.AtomicLong;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Component
public class RealtimeUpdateHub {
    private static final long CONNECTION_TIMEOUT_MILLIS = 10 * 60 * 1000L;

    private final Set<SseEmitter> subscribers = new CopyOnWriteArraySet<>();
    private final AtomicLong sequence = new AtomicLong();
    private final Clock clock;

    public RealtimeUpdateHub(Clock clock) {
        this.clock = clock;
    }

    public SseEmitter subscribe() {
        SseEmitter emitter = new SseEmitter(CONNECTION_TIMEOUT_MILLIS);
        subscribers.add(emitter);
        emitter.onCompletion(() -> subscribers.remove(emitter));
        emitter.onTimeout(() -> subscribers.remove(emitter));
        emitter.onError(error -> subscribers.remove(emitter));
        send(emitter, SseEmitter.event()
                .name("connected")
                .reconnectTime(3_000)
                .data(new RealtimeUpdate(sequence.get(), "connected", clock.instant())));
        return emitter;
    }

    public void publish(String resource) {
        RealtimeUpdate update = new RealtimeUpdate(sequence.incrementAndGet(), resource, clock.instant());
        subscribers.forEach(emitter -> send(emitter, SseEmitter.event().name("update").data(update)));
    }

    @Scheduled(fixedDelay = 25_000)
    void keepConnectionsAlive() {
        subscribers.forEach(emitter -> send(emitter, SseEmitter.event().comment("keep-alive")));
    }

    private void send(SseEmitter emitter, SseEmitter.SseEventBuilder event) {
        try {
            emitter.send(event);
        } catch (IOException | IllegalStateException exception) {
            subscribers.remove(emitter);
            emitter.complete();
        }
    }

    public record RealtimeUpdate(long sequence, String resource, Instant occurredAt) {}
}
