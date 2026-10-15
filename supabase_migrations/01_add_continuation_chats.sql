-- ============================================================
-- Migration: Add parent_conversation_id for Chat Continuation
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- ============================================================

-- 1. Add parent_conversation_id to conversations table
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS parent_conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL;

-- 2. Add an index for lightning-fast ancestor/continuation lookups
CREATE INDEX IF NOT EXISTS idx_conversations_parent_conversation_id 
ON conversations(parent_conversation_id);

-- Optional comment explaining column purpose
COMMENT ON COLUMN conversations.parent_conversation_id IS 'References the previous conversation whose context and messages are linked into this new session';
