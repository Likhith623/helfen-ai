-- ============================================================
-- Migration 07: Add Notes & Highlight Colors to Inline Annotations
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- ============================================================

-- 1. Update annotation_type CHECK constraint to allow 'note'
ALTER TABLE public.inline_annotations 
DROP CONSTRAINT IF EXISTS inline_annotations_annotation_type_check;

ALTER TABLE public.inline_annotations
ADD CONSTRAINT inline_annotations_annotation_type_check 
CHECK (annotation_type IN ('question', 'definition', 'explanation', 'translation', 'note'));

-- 2. Add note text column to store user's note/comment on the highlighted word
ALTER TABLE public.inline_annotations
ADD COLUMN IF NOT EXISTS note TEXT;

-- 3. Add color column for customizable highlight colors (yellow, green, blue, purple, pink)
ALTER TABLE public.inline_annotations
ADD COLUMN IF NOT EXISTS color TEXT DEFAULT 'yellow';

-- 4. Add updated_at column to track when notes were last modified
ALTER TABLE public.inline_annotations
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 5. Trigger for updated_at
CREATE OR REPLACE TRIGGER update_inline_annotations_updated_at
BEFORE UPDATE ON public.inline_annotations
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 6. Add index on annotation_type for fast filtering
CREATE INDEX IF NOT EXISTS idx_inline_annotations_type 
ON public.inline_annotations(annotation_type);

-- 7. Add index on message and conversation for rapid lookup
CREATE INDEX IF NOT EXISTS idx_inline_annotations_msg_conv
ON public.inline_annotations(conversation_id, message_id);

-- 8. Add documentation comments
COMMENT ON COLUMN public.inline_annotations.note IS 'User note attached to the highlighted word or phrase';
COMMENT ON COLUMN public.inline_annotations.color IS 'Highlight color: yellow, green, blue, purple, pink';
COMMENT ON COLUMN public.inline_annotations.updated_at IS 'Timestamp when the note was last updated';

