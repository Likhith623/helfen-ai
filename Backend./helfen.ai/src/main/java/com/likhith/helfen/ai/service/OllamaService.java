package com.likhith.helfen.ai.service;

import com.likhith.helfen.ai.dto.ChatMessage;
import com.likhith.helfen.ai.dto.ChatRequest;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class OllamaService {

    private final WebClient ollamaWebClient;
    private final RedisService redisService;
    private final RabbitMQService rabbitMQService;

    public OllamaService(@Qualifier("ollamaWebClient") WebClient ollamaWebClient,
                         RedisService redisService,
                         RabbitMQService rabbitMQService) {
        this.ollamaWebClient = ollamaWebClient;
        this.redisService = redisService;
        this.rabbitMQService = rabbitMQService;
    }

    public Flux<String> streamChat(ChatRequest request) {
        // Retrieve context from Redis
        String memoryContext = redisService.getConversationContext(request.getConversationId());
        
        String systemPrompt = "You are Helfen AI, a helpful, harmless, and honest AI assistant. You provide clear, concise, and accurate responses.";
        if (memoryContext != null && !memoryContext.isEmpty()) {
            systemPrompt += "\n\nContext from previous interactions:\n" + memoryContext;
        }

        List<Map<String, Object>> ollamaMessages = new ArrayList<>();
        
        Map<String, Object> sysMsg = new HashMap<>();
        sysMsg.put("role", "system");
        sysMsg.put("content", systemPrompt);
        ollamaMessages.add(sysMsg);

        for (ChatMessage m : request.getMessages()) {
            Map<String, Object> msg = new HashMap<>();
            msg.put("role", m.getRole());
            msg.put("content", m.getContent());
            ollamaMessages.add(msg);
        }

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", request.getModel() != null ? request.getModel() : "llama3.2:3b");
        requestBody.put("messages", ollamaMessages);
        requestBody.put("stream", true);

        Map<String, Object> options = new HashMap<>();
        options.put("temperature", 0.7);
        options.put("top_p", 0.9);
        requestBody.put("options", options);

        // Notify RabbitMQ that a chat has started
        rabbitMQService.publishEvent("CHAT_STARTED", request.getConversationId());

        return ollamaWebClient.post()
                .uri("/api/chat")
                .bodyValue(requestBody)
                .retrieve()
                .bodyToFlux(String.class);
    }
}
