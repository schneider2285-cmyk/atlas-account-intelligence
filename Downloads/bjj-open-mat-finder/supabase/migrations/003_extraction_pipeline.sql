-- Migration 003: Extraction Pipeline
-- Adds gym website platform detection and open mat source tracking

-- Gym extraction metadata
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS platform_type text;
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS schedule_page_url text;
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS schedule_format text;
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS last_scraped_at timestamptz;
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS scrape_status text;
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS scrape_error text;

-- Open mat source tracking
ALTER TABLE open_mats ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'community_submission';
ALTER TABLE open_mats ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE open_mats ADD COLUMN IF NOT EXISTS last_source_check timestamptz;
ALTER TABLE open_mats ADD COLUMN IF NOT EXISTS needs_review boolean DEFAULT false;

-- Index for extraction dashboard queries
CREATE INDEX IF NOT EXISTS idx_gyms_scrape_status ON gyms(scrape_status);
CREATE INDEX IF NOT EXISTS idx_gyms_platform_type ON gyms(platform_type);
CREATE INDEX IF NOT EXISTS idx_open_mats_source_type ON open_mats(source_type);
CREATE INDEX IF NOT EXISTS idx_open_mats_needs_review ON open_mats(needs_review) WHERE needs_review = true;
