package com.likhith.helfen.ai.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.likhith.helfen.ai.dto.ChatRequest;
import com.likhith.helfen.ai.dto.InlineChatRequest;
import com.likhith.helfen.ai.service.OllamaService;
import com.likhith.helfen.ai.service.RedisService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

@RestController
@RequestMapping("/api/v1")
public class ChatController {

    private final OllamaService ollamaService;
    private final RedisService redisService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ChatController(OllamaService ollamaService, RedisService redisService) {
        this.ollamaService = ollamaService;
        this.redisService = redisService;
    }

    @PostMapping(value = "/chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<String> chat(@RequestBody ChatRequest request) {
        StringBuilder fullResponse = new StringBuilder();

        return ollamaService.streamChat(request)
                .map(chunk -> {
                    try {
                        JsonNode node = objectMapper.readTree(chunk);
                        if (node.has("message") && node.get("message").has("content")) {
                            String content = node.get("message").get("content").asText();
                            fullResponse.append(content);
                            
                            // Format as SSE data
                            String sseData = String.format("{\"content\": %s, \"done\": false}", 
                                    objectMapper.writeValueAsString(content));
                            return sseData;
                        }
                        
                        if (node.has("done") && node.get("done").asBoolean()) {
                            // Caching context to Redis
                            if (!request.isTemporary()) {
                                String summary = fullResponse.length() > 500 ? fullResponse.substring(0, 500) : fullResponse.toString();
                                String cacheData = String.format("{\"lastUpdated\": \"%s\", \"summary\": %s}", 
                                        java.time.Instant.now().toString(), objectMapper.writeValueAsString(summary));
                                redisService.cacheConversationContext(request.getConversationId(), cacheData);
                            }
                            return "{\"content\": \"\", \"done\": true}";
                        }
                    } catch (JsonProcessingException e) {
                        // ignore parse errors
                    }
                    return "";
                })
                .filter(s -> !s.isEmpty());
    }

    @PostMapping(value = "/inline-chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<String> inlineChat(@RequestBody InlineChatRequest request) {
        
        ChatRequest chatReq = new ChatRequest();
        chatReq.setModel(request.getModel());
        chatReq.setConversationId(request.getConversationId());
        
        String systemPrompt = String.format("You are a helpful AI assistant. The user has selected a specific piece of text from a response and has a question about it. Answer concisely and clearly.\n\nSelected text: \"%s\"\n\nProvide a focused, helpful answer to the user's question about this selected text. Keep your response concise (2-4 sentences max unless detail is needed).", request.getSelectedText());
        
        com.likhith.helfen.ai.dto.ChatMessage sysMsg = new com.likhith.helfen.ai.dto.ChatMessage("system", systemPrompt);
        com.likhith.helfen.ai.dto.ChatMessage userMsg = new com.likhith.helfen.ai.dto.ChatMessage("user", request.getQuestion());
        
        chatReq.setMessages(java.util.List.of(sysMsg, userMsg));
        chatReq.setTemporary(true); // don't cache inline chats

        return ollamaService.streamChat(chatReq)
                .map(chunk -> {
                    try {
                        JsonNode node = objectMapper.readTree(chunk);
                        if (node.has("message") && node.get("message").has("content")) {
                            String content = node.get("message").get("content").asText();
                            String sseData = String.format("{\"content\": %s, \"done\": false}", 
                                    objectMapper.writeValueAsString(content));
                            return sseData;
                        }
                        if (node.has("done") && node.get("done").asBoolean()) {
                            return "{\"content\": \"\", \"done\": true}";
                        }
                    } catch (JsonProcessingException e) {
                        // ignore
                    }
                    return "";
                })
                .filter(s -> !s.isEmpty());
    }
}
