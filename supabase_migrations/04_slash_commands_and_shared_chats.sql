-- ============================================================
-- Migration: Prompt Templates (Slash Commands) & Shared Chats
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- ============================================================

-- 1. Prompt Templates Table for User Custom Slash Commands
CREATE TABLE IF NOT EXISTS public.prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  command TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  template TEXT NOT NULL,
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_prompt_templates_user_id ON public.prompt_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_command ON public.prompt_templates(command);

-- RLS Policies for Prompt Templates
ALTER TABLE public.prompt_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own prompt templates" ON public.prompt_templates;
CREATE POLICY "Users can manage own prompt templates" ON public.prompt_templates
  FOR ALL USING (auth.uid() = user_id);

-- 2. Public Shared Chats Table (Snapshots for shareable links)
CREATE TABLE IF NOT EXISTS public.shared_chats (
  id TEXT PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  model TEXT DEFAULT 'llama3.2:3b',
  is_anonymous BOOLEAN DEFAULT false,
  creator_name TEXT,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  views_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for shared chats
CREATE INDEX IF NOT EXISTS idx_shared_chats_created_at ON public.shared_chats(created_at DESC);

-- RLS Policies for Shared Chats
ALTER TABLE public.shared_chats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view shared chats" ON public.shared_chats;
CREATE POLICY "Public can view shared chats" ON public.shared_chats
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert shared chats" ON public.shared_chats;
CREATE POLICY "Users can insert shared chats" ON public.shared_chats
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can update own shared chats" ON public.shared_chats;
CREATE POLICY "Users can update own shared chats" ON public.shared_chats
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own shared chats" ON public.shared_chats;
CREATE POLICY "Users can delete own shared chats" ON public.shared_chats
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE public.prompt_templates IS 'User-saved custom prompt snippets and slash commands';
COMMENT ON TABLE public.shared_chats IS 'Publicly shared read-only snapshots of conversations with fork support';
