package com.likhith.helfen.ai.service;

import com.likhith.helfen.ai.dto.RagChunk;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class RagService {

    private final WebClient ollamaWebClient;

    public RagService(@Qualifier("ollamaWebClient") WebClient ollamaWebClient) {
        this.ollamaWebClient = ollamaWebClient;
    }

    /**
     * Splits arbitrary document text into overlapping semantic chunks
     */
    public List<RagChunk> chunkDocument(String docName, String text, int targetChunkSize, int overlap) {
        List<RagChunk> chunks = new ArrayList<>();
        if (text == null || text.isBlank()) {
            return chunks;
        }

        String normalized = text.replace("\r\n", "\n");
        // Split primarily by double line breaks (paragraphs) or single line breaks
        String[] paragraphs = normalized.split("\n\n+");

        StringBuilder currentChunk = new StringBuilder();
        int chunkIndex = 0;

        for (String para : paragraphs) {
            String cleanPara = para.trim();
            if (cleanPara.isEmpty()) continue;

            if (currentChunk.length() + cleanPara.length() <= targetChunkSize) {
                if (currentChunk.length() > 0) currentChunk.append("\n\n");
                currentChunk.append(cleanPara);
            } else {
                if (currentChunk.length() > 0) {
                    String content = currentChunk.toString();
                    chunks.add(RagChunk.builder()
                            .documentName(docName)
                            .chunkIndex(chunkIndex++)
                            .content(content)
                            .tokenCount((int) Math.round(content.split("\\s+").length * 1.3))
                            .score(0.0)
                            .build());

                    // Carry over tail for sliding-window overlap
                    if (overlap > 0 && content.length() > overlap) {
                        String carryOver = content.substring(content.length() - overlap);
                        currentChunk = new StringBuilder(carryOver).append("\n\n").append(cleanPara);
                    } else {
                        currentChunk = new StringBuilder(cleanPara);
                    }
                } else {
                    // Paragraph itself is larger than chunkSize -> split by character boundaries
                    int start = 0;
                    while (start < cleanPara.length()) {
                        int end = Math.min(start + targetChunkSize, cleanPara.length());
                        String slice = cleanPara.substring(start, end);
                        chunks.add(RagChunk.builder()
                                .documentName(docName)
                                .chunkIndex(chunkIndex++)
                                .content(slice)
                                .tokenCount((int) Math.round(slice.split("\\s+").length * 1.3))
                                .score(0.0)
                                .build());
                        start += (targetChunkSize - overlap);
                        if (start >= cleanPara.length()) break;
                    }
                    currentChunk = new StringBuilder();
                }
            }
        }

        if (currentChunk.length() > 0) {
            String content = currentChunk.toString();
            chunks.add(RagChunk.builder()
                    .documentName(docName)
                    .chunkIndex(chunkIndex)
                    .content(content)
                    .tokenCount((int) Math.round(content.split("\\s+").length * 1.3))
                    .score(0.0)
                    .build());
        }

        return chunks;
    }

    /**
     * Ranks and retrieves the top-K chunks for a user query using hybrid semantic + BM25 keyword matching
     */
    public List<RagChunk> retrieveRelevantChunks(String query, List<RagChunk> allChunks, int topK) {
        if (query == null || query.isBlank() || allChunks == null || allChunks.isEmpty()) {
            return Collections.emptyList();
        }

        Set<String> queryTokens = tokenize(query);

        // Precompute inverted document frequency for BM25
        Map<String, Integer> docFrequencies = new HashMap<>();
        for (RagChunk chunk : allChunks) {
            Set<String> chunkTokens = tokenize(chunk.getContent());
            for (String qt : queryTokens) {
                if (chunkTokens.contains(qt)) {
                    docFrequencies.put(qt, docFrequencies.getOrDefault(qt, 0) + 1);
                }
            }
        }

        int N = allChunks.size();
        double avgDocLength = allChunks.stream()
                .mapToInt(c -> tokenize(c.getContent()).size())
                .average()
                .orElse(100.0);

        for (RagChunk chunk : allChunks) {
            List<String> chunkTokensList = Arrays.asList(chunk.getContent().toLowerCase().split("[^a-zA-Z0-9_]+"));
            int docLength = chunkTokensList.size();
            Map<String, Integer> termFreqs = new HashMap<>();
            for (String t : chunkTokensList) {
                termFreqs.put(t, termFreqs.getOrDefault(t, 0) + 1);
            }

            // BM25 calculation (k1 = 1.2, b = 0.75)
            double bm25Score = 0.0;
            double k1 = 1.2;
            double b = 0.75;

            for (String qt : queryTokens) {
                int tf = termFreqs.getOrDefault(qt, 0);
                if (tf > 0) {
                    int df = docFrequencies.getOrDefault(qt, 1);
                    double idf = Math.log(1.0 + (N - df + 0.5) / (df + 0.5));
                    double num = tf * (k1 + 1.0);
                    double denom = tf + k1 * (1.0 - b + b * (docLength / avgDocLength));
                    bm25Score += idf * (num / denom);
                }
            }

            // Normalize BM25 score into 0.0 - 1.0 range
            double normalizedBm25 = Math.min(1.0, bm25Score / Math.max(1.0, queryTokens.size() * 2.5));

            // Keyword exact substring match boost
            double phraseBoost = chunk.getContent().toLowerCase().contains(query.toLowerCase()) ? 0.25 : 0.0;

            double finalScore = Math.min(1.0, normalizedBm25 + phraseBoost);
            chunk.setScore(Math.round(finalScore * 1000.0) / 1000.0);
        }

        // Filter by relevance threshold and sort descending by score
        return allChunks.stream()
                .filter(c -> c.getScore() > 0.05)
                .sorted((a, b) -> Double.compare(b.getScore(), a.getScore()))
                .limit(topK > 0 ? topK : 5)
                .collect(Collectors.toList());
    }

    /**
     * Formats retrieved chunks into markdown-grounded context ready for LLM system prompt
     */
    public String formatRagContext(List<RagChunk> retrievedChunks) {
        if (retrievedChunks == null || retrievedChunks.isEmpty()) {
            return "";
        }

        StringBuilder sb = new StringBuilder();
        sb.append("--- BEGIN GROUNDED KNOWLEDGE BASE CONTEXT (RAG) ---\n");
        sb.append("Use the following verified excerpts from the user's uploaded documents to answer their questions accurately.\n");
        sb.append("When drawing information from a source, cite it explicitly (e.g. `[Doc: filename (Chunk #N)]`).\n\n");

        for (int i = 0; i < retrievedChunks.size(); i++) {
            RagChunk chunk = retrievedChunks.get(i);
            int scorePercent = (int) Math.round(chunk.getScore() * 100);
            sb.append(String.format("### [Source %d: %s | Chunk #%d | Relevance: %d%%]\n",
                    i + 1, chunk.getDocumentName(), chunk.getChunkIndex() + 1, scorePercent));
            sb.append(chunk.getContent()).append("\n\n");
        }

        sb.append("--- END GROUNDED KNOWLEDGE BASE CONTEXT ---\n");
        return sb.toString();
    }

    private Set<String> tokenize(String input) {
        if (input == null) return Collections.emptySet();
        return Arrays.stream(input.toLowerCase().split("[^a-zA-Z0-9_]+"))
                .filter(t -> t.length() > 2)
                .filter(t -> !STOP_WORDS.contains(t))
                .collect(Collectors.toSet());
    }

    private static final Set<String> STOP_WORDS = Set.of(
            "the", "and", "is", "in", "it", "to", "of", "for", "with", "on", "at",
            "from", "by", "about", "as", "into", "like", "through", "after", "over",
            "between", "out", "against", "during", "without", "before", "under", "around",
            "this", "that", "these", "those", "what", "which", "who", "whom", "whose",
            "when", "where", "why", "how", "all", "any", "both", "each", "few", "more"
    );
}
