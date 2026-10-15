-- ============================================================
-- Migration: Knowledge Base & RAG Vector Chunks
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- ============================================================

-- Optional: enable pgvector if available on your Supabase project
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pgvector extension not enabled or not available on this tier, falling back to JSONB vector embeddings';
END $$;

-- 1. Knowledge Base Documents Table
CREATE TABLE IF NOT EXISTS public.knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'document',
  file_size INTEGER NOT NULL DEFAULT 0,
  total_chunks INTEGER NOT NULL DEFAULT 0,
  token_count INTEGER NOT NULL DEFAULT 0,
  summary TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for knowledge documents
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_user_id ON public.knowledge_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_created_at ON public.knowledge_documents(created_at DESC);

-- RLS Policies for Knowledge Documents
ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own knowledge documents" ON public.knowledge_documents;
CREATE POLICY "Users can manage own knowledge documents" ON public.knowledge_documents
  FOR ALL USING (auth.uid() = user_id);

-- 2. Document Chunks Table (for semantic retrieval and citations)
CREATE TABLE IF NOT EXISTS public.document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  token_count INTEGER NOT NULL DEFAULT 0,
  embedding JSONB, -- Stores embedding vector coordinates [e1, e2, ... en]
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for document chunks
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON public.document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_user_id ON public.document_chunks(user_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_chunk_index ON public.document_chunks(document_id, chunk_index);

-- RLS Policies for Document Chunks
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own document chunks" ON public.document_chunks;
CREATE POLICY "Users can manage own document chunks" ON public.document_chunks
  FOR ALL USING (auth.uid() = user_id);

-- 3. Helpful Database Function: Calculate Cosine Similarity between two JSON number arrays
CREATE OR REPLACE FUNCTION public.cosine_similarity_json(v1 JSONB, v2 JSONB)
RETURNS FLOAT AS $$
DECLARE
  dot_product FLOAT := 0.0;
  norm_a FLOAT := 0.0;
  norm_b FLOAT := 0.0;
  len INTEGER;
  i INTEGER;
  val_a FLOAT;
  val_b FLOAT;
BEGIN
  len := jsonb_array_length(v1);
  IF len != jsonb_array_length(v2) OR len = 0 THEN
    RETURN 0.0;
  END IF;

  FOR i IN 0..(len - 1) LOOP
    val_a := (v1->>i)::FLOAT;
    val_b := (v2->>i)::FLOAT;
    dot_product := dot_product + (val_a * val_b);
    norm_a := norm_a + (val_a * val_a);
    norm_b := norm_b + (val_b * val_b);
  END LOOP;

  IF norm_a = 0.0 OR norm_b = 0.0 THEN
    RETURN 0.0;
  END IF;

  RETURN dot_product / (sqrt(norm_a) * sqrt(norm_b));
END;
$$ LANGUAGE plpgsql IMMUTABLE;
