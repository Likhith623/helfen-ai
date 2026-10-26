package com.likhith.helfen.ai.service;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
public class RedisService {

    private final StringRedisTemplate redisTemplate;

    public RedisService(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    public void cacheConversationContext(String conversationId, String context) {
        if (conversationId != null && !conversationId.equals("temp")) {
            try {
                // Cache for 24 hours
                redisTemplate.opsForValue().set("chat:" + conversationId, context, Duration.ofHours(24));
            } catch (Exception e) {
                // Fallback gracefully when Redis is offline
            }
        }
    }

    public String getConversationContext(String conversationId) {
        if (conversationId == null || conversationId.equals("temp")) {
            return null;
        }
        try {
            return redisTemplate.opsForValue().get("chat:" + conversationId);
        } catch (Exception e) {
            return null;
        }
    }
}
