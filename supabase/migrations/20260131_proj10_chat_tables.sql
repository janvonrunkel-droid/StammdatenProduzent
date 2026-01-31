-- PROJ-10: RAG Chat Interface - Database Setup (Phase 1: MVP)
-- Creates chat_sessions and chat_messages tables for conversation history

-- ============================================================================
-- 1. Create chat_sessions table
-- ============================================================================
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(255),  -- Auto-generated from first user message
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast user session lookups
CREATE INDEX IF NOT EXISTS chat_sessions_user_id_idx
ON chat_sessions(user_id);

-- Index for sorting by recent
CREATE INDEX IF NOT EXISTS chat_sessions_updated_at_idx
ON chat_sessions(updated_at DESC);

-- ============================================================================
-- 2. Create chat_messages table
-- ============================================================================
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',  -- Stores: intent, sources, confidence, tokens_used
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast message retrieval by session
CREATE INDEX IF NOT EXISTS chat_messages_session_id_idx
ON chat_messages(session_id);

-- Index for ordering messages chronologically
CREATE INDEX IF NOT EXISTS chat_messages_created_at_idx
ON chat_messages(session_id, created_at);

-- ============================================================================
-- 3. Enable Row Level Security (RLS)
-- ============================================================================
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. RLS Policies for chat_sessions
-- ============================================================================

-- Users can only see their own chat sessions
CREATE POLICY "Users can view own chat sessions"
ON chat_sessions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can create their own chat sessions
CREATE POLICY "Users can create own chat sessions"
ON chat_sessions
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can update their own chat sessions (e.g., title)
CREATE POLICY "Users can update own chat sessions"
ON chat_sessions
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Users can delete their own chat sessions
CREATE POLICY "Users can delete own chat sessions"
ON chat_sessions
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- ============================================================================
-- 5. RLS Policies for chat_messages
-- ============================================================================

-- Users can only see messages from their own sessions
CREATE POLICY "Users can view messages from own sessions"
ON chat_messages
FOR SELECT
TO authenticated
USING (
    session_id IN (
        SELECT id FROM chat_sessions WHERE user_id = auth.uid()
    )
);

-- Users can insert messages into their own sessions
CREATE POLICY "Users can create messages in own sessions"
ON chat_messages
FOR INSERT
TO authenticated
WITH CHECK (
    session_id IN (
        SELECT id FROM chat_sessions WHERE user_id = auth.uid()
    )
);

-- Users can delete messages from their own sessions
CREATE POLICY "Users can delete messages from own sessions"
ON chat_messages
FOR DELETE
TO authenticated
USING (
    session_id IN (
        SELECT id FROM chat_sessions WHERE user_id = auth.uid()
    )
);

-- ============================================================================
-- 6. Trigger to update chat_sessions.updated_at when messages are added
-- ============================================================================
CREATE OR REPLACE FUNCTION update_chat_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chat_sessions
    SET updated_at = NOW()
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chat_message_update_session_timestamp
    AFTER INSERT ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_chat_session_timestamp();

-- ============================================================================
-- 7. Function to generate session title from first message (truncated)
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_chat_session_title(message_content TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Take first 50 chars and add ellipsis if longer
    IF LENGTH(message_content) > 50 THEN
        RETURN SUBSTRING(message_content FROM 1 FOR 50) || '...';
    ELSE
        RETURN message_content;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
