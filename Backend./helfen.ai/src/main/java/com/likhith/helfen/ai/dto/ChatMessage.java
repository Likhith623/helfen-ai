package com.likhith.helfen.ai.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChatMessage {
    private String role;
    private String content;
    private List<String> images;

    public ChatMessage(String role, String content) {
        this.role = role;
        this.content = content;
    }
}
