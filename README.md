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