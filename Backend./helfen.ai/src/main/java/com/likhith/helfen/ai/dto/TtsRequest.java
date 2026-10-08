package com.likhith.helfen.ai.dto;

import lombok.Data;

@Data
public class TtsRequest {
    private String text;
    private String voice;
}
