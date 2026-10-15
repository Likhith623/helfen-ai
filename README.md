# Helfen.AI 🤖✨

A next-generation AI assistant platform engineered with Spring Boot, Next.js, Supabase, Ollama, Redis, and RabbitMQ. Features real-time streaming, voice synthesis, inline text-annotation sub-chats, and seamless **Chat Continuation with Context Linking**.

---

## 🌟 Chat Continuation & Context Linking

### The Problem
In real-world usage, as conversations grow long ("chat full"), they hit context token limits, become sluggish, or get cluttered with older queries. When starting a fresh new chat, standard AI applications lose all past context, forcing users to re-explain background details and previous decisions from scratch.

### The Solution: Context Linking
With Helfen AI's **Chat Continuation** feature:
1. When you start a new chat, you can click the **Context** (`🔗`) button directly in the search / prompt input box or select **"Continue from a previous chat"** on the welcome screen.
2. An interactive **Chat Context Selector** opens, allowing you to choose any previous conversation.
3. The selected conversation's messages and memory are linked as the continuation context for this new session.
4. When sending prompts in the new chat, Helfen AI automatically injects structured context from the ancestor conversation into the system prompt and memory cache, allowing the model to remember facts, code, and instructions seamlessly.
5. You can also branch directly into a continuation chat from the sidebar's conversation options (**"Continue in new chat"**) or the top bar.

---

## 📎 Multi-Modal File & Document Intelligence (RAG & Vision)

Upload and analyze documents, codebases, diagrams, and images directly in the prompt bar:

### 1. Document & Code Understanding
- **Supported Formats:** `.pdf`, `.txt`, `.md`, `.json`, `.csv`, `.py`, `.js`, `.ts`, `.tsx`, `.java`, `.html`, `.css`, `.sql`, `.sh`, `.yml`, `.xml`.
- **Text & Structure Extraction:** Extracts raw and formatted text, lines, and token estimates directly in the browser with zero heavy native dependencies.
- **Context Injection:** Injects structured document blocks into the Ollama system prompt with clear boundaries, metadata, and token estimates.
- **Document Summaries & Q&A:** Ask questions about specific sections, extract key metrics, or ask Helfen to review and refactor code.

### 2. Multi-Modal Vision Analysis
- **Supported Image Formats:** `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.svg`.
- **Automatic Model Switching:** Attaching an image automatically recommends or switches to vision-capable models (e.g., `llama3.2-vision`, `llava`).
- **Interactive Lightbox:** Click on any uploaded image thumbnail in the conversation to open a high-res full-screen lightbox modal with download support.
- **Drag & Drop:** Drag files directly from your desktop into the chat prompt box with visual glow feedback.

---

## 🧠 Perfect RAG (Retrieval-Augmented Generation) Architecture

Helfen AI features an end-to-end, production-grade **Hybrid RAG Pipeline** designed for high precision, low latency, and zero hallucination.

### 1. Semantic Chunking with Sliding-Window Overlap
- **Structure-Aware Chunking:** Intelligently breaks long documents by markdown headings (`#`, `##`), paragraphs (`\n\n`), and code fences rather than arbitrary character splits.
- **Sliding-Window Overlap:** Configurable 600-character chunk size with a 100-character sliding overlap ensures no semantic context is lost across chunk boundaries.
- **Metadata Tagging:** Every chunk retains its document name, chunk index, token estimate, and character offsets.

### 2. Hybrid Retrieval (Dense Vector + Sparse BM25)
- **Dense Vector Search:** Calculates unit-normalized cosine similarity between query and chunk embedding vectors.
- **Sparse BM25 Keyword Search:** Inverted document frequency (IDF) and term frequency ranking ($k_1=1.2, b=0.75$) with exact phrase boost to pinpoint technical terms, identifiers, and numbers.
- **Hybrid Score Formula:**
  $$\text{Score} = 0.55 \cdot \text{CosineSimilarity} + 0.45 \cdot \text{BM25Score} + \text{PhraseBoost}$$
- **Top-K Reranking:** Dynamically filters out low-relevance noise and feeds only the top 3–5 highest-scoring verified excerpts into the model.

### 3. Strict Hallucination Prevention Directives
- Injected system prompts command the model to ground its response exclusively in the verified excerpts and clarify when information is not present.
- Every claim can be cross-referenced with exact chunk citations.

### 4. Interactive RAG Source Inspector & Citations
- **Grounded Citation Pills:** Every assistant response that drew from documents displays a glowing pill badge (e.g., `📚 Grounded in 3 Sources (96% match)`).
- **Inspector Slide-Over Drawer:** Clicking the pill opens a detailed inspection drawer showing:
  - Exact matched passages with syntax highlighting.
  - Relevance progress meters for each chunk.
  - Matched keyword tags.
  - Copy-to-clipboard for quick sharing.

### 5. Knowledge Base Manager & Live Semantic Tester
- Access the **Knowledge Base Modal** via the `🧠 RAG` button in the prompt bar.
- View total indexed documents, vector chunks, and token counts.
- **Live Search Tester:** Type sample queries and watch the hybrid search engine rank and return matching chunks in real time.

