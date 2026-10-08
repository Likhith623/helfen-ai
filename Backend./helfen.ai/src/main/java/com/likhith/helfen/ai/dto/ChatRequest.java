package com.likhith.helfen.ai.dto;

import lombok.Data;
import java.util.List;

@Data
public class ChatRequest {
    private String conversationId;
    private List<ChatMessage> messages;
    private String model;
    private boolean isTemporary;
}
