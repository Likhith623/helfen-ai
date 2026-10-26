-- ============================================================
-- Migration 06: Chat Context Referencing & Deep Summaries
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- ============================================================

-- 1. Add Summary & Referenced Context columns to conversations table
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS summary TEXT,
ADD COLUMN IF NOT EXISTS summary_metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS referenced_conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS referenced_context_title TEXT,
ADD COLUMN IF NOT EXISTS referenced_context_summary TEXT;

-- 2. Indexes for fast lookups of referenced context conversations
CREATE INDEX IF NOT EXISTS idx_conversations_referenced_conversation_id
ON public.conversations(referenced_conversation_id);

CREATE INDEX IF NOT EXISTS idx_conversations_summary_updated
ON public.conversations(updated_at DESC)
WHERE summary IS NOT NULL;

-- 3. Standalone Conversation Summaries Table (for multi-version deep analytical summaries)
CREATE TABLE IF NOT EXISTS public.conversation_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  executive_summary TEXT,
  key_decisions JSONB DEFAULT '[]'::jsonb,
  salient_topics JSONB DEFAULT '[]'::jsonb,
  unresolved_items JSONB DEFAULT '[]'::jsonb,
  message_count INTEGER DEFAULT 0,
  model_used TEXT DEFAULT 'gemini-2.5-flash',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for conversation summaries
CREATE INDEX IF NOT EXISTS idx_conv_summaries_conv_id ON public.conversation_summaries(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_summaries_user_id ON public.conversation_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_summaries_created_at ON public.conversation_summaries(created_at DESC);

-- 4. Enable Row Level Security (RLS) on conversation_summaries
ALTER TABLE public.conversation_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own conversation summaries" ON public.conversation_summaries;
CREATE POLICY "Users can view own conversation summaries" ON public.conversation_summaries
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can insert own conversation summaries" ON public.conversation_summaries;
CREATE POLICY "Users can insert own conversation summaries" ON public.conversation_summaries
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can update own conversation summaries" ON public.conversation_summaries;
CREATE POLICY "Users can update own conversation summaries" ON public.conversation_summaries
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own conversation summaries" ON public.conversation_summaries;
CREATE POLICY "Users can delete own conversation summaries" ON public.conversation_summaries
  FOR DELETE USING (auth.uid() = user_id);

-- 5. Documentation comments
COMMENT ON COLUMN public.conversations.summary IS 'Cached comprehensive analytical summary of the conversation';
COMMENT ON COLUMN public.conversations.summary_metadata IS 'Structured JSON metadata containing key decisions, topics, and message count';
COMMENT ON COLUMN public.conversations.referenced_conversation_id IS 'ID of previous chat referenced for context ("i want you to have context of...")';
COMMENT ON COLUMN public.conversations.referenced_context_title IS 'Title of the referenced conversation';
COMMENT ON COLUMN public.conversations.referenced_context_summary IS 'Loaded summary and salient memory carried over from the referenced conversation';
COMMENT ON TABLE public.conversation_summaries IS 'Deep summaries, key decisions, and structured context snapshots of conversations';