### 6. Spring Boot RAG Backend Service
- Spring Boot provides dedicated reactive RAG endpoints:
  - `POST /api/v1/rag/chunk` — Server-side semantic chunking.
  - `POST /api/v1/rag/retrieve` — Hybrid candidate chunk ranking and prompt assembly.
- Integrated into `OllamaService` for streaming chat with grounded context.

### 7. Supabase Schema Migration (Optional)
Run `supabase_migrations/05_knowledge_base_and_rag.sql` in your Supabase SQL Editor:
```sql
-- Creates knowledge_documents and document_chunks tables with cosine similarity function and RLS
```

---

## 📄 PDF Generation & Export

Helfen AI includes client-side PDF document generation powered by `jspdf`.

### 1. Instant Response PDF Generation
- After every assistant response, a dedicated **"Generate a PDF"** (`📄`) button appears in the message actions toolbar.
- Clicking the button dynamically formats and generates a publication-ready PDF containing:
  - **Header & Branding:** Helfen AI header bar, model name, and timestamp.
  - **Prompt Context:** Automatically captures and boxes the preceding user prompt.
  - **Formatted Markdown & Code:** Headings, bullet points, and code blocks rendered in courier styled background containers.
  - **Multi-page Layout:** Dynamic text measurement with clean page breaks and running footers with total page counts.

### 2. Full Conversation Thread Export
- **Top Bar:** Click the document export icon in the top header to download the complete multi-turn chat session as a PDF.
- **Sidebar:** In the chat history list, open the three-dots menu on any saved conversation and click **"Export as PDF"** to export it on demand.

---

## 🔐 Email & Password Authentication (No Verification Links)

Helfen AI features normal email/password authentication without any email verification links or third-party OAuth.

### What you need in Supabase:
1. **Enable Email Provider:**
   - In Supabase Dashboard, go to **Authentication -> Providers -> Email**.
   - Make sure **"Enable Email provider"** is turned **ON**.
2. **Turn OFF Email Confirmations:**
   - Under **Authentication -> Providers -> Email -> Email Confirmations**:
   - Turn **OFF** **"Confirm email"** so users are registered and authenticated immediately without any verification emails or links.
3. **Run the Auth SQL Migration:**
   - Run `supabase_migrations/02_auth_and_profiles.sql` in your Supabase SQL Editor. It creates the `profiles` table, profile sync trigger, and an `auto_confirm_user` database trigger so every user is automatically confirmed immediately.

---

## 🗄️ Supabase Schema & Migration

### Do you need to change your Supabase Schema?

**Answer:**
- **App Behavior:** The application has **built-in graceful fallback**. If you do not change your schema, the app will continue to work seamlessly in memory and local state without throwing database errors.
- **Persistent Support (Recommended):** To permanently store the linked ancestor relationship (`parent_conversation_id`) in your database across reloads and devices, run the migration below in your Supabase SQL Editor.

### Migration SQL
File: `supabase_migrations/01_add_continuation_chats.sql`

```sql
-- 1. Add parent_conversation_id to conversations table
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS parent_conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL;

-- 2. Add an index for fast lookups of ancestor conversations
CREATE INDEX IF NOT EXISTS idx_conversations_parent_conversation_id 
ON conversations(parent_conversation_id);

-- 3. Documentation comment
COMMENT ON COLUMN conversations.parent_conversation_id IS 'References the previous conversation whose context and messages are linked into this new session';
```

---

## ⚡ Slash Commands & Prompt Templates

Type `/` directly in the prompt textarea to open an intelligent, keyboard-navigable quick-actions popup:

### 1. Built-in Quick Actions
- `/summarize` — Quick executive summary of text, documents, or context.
- `/explain` — ELI5 or in-depth technical explanation with real-world analogies.
- `/diagram` — Asks Helfen to produce an interactive Mermaid diagram (architecture, flowcharts, sequence diagrams).
- `/refactor` — Code review, performance optimization, and clean architecture improvements.
- `/fix` — Bug analysis, error diagnosis, and corrected code solutions.
- `/brainstorm` — 10 high-impact creative ideas and architectural solutions.
- `/tests` — Unit and integration tests with edge cases.
- `/translate` — Translate content into target languages while preserving technical accuracy.

### 2. Custom User-Saved Prompt Templates
- **Template Manager Modal:** Click the **Templates** (`📋`) button in the input bar or slash popup to manage your custom snippets.
- **Dynamic Variables:** Support for placeholder templates (e.g. `{{code}}`, `{{topic}}`).
- **Supabase Persistence:** Custom templates are stored in the `prompt_templates` table with Row Level Security (RLS) per user, with graceful fallback to local storage if offline.

---

## 🔗 Shareable Public Chat Links

Create public, read-only snapshots of your conversations to share with colleagues or the community:

### 1. Privacy Settings & Link Generation
- Click the **Share** (`🔗`) button in the top bar or sidebar conversation menu.
- **Attributed or Anonymous:** Choose whether your username is displayed on the public share page or keep it completely anonymous.
- **Unique Share URL:** Generates a secure share link: `helfen.ai/share/<id>`.

### 2. Public Read-Only Viewer (`/share/[id]`)
- Anyone with the link can view the conversation with syntax-highlighted code blocks, markdown formatting, token statistics, and attachments.
- **Export to PDF:** Visitors can download the shared conversation as a publication-grade PDF directly from the viewer.

### 3. "Continue in Helfen" (Fork & Branch)
- Visitors can click **"Continue in Helfen"** to fork the shared conversation into their own Helfen AI workspace.
- The entire conversation history is seamlessly imported into their active session as context so they can immediately ask follow-up questions.

### 4. Supabase Schema Migration
Run `supabase_migrations/04_slash_commands_and_shared_chats.sql` in your Supabase SQL Editor:
```sql
-- Creates prompt_templates table and shared_chats table with RLS
```

---

## 🎙️ Continuous Two-Way Voice Mode (Like ChatGPT Voice)

Transform Helfen AI into an ultra-responsive, real-time conversational voice assistant with continuous turn-taking, hands-free voice activity detection (VAD), and neural voice streaming.

### 1. Hands-Free Conversational Turn-Taking
- Click the glowing microphone button (`🎙️`) in the prompt input or press the voice trigger to launch the **Continuous Voice Mode** experience.
- **Hands-Free Loop:** Speak naturally without pressing buttons. When you pause speaking, Helfen AI automatically detects the silence, packages the audio, transcribes your prompt, streams the AI answer, and reads it back aloud.
- **Automatic Resume:** Once Helfen finishes speaking its response, the microphone automatically opens back up and listens for your next thought.
- **Barge-In Interruption:** Start speaking at any moment to immediately interrupt the AI response; audio playback halts and Helfen instantly switches back to listening.

### 2. Deepgram Nova-2 Speech-to-Text (STT)
- **High-Accuracy Transcription:** Uses Deepgram Nova-2 (`model=nova-2&smart_format=true&punctuate=true`) via backend Spring Boot WebClient (`SttController.java` / `DeepgramService.java`) and frontend client library (`deepgramStt.ts`).
- **Resilient Fallback:** Automatically switches to the browser Web Speech API if offline or if network permissions restrict WebSocket/REST endpoints.
- **Pre-Configured API Key:** Deepgram API key `0cdffc07282e93e2f88beab8da45c066c850b3bc` is pre-configured in `application.yml` and frontend environment.

### 3. Voice Activity Detection (VAD) & Silence Detection
- Built-in `VoiceActivityDetector` (`vadAnalyzer.ts`) utilizing Web Audio API `AudioContext` and `AnalyserNode`.
- **RMS Energy Tracking:** Analyzes time-domain root-mean-square (RMS) sound pressure to filter ambient room noise from authentic vocal speech.
- **Anti-False-Triggering:** Requires 350ms of sustained speech energy before initiating the speaking state.
- **Silence Timeout:** Detects natural 1400ms conversational pauses to auto-submit user turns without requiring any tactile clicks.

### 4. Fluid 3D Waveform Orb Visualizer
- **State-Reactive Animations:** Custom HTML5 Canvas visualizer orb with multi-frequency sound waves, breathing core glow, and particle clouds (`VoiceWaveformOrb.tsx`).
- Dynamically morphs between four conversational modes:
  - 🔵 **Listening Mode:** Expands and pulsates to your real-time vocal frequency harmonics.
  - 🟣 **Thinking / Generating Mode:** Smooth orbital rotation and iridescent violet/cyan energy shifts.
  - 🟢 **Speaking Mode:** Fluid waveforms oscillating in sync with Cartesia audio speech output.
  - ⚪ **Idle / Paused Mode:** Gentle, ambient glow.

### 5. Cartesia Ultra-Low Latency TTS Integration
- **Sanitized Speech Synthesis:** Enhanced `CartesiaService.java` strips markdown code blocks, links, bullets, and syntax symbols before synthesis for smooth, natural speech.
- **Natural Neural Voices:** Powered by Cartesia's Sonic English model (`sonic-english`, default voice ID `a0e998e3-12ff-4811-a46c-202274b21b44`).
- **Live Captions:** Real-time subtitle display underneath the orb reveals both transcribed user prompts and streaming assistant replies.

---

## 🚀 Architecture & Tech Stack

- **Frontend:** Next.js 16 (App Router, Turbopack), React 19, Zustand, Lucide Icons, Vanilla CSS with Gemini-inspired aesthetics.
- **Backend:** Spring Boot (Java 21), Spring WebFlux (SSE Streaming), WebClient.
- **LLM Engine:** Ollama (`llama3.2:3b` default).
- **Cache & Memory:** Redis (context summary cache & TTL management).
- **Messaging:** RabbitMQ event publishing (`CHAT_STARTED`).
- **Database & Auth:** Supabase PostgreSQL with Row Level Security (RLS) & Realtime.

---

## 🛠️ Running Locally

### 1. Backend
```bash
cd "Backend./helfen.ai"
./mvnw spring-boot:run
```
Backend runs on `http://localhost:8080`.

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on `http://localhost:3000`.