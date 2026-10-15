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

### 3. Supabase Schema Migration (Optional)
Run `supabase_migrations/03_add_message_attachments.sql` in your Supabase SQL Editor to store attachment metadata persistently:
```sql
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
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