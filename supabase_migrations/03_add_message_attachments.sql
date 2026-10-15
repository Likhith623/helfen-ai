-- ============================================================
-- Migration: Add Multi-Modal Attachments Column to Messages
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- ============================================================

-- 1. Add attachments column (JSONB array) to messages table
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- 2. Add an index for fast lookups and querying
CREATE INDEX IF NOT EXISTS idx_messages_attachments
ON public.messages USING gin(attachments);

-- 3. Documentation comment
COMMENT ON COLUMN public.messages.attachments IS 'Stores metadata, extracted text, and references for uploaded multi-modal files (documents, images, code files)';
