package com.likhith.helfen.ai.service;

import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

@Service
public class RabbitMQService {

    private final RabbitTemplate rabbitTemplate;
    public static final String QUEUE_NAME = "helfen.ai.events";

    public RabbitMQService(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    public void publishEvent(String eventType, Object data) {
        // Simple JSON-like representation or you can use JacksonMessageConverter
        String message = String.format("{\"event\":\"%s\", \"timestamp\":\"%s\"}", eventType, java.time.Instant.now().toString());
        rabbitTemplate.convertAndSend(QUEUE_NAME, message);
    }
}
