/*
  # Seed Media Content Data

  ## Overview
  Populates media_content with sample data across all media types.
  Uses a temporary approach to handle user_id requirement.

  ## Data Created
  - Stream content (music videos, films, documentaries)
  - Listen content (audio tracks, mixtapes)
  - Blog content (interviews, articles)
  - Gallery content (design, photography, art)
  - Resources (templates, ebooks, presets)

  ## Notes
  - Creates temporary user for content if no users exist
  - All content uses real Pexels images
  - Realistic engagement metrics
*/

DO $$
DECLARE
  content_user_id uuid;
BEGIN
  -- Try to get an existing user
  SELECT id INTO content_user_id FROM profiles LIMIT 1;
  
  -- If no user exists, we'll use a generated UUID and handle it in the application
  -- For now, let's insert with a placeholder that will be replaced when first user signs up
  IF content_user_id IS NULL THEN
    -- Create a special entry in auth.users for system content
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'system@flourishtalents.local',
      crypt('system-password-never-used', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"name":"System Content"}',
      now(),
      now(),
      '',
      ''
    )
    RETURNING id INTO content_user_id;
    
    -- Profile will be auto-created by trigger, but let's update it
    UPDATE profiles 
    SET name = 'FlourishTalents System',
        account_type = 'creator',
        tier = 'elite'
    WHERE id = content_user_id;
  END IF;

  -- Now insert all media content
  
  -- STREAM content
  INSERT INTO media_content (user_id, title, creator_name, description, thumbnail_url, duration, type, category, content_type, is_premium, views_count, rating) VALUES
    (content_user_id, 'Unstoppable - Official Music Video', 'Jasmine Carter', 'An inspiring music video about overcoming challenges and rising above adversity.', 'https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg?auto=compress&cs=tinysrgb&w=400', '4:15', 'stream', 'music-video', 'video', false, 150000, 4.8),
    (content_user_id, 'The Last Stand - Short Film', 'David Lee', 'A gripping short film about courage and determination in the face of impossible odds.', 'https://images.pexels.com/photos/269140/pexels-photo-269140.jpeg?auto=compress&cs=tinysrgb&w=400', '12:30', 'stream', 'movie', 'video', true, 89000, 4.9),
    (content_user_id, 'African Rhythms Documentary', 'Sarah Omondi', 'Exploring the rich musical heritage of East Africa through captivating visuals.', 'https://images.pexels.com/photos/1190297/pexels-photo-1190297.jpeg?auto=compress&cs=tinysrgb&w=400', '25:45', 'stream', 'documentaries', 'video', false, 45000, 4.7),
    (content_user_id, 'Kampala Nights - Music Video', 'DJ Marcus', 'Experience the vibrant nightlife of Kampala through this energetic music video.', 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=400', '3:42', 'stream', 'music-video', 'video', false, 210000, 4.6);

  -- LISTEN content
  INSERT INTO media_content (user_id, title, creator_name, description, thumbnail_url, duration, type, category, content_type, is_premium, plays_count, rating) VALUES
    (content_user_id, 'Sunset Groove', 'DJ Alex', 'A smooth electronic track perfect for unwinding after a long day.', 'https://images.pexels.com/photos/417273/pexels-photo-417273.jpeg?auto=compress&cs=tinysrgb&w=400', '3:45', 'listen', 'Afrobeat', 'audio', false, 25000, 4.5),
    (content_user_id, 'Acoustic Soul', 'Maya Patel', 'Heartfelt acoustic melodies that touch the soul and inspire the heart.', 'https://images.pexels.com/photos/164821/pexels-photo-164821.jpeg?auto=compress&cs=tinysrgb&w=400', '2:50', 'listen', 'RnB', 'audio', false, 18000, 4.8),
    (content_user_id, 'Urban Pulse', 'Beat Master', 'High-energy hip-hop beats that capture the essence of city life.', 'https://images.pexels.com/photos/1047442/pexels-photo-1047442.jpeg?auto=compress&cs=tinysrgb&w=400', '4:20', 'listen', 'hip-hop', 'audio', false, 67000, 4.9),
    (content_user_id, 'Kampala Streets Mixtape', 'DJ Ronnie', 'The hottest tracks from Ugandan artists mixed to perfection.', 'https://images.pexels.com/photos/1626481/pexels-photo-1626481.jpeg?auto=compress&cs=tinysrgb&w=400', '45:12', 'listen', 'DJ-mixtapes', 'audio', false, 103000, 4.7);

  -- BLOG content
  INSERT INTO media_content (user_id, title, creator_name, description, thumbnail_url, read_time, type, category, content_type, is_premium, views_count, rating) VALUES
    (content_user_id, 'Interview with Legends', 'Maria Ryan', 'An exclusive conversation with industry pioneers about their journey to success.', 'https://images.pexels.com/photos/6953768/pexels-photo-6953768.jpeg?auto=compress&cs=tinysrgb&w=400', '5 min read', 'blog', 'interviews', 'blog', false, 8500, 4.6),
    (content_user_id, 'Mastering Your Brand Identity', 'Design Pro Studio', 'Essential tips for building a memorable brand that resonates with your audience.', 'https://images.pexels.com/photos/3184292/pexels-photo-3184292.jpeg?auto=compress&cs=tinysrgb&w=400', '8 min read', 'blog', 'lifestyle', 'blog', false, 12400, 4.8),
    (content_user_id, 'The Rise of African Tech', 'Samuel Osei', 'How technology startups are transforming the African continent.', 'https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&w=400', '12 min read', 'blog', 'others', 'blog', false, 19800, 4.9);

  -- GALLERY content
  INSERT INTO media_content (user_id, title, creator_name, description, thumbnail_url, type, category, content_type, is_premium, views_count, rating) VALUES
    (content_user_id, 'Brand Manual & Presets', 'Maya Chen', 'Professional brand guidelines and design presets for consistent visual identity.', 'https://images.pexels.com/photos/5554667/pexels-photo-5554667.jpeg?auto=compress&cs=tinysrgb&w=400', 'gallery', 'design', 'image', false, 1200, 4.7),
    (content_user_id, 'Portrait Photography Collection', 'Jedi Martinez', 'Stunning portrait photography showcasing diverse beauty and authentic emotions.', 'https://images.pexels.com/photos/4027606/pexels-photo-4027606.jpeg?auto=compress&cs=tinysrgb&w=400', 'gallery', 'photography', 'image', true, 2100, 4.9),
    (content_user_id, 'Modern Architecture Series', 'Studio Arch', 'Contemporary architectural photography featuring bold structures and clean lines.', 'https://images.pexels.com/photos/323780/pexels-photo-323780.jpeg?auto=compress&cs=tinysrgb&w=400', 'gallery', 'photography', 'image', false, 3450, 4.8),
    (content_user_id, 'Abstract Art Collection', 'Creative Minds', 'Bold and vibrant abstract art pieces that challenge perception.', 'https://images.pexels.com/photos/1269968/pexels-photo-1269968.jpeg?auto=compress&cs=tinysrgb&w=400', 'gallery', 'art', 'image', false, 1680, 4.5);

  -- RESOURCES content
  INSERT INTO media_content (user_id, title, creator_name, description, thumbnail_url, type, category, content_type, price, rating, is_premium, sales_count) VALUES
    (content_user_id, 'Social Media Templates Pack', 'Design Studio Pro', 'Complete social media template pack with 50+ customizable designs for all platforms.', 'https://images.pexels.com/photos/3861972/pexels-photo-3861972.jpeg?auto=compress&cs=tinysrgb&w=400', 'resources', 'templates', 'file', 115000, 4.8, false, 1250),
    (content_user_id, 'Producer''s Key Sound Kit', 'Beat Smith', 'Professional sound kit with 200+ samples, loops, and one-shots for producers.', 'https://images.pexels.com/photos/3990842/pexels-photo-3990842.jpeg?auto=compress&cs=tinysrgb&w=400', 'resources', 'presets', 'file', 190000, 4.9, false, 890),
    (content_user_id, 'Freelancer''s Guide to Contracts', 'Legal Experts', 'Comprehensive ebook with contract templates and legal advice for freelancers.', 'https://images.pexels.com/photos/8428076/pexels-photo-8428076.jpeg?auto=compress&cs=tinysrgb&w=400', 'resources', 'ebooks', 'file', 95000, 4.7, false, 540),
    (content_user_id, 'Photography Lightroom Presets', 'Visual Artists Co', 'Professional Lightroom presets for stunning photo edits with one click.', 'https://images.pexels.com/photos/1279813/pexels-photo-1279813.jpeg?auto=compress&cs=tinysrgb&w=400', 'resources', 'presets', 'file', 75000, 4.6, false, 2100);

END $$;
