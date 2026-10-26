package com.likhith.helfen.ai.service;

import com.likhith.helfen.ai.dto.TtsRequest;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;

import java.util.HashMap;
import java.util.Map;

@Service
public class CartesiaService {

    private final WebClient cartesiaWebClient;

    public CartesiaService(@Qualifier("cartesiaWebClient") WebClient cartesiaWebClient) {
        this.cartesiaWebClient = cartesiaWebClient;
    }

    public Flux<DataBuffer> streamAudio(TtsRequest request) {
        String rawText = request.getText();
        if (rawText == null || rawText.isBlank()) {
            return Flux.empty();
        }

        // Clean markdown syntax for natural voice synthesis
        String cleanText = cleanMarkdownForSpeech(rawText);
        if (cleanText.length() > 2500) {
            cleanText = cleanText.substring(0, 2500);
        }

        String voiceId = (request.getVoice() != null && !request.getVoice().isBlank())
                ? request.getVoice()
                : "694f9389-aac1-45b6-b726-9d9369183238"; // Natural British / Conversational voice

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("transcript", cleanText);
        requestBody.put("model_id", "sonic-3.5");
        
        Map<String, Object> voice = new HashMap<>();
        voice.put("mode", "id");
        voice.put("id", voiceId);
        requestBody.put("voice", voice);

        Map<String, Object> outputFormat = new HashMap<>();
        outputFormat.put("container", "mp3");
        outputFormat.put("encoding", "mp3");
        outputFormat.put("sample_rate", 44100);
        requestBody.put("output_format", outputFormat);

        return cartesiaWebClient.post()
                .bodyValue(requestBody)
                .retrieve()
                .bodyToFlux(DataBuffer.class)
                .onErrorResume(err -> {
                    org.slf4j.LoggerFactory.getLogger(CartesiaService.class).error("Cartesia TTS error: {}", err.getMessage());
                    return Flux.empty();
                });
    }

    private String cleanMarkdownForSpeech(String md) {
        if (md == null) return "";
        return md
                .replaceAll("```[\\s\\S]*?```", " Code snippet omitted for voice. ")
                .replaceAll("`([^`]+)`", "$1")
                .replaceAll("#+\\s*", "")
                .replaceAll("\\[([^\\]]+)\\]\\([^\\)]+\\)", "$1")
                .replaceAll("[*_~]{1,3}", "")
                .replaceAll("^[\\s*-]+", "")
                .replaceAll("\\n+", " ")
                .trim();
    }
}
