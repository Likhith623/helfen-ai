package com.likhith.helfen.ai.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

@Configuration
public class WebClientConfig {

    @Value("${ollama.base-url}")
    private String ollamaBaseUrl;

    @Value("${cartesia.base-url}")
    private String cartesiaBaseUrl;

    @Value("${cartesia.api-key}")
    private String cartesiaApiKey;

    @Value("${deepgram.base-url:https://api.deepgram.com/v1/listen}")
    private String deepgramBaseUrl;

    @Value("${deepgram.api-key:0cdffc07282e93e2f88beab8da45c066c850b3bc}")
    private String deepgramApiKey;

    @Bean
    public WebClient ollamaWebClient() {
        return WebClient.builder()
                .baseUrl(ollamaBaseUrl)
                .build();
    }

    @Bean
    public WebClient cartesiaWebClient() {
        return WebClient.builder()
                .baseUrl(cartesiaBaseUrl)
                .defaultHeader("Cartesia-Version", "2024-06-10")
                .defaultHeader("X-API-Key", cartesiaApiKey)
                .build();
    }

    @Bean
    public WebClient deepgramWebClient() {
        return WebClient.builder()
                .baseUrl(deepgramBaseUrl)
                .defaultHeader("Authorization", "Token " + deepgramApiKey)
                .codecs(configurer -> configurer.defaultCodecs().maxInMemorySize(16 * 1024 * 1024))
                .build();
    }
}
