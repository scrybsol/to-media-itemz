/*
  # Tips and Media Items Management

  ## Overview
  Additional tables for supporting tip functionality and unified media items storage.

  ## Tables Created
  
  1. **tips**
     - Stores tip transactions between users and creators
     - Fields: id, from_user_id, creator_name, amount, message, created_at
     - Tracks all monetary tips sent to creators
  
  2. **media_items** (if not already using media_content)
     - Alternative unified table for all media types
     - Can be used alongside media_content for specific use cases
     - Maps to media_content for compatibility
  
  ## Security
  
  - Row Level Security (RLS) enabled on all tables
  - Users can only create their own tips
  - Tips data is readable by all authenticated users
  - Creators can view tips they've received
  
  ## Functions & Triggers
  
  - Auto-update created_at timestamp
  - Support for optional tip messages
*/

-- Ensure currency enum exists
DO $$ BEGIN
  CREATE TYPE currency_enum AS ENUM ('UGX', 'USD', 'EUR', 'GBP');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Tips table
CREATE TABLE IF NOT EXISTS tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  creator_name text NOT NULL,
  amount integer NOT NULL,
  currency currency_enum DEFAULT 'UGX',
  message text,
  created_at timestamptz DEFAULT now()
);

-- Media Items table (unified view or mapping to media_content)
CREATE TABLE IF NOT EXISTS media_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  type text NOT NULL,
  category text DEFAULT 'all',
  thumbnail_url text NOT NULL,
  creator text NOT NULL,
  duration text,
  read_time text,
  views_count integer DEFAULT 0,
  like_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tips_from_user_id ON tips(from_user_id);
CREATE INDEX IF NOT EXISTS idx_tips_creator_name ON tips(creator_name);
CREATE INDEX IF NOT EXISTS idx_tips_created_at ON tips(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_items_type ON media_items(type);
CREATE INDEX IF NOT EXISTS idx_media_items_creator ON media_items(creator);
CREATE INDEX IF NOT EXISTS idx_media_items_created_at ON media_items(created_at DESC);

-- Enable Row Level Security
ALTER TABLE tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_items ENABLE ROW LEVEL SECURITY;

-- Tips RLS Policies
CREATE POLICY "Anyone can view tips"
  ON tips FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create their own tips"
  ON tips FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = from_user_id);

-- Media Items RLS Policies
CREATE POLICY "Anyone can view media items"
  ON media_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create media items"
  ON media_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own media items"
  ON media_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own media items"
  ON media_items FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to update media_items updated_at
CREATE OR REPLACE FUNCTION update_media_items_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_media_items_updated_at_trigger ON media_items;
CREATE TRIGGER update_media_items_updated_at_trigger
  BEFORE UPDATE ON media_items
  FOR EACH ROW EXECUTE FUNCTION update_media_items_updated_at();

-- Function to sync media_content likes to media_items like_count
CREATE OR REPLACE FUNCTION sync_media_likes()
RETURNS trigger AS $$
BEGIN
  IF TG_TABLE_NAME = 'likes' AND TG_OP IN ('INSERT', 'DELETE') THEN
    UPDATE media_items
    SET like_count = (
      SELECT COUNT(*) FROM likes WHERE media_id = NEW.media_id
    )
    WHERE id = NEW.media_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to sync likes
DROP TRIGGER IF EXISTS sync_media_likes_trigger ON likes;
CREATE TRIGGER sync_media_likes_trigger
  AFTER INSERT OR DELETE ON likes
  FOR EACH ROW EXECUTE FUNCTION sync_media_likes();
