package com.likhith.helfen.ai.dto;

import lombok.Data;

@Data
public class InlineChatRequest {
    private String selectedText;
    private String question;
    private String conversationId;
    private String model;
}
