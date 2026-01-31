-- PROJ-16: Article Auto-Matching
-- Migration: user_settings table + article_number index + auto-created tag

-- 1. Create user_settings table for extraction preferences
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    extraction_auto_create_articles BOOLEAN DEFAULT false,
    match_threshold_auto NUMERIC(3,2) DEFAULT 0.90,
    match_threshold_suggestion NUMERIC(3,2) DEFAULT 0.70,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT user_settings_user_id_unique UNIQUE (user_id)
);

-- Add comment
COMMENT ON TABLE user_settings IS 'User-specific settings for extraction and other features';
COMMENT ON COLUMN user_settings.extraction_auto_create_articles IS 'If true, automatically create new articles for unmatched positions';
COMMENT ON COLUMN user_settings.match_threshold_auto IS 'Minimum match score (0-1) for automatic article assignment';
COMMENT ON COLUMN user_settings.match_threshold_suggestion IS 'Minimum match score (0-1) for article suggestions';

-- 2. Create index on articles.article_number for fast lookup
CREATE INDEX IF NOT EXISTS idx_articles_article_number ON articles(article_number) WHERE article_number IS NOT NULL AND deleted_at IS NULL;

-- 3. Create the "auto-created" tag if it doesn't exist
INSERT INTO tags (name, color)
VALUES ('auto-created', '#6366f1')
ON CONFLICT (name) DO NOTHING;

-- 4. Enable RLS on user_settings
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for user_settings
-- Users can only see/modify their own settings
CREATE POLICY "Users can view own settings"
    ON user_settings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
    ON user_settings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
    ON user_settings FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 6. Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_user_settings_updated_at();

-- 7. Grant permissions
GRANT SELECT, INSERT, UPDATE ON user_settings TO authenticated;
