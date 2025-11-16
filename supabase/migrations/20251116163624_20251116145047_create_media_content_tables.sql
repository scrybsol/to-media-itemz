/*
  # Media Content Management System

  ## Overview
  Comprehensive schema for managing different types of media content (videos, audio, blogs, galleries, resources)
  with real-time engagement tracking, creator follows, and premium features.

  ## Tables Created
  
  1. **media_content**
     - Stores all types of media content across different tabs
     - Fields: id, user_id, title, creator_name, description, thumbnail_url, duration/read_time,
       type (stream/listen/blog/gallery/resources), category, content_type, price, rating,
       is_premium, views_count, plays_count, sales_count, created_at, updated_at
     - Supports multiple content types with type-specific fields
  
  2. **media_likes**
     - Tracks which users liked which media items
     - Fields: id, user_id, media_id, created_at
     - Unique constraint on (user_id, media_id) to prevent duplicate likes
     - Automatically updates parent media likes_count
  
  3. **creator_follows**
     - Tracks user follows of creators
     - Fields: id, follower_id, creator_name, created_at
     - Unique constraint on (follower_id, creator_name) to prevent duplicate follows
  
  ## Security
  
  - Row Level Security (RLS) enabled on all tables
  - Media content is publicly readable for authenticated users
  - Likes and follows are user-owned and manageable by authenticated users only
  - Users can only like/follow if authenticated
  
  ## Functions & Triggers
  
  - Auto-update media likes_count on like/unlike
  - Auto-update views_count on media view
  - Auto-update plays_count for audio on play
  - Auto-update sales_count for resources on purchase
  - Update updated_at timestamp automatically
  
  ## Important Notes
  
  - creator_name is stored with media for quick filtering without joins
  - Real-time subscriptions work via postgres_changes
  - Premium content tracked via is_premium flag
  - User tier checked in application logic (not database)
*/

-- Ensure enums exist for content types
DO $$ BEGIN
  CREATE TYPE content_type_enum AS ENUM ('video', 'audio', 'blog', 'image', 'file');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE media_type_enum AS ENUM ('stream', 'listen', 'blog', 'gallery', 'resources');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Media Content table
CREATE TABLE IF NOT EXISTS media_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  creator_name text NOT NULL,
  description text,
  thumbnail_url text NOT NULL,
  duration text,
  read_time text,
  type media_type_enum NOT NULL DEFAULT 'stream',
  category text NOT NULL DEFAULT 'all',
  content_type content_type_enum NOT NULL DEFAULT 'video',
  price integer,
  rating numeric(3, 1) DEFAULT 0,
  is_premium boolean DEFAULT false,
  views_count integer DEFAULT 0,
  plays_count integer DEFAULT 0,
  sales_count integer DEFAULT 0,
  likes_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Media Likes table
CREATE TABLE IF NOT EXISTS media_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  media_id uuid NOT NULL REFERENCES media_content(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, media_id)
);

-- Creator Follows table
CREATE TABLE IF NOT EXISTS creator_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  creator_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(follower_id, creator_name)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_media_content_user_id ON media_content(user_id);
CREATE INDEX IF NOT EXISTS idx_media_content_type ON media_content(type);
CREATE INDEX IF NOT EXISTS idx_media_content_category ON media_content(category);
CREATE INDEX IF NOT EXISTS idx_media_content_creator_name ON media_content(creator_name);
CREATE INDEX IF NOT EXISTS idx_media_content_created_at ON media_content(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_likes_user_id ON media_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_media_likes_media_id ON media_likes(media_id);
CREATE INDEX IF NOT EXISTS idx_creator_follows_follower ON creator_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_creator_follows_creator_name ON creator_follows(creator_name);

-- Enable Row Level Security
ALTER TABLE media_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_follows ENABLE ROW LEVEL SECURITY;

-- Media Content RLS Policies
CREATE POLICY "Anyone can view media content"
  ON media_content FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create media content"
  ON media_content FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own media content"
  ON media_content FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own media content"
  ON media_content FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Media Likes RLS Policies
CREATE POLICY "Anyone can view media likes"
  ON media_likes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create own media likes"
  ON media_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own media likes"
  ON media_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Creator Follows RLS Policies
CREATE POLICY "Anyone can view creator follows"
  ON creator_follows FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create own creator follows"
  ON creator_follows FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can delete own creator follows"
  ON creator_follows FOR DELETE
  TO authenticated
  USING (auth.uid() = follower_id);

-- Function to update media likes count
CREATE OR REPLACE FUNCTION update_media_likes_count_v2()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE media_content
    SET likes_count = likes_count + 1
    WHERE id = NEW.media_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE media_content
    SET likes_count = GREATEST(0, likes_count - 1)
    WHERE id = OLD.media_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for media likes count
DROP TRIGGER IF EXISTS on_media_like_change ON media_likes;
CREATE TRIGGER on_media_like_change
  AFTER INSERT OR DELETE ON media_likes
  FOR EACH ROW EXECUTE FUNCTION update_media_likes_count_v2();

-- Function to update media_content updated_at timestamp
CREATE OR REPLACE FUNCTION update_media_content_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_media_content_updated_at ON media_content;
CREATE TRIGGER update_media_content_updated_at
  BEFORE UPDATE ON media_content
  FOR EACH ROW EXECUTE FUNCTION update_media_content_updated_at();

-- Function to increment views on media_content read
CREATE OR REPLACE FUNCTION increment_media_views(media_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE media_content
  SET views_count = views_count + 1
  WHERE id = media_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment plays on media_content read
CREATE OR REPLACE FUNCTION increment_media_plays(media_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE media_content
  SET plays_count = plays_count + 1
  WHERE id = media_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment sales on resource purchase
CREATE OR REPLACE FUNCTION increment_media_sales(media_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE media_content
  SET sales_count = sales_count + 1
  WHERE id = media_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
