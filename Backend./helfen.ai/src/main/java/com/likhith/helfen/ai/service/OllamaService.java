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
        // Retrieve context from Redis for current conversation
        String memoryContext = redisService.getConversationContext(request.getConversationId());
        
        StringBuilder systemPromptBuilder = new StringBuilder();
        systemPromptBuilder.append("You are Helfen AI, a helpful, harmless, and honest AI assistant. You provide clear, concise, and accurate responses.");

        // If this conversation is a continuation of an earlier conversation, inject continuation context
        if (request.getContinuationContext() != null && !request.getContinuationContext().isBlank()) {
            systemPromptBuilder.append("\n\n").append(request.getContinuationContext());
        } else if (request.getParentConversationId() != null && !request.getParentConversationId().equals("temp")) {
            // Check if parent conversation has context cached in Redis
            String parentMemory = redisService.getConversationContext(request.getParentConversationId());
            if (parentMemory != null && !parentMemory.isBlank()) {
                systemPromptBuilder.append("\n\nContext carried over from previous session:\n").append(parentMemory);
            }
        }

        if (memoryContext != null && !memoryContext.isEmpty()) {
            systemPromptBuilder.append("\n\nContext from current interactions:\n").append(memoryContext);
        }

        // If RAG knowledge base context is provided, inject with grounding directives
        if (request.getRagContext() != null && !request.getRagContext().isBlank()) {
            systemPromptBuilder.append("\n\n").append(request.getRagContext());
            systemPromptBuilder.append("\nCRITICAL GROUNDING DIRECTIVE: Base your answers on the retrieved knowledge excerpts above. Cite specific source names and chunks when stating facts. If the excerpts do not contain enough information to answer fully, state what is known from the sources and clarify any missing details.");
        }

        String systemPrompt = systemPromptBuilder.toString();

        List<Map<String, Object>> ollamaMessages = new ArrayList<>();
        
        Map<String, Object> sysMsg = new HashMap<>();
        sysMsg.put("role", "system");
        sysMsg.put("content", systemPrompt);
        ollamaMessages.add(sysMsg);

        boolean hasImages = false;
        for (ChatMessage m : request.getMessages()) {
            Map<String, Object> msg = new HashMap<>();
            msg.put("role", m.getRole());
            msg.put("content", m.getContent());
            if (m.getImages() != null && !m.getImages().isEmpty()) {
                msg.put("images", m.getImages());
                hasImages = true;
            }
            ollamaMessages.add(msg);
        }

        if (request.getImages() != null && !request.getImages().isEmpty()) {
            hasImages = true;
            for (int i = ollamaMessages.size() - 1; i >= 0; i--) {
                if ("user".equals(ollamaMessages.get(i).get("role"))) {
                    ollamaMessages.get(i).put("images", request.getImages());
                    break;
                }
            }
        }

        String chosenModel = request.getModel() != null ? request.getModel() : "llama3.2:3b";
        // If images are attached and user is on standard text llama3.2:3b, gracefully switch to vision model if configured
        if (hasImages && "llama3.2:3b".equals(chosenModel)) {
            chosenModel = "llama3.2-vision";
        }

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", chosenModel);
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
