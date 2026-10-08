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
        String text = request.getText();
        if (text != null && text.length() > 1000) {
            text = text.substring(0, 1000);
        }

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("transcript", text);
        requestBody.put("model_id", "sonic-english");
        
        Map<String, Object> voice = new HashMap<>();
        voice.put("mode", "id");
        voice.put("id", "694f9389-aac1-45b6-b726-9d9369183238"); // Default voice ID
        requestBody.put("voice", voice);

        Map<String, Object> outputFormat = new HashMap<>();
        outputFormat.put("container", "mp3");
        outputFormat.put("encoding", "mp3");
        outputFormat.put("sample_rate", 44100);
        requestBody.put("output_format", outputFormat);

        return cartesiaWebClient.post()
                .bodyValue(requestBody)
                .retrieve()
                .bodyToFlux(DataBuffer.class);
    }
}
