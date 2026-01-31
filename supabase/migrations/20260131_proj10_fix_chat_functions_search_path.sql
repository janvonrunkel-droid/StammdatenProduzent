-- PROJ-10: Fix search_path for chat functions (Security)
-- Fixes BUG-1: Functions should have secure search_path
-- Applied: 2026-01-31

-- 1. Fix update_chat_session_timestamp trigger function
CREATE OR REPLACE FUNCTION update_chat_session_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    UPDATE chat_sessions
    SET updated_at = NOW()
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$;

-- 2. Fix generate_chat_session_title function
CREATE OR REPLACE FUNCTION generate_chat_session_title(message_content TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
    -- Take first 50 chars and add ellipsis if longer
    IF LENGTH(message_content) > 50 THEN
        RETURN SUBSTRING(message_content FROM 1 FOR 50) || '...';
    ELSE
        RETURN message_content;
    END IF;
END;
$$;

-- Add comments for documentation
COMMENT ON FUNCTION update_chat_session_timestamp IS 'Trigger function to update chat_sessions.updated_at when messages are added';
COMMENT ON FUNCTION generate_chat_session_title IS 'Helper function to generate session title from first message (truncated to 50 chars)';
