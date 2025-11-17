import { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Image, Headphones, ShoppingBag, Heart, Share2, MessageCircle, Eye, Filter, Search, Star, Download, Rss, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

interface MediaItem {
  id: string;
  title: string;
  creator_name: string;
  thumbnail_url: string;
  duration?: string;
  read_time?: string;
  category: string;
  type: string;
  content_type: string;
  description: string;
  price?: number;
  rating: number;
  is_premium: boolean;
  views_count: number;
  plays_count: number;
  sales_count: number;
  likes_count?: number;
  is_liked?: boolean;
  is_following?: boolean;
}

const ITEMS_PER_PAGE = 12;
const SELECTED_FIELDS = 'id,title,creator_name,thumbnail_url,duration,read_time,category,type,content_type,description,price,rating,is_premium,views_count,plays_count,sales_count,likes_count';

interface CacheEntry {
  data: MediaItem[];
  timestamp: number;
  userLikes: Set<string>;
  userFollows: Set<string>;
}

const cache = new Map<string, CacheEntry>();
const CACHE_DURATION = 5 * 60 * 1000;

export default function Media() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('stream');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [mediaContent, setMediaContent] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const fetchInProgressRef = useRef(false);
  const userLikesCache = useRef<Map<string, Set<string>>>(new Map());
  const userFollowsCache = useRef<Map<string, Set<string>>>(new Map());

  const categories = {
    stream: ['all', 'movie', 'music-video', 'documentaries', 'lifestyle', 'Go Live'],
    listen: ['all', 'greatest-of-all-time', 'latest-release', 'new-talent', 'DJ-mixtapes', 'UG-Unscripted', 'Afrobeat', 'hip-hop', 'RnB', 'Others'],
    blog: ['all', 'interviews', 'lifestyle', 'product-reviews', 'others'],
    gallery: ['all', 'design', 'photography', 'art', 'others'],
    resources: ['all', 'templates', 'ebooks', 'software', 'presets']
  };

  const tabs = useMemo(() => [
    { id: 'stream', label: 'Stream', icon: <Play className="w-5 h-5" /> },
    { id: 'listen', label: 'Listen', icon: <Headphones className="w-5 h-5" /> },
    { id: 'blog', label: 'Blog', icon: <Rss className="w-5 h-5" /> },
    { id: 'gallery', label: 'Gallery', icon: <Image className="w-5 h-5" /> },
    { id: 'resources', label: 'Resources', icon: <ShoppingBag className="w-5 h-5" /> }
  ], []);

  const fetchUserInteractions = useCallback(async (userId: string): Promise<{ likes: Set<string>; follows: Set<string> }> => {
    try {
      const cachedLikes = userLikesCache.current.get(userId);
      const cachedFollows = userFollowsCache.current.get(userId);

      if (cachedLikes && cachedFollows) {
        return { likes: cachedLikes, follows: cachedFollows };
      }

      const [{ data: userLikesData }, { data: userFollowsData }] = await Promise.all([
        supabase.from('media_likes').select('media_id').eq('user_id', userId),
        supabase.from('creator_follows').select('creator_name').eq('follower_id', userId)
      ]);

      const likes = new Set((userLikesData || []).map(l => l.media_id));
      const follows = new Set((userFollowsData || []).map(f => f.creator_name));

      userLikesCache.current.set(userId, likes);
      userFollowsCache.current.set(userId, follows);

      return { likes, follows };
    } catch (error) {
      console.error('Error fetching user interactions:', error);
      return { likes: new Set(), follows: new Set() };
    }
  }, []);

  const fetchMediaContent = useCallback(async () => {
    if (fetchInProgressRef.current) return;
    fetchInProgressRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const cacheKey = `${activeTab}-${selectedCategory}-${searchQuery}`;
      const cachedEntry = cache.get(cacheKey);
      const now = Date.now();

      const buildQuery = () => {
        let query = supabase.from('media_content').select(SELECTED_FIELDS, { count: 'exact' }).eq('type', activeTab);

        if (selectedCategory !== 'all') {
          query = query.eq('category', selectedCategory);
        }

        if (searchQuery) {
          query = query.or(`title.ilike.%${searchQuery}%,creator_name.ilike.%${searchQuery}%`);
        }

        return query.order('created_at', { ascending: false });
      };

      if (cachedEntry && now - cachedEntry.timestamp < CACHE_DURATION && !user) {
        const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIdx = startIdx + ITEMS_PER_PAGE;
        const paginatedData = cachedEntry.data.slice(startIdx, endIdx);
        setMediaContent(paginatedData);
        setTotalItems(cachedEntry.data.length);
      } else {
        const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
        const { data: mediaData, error: mediaError, count } = await buildQuery()
          .range(startIdx, startIdx + ITEMS_PER_PAGE - 1);

        if (mediaError) throw mediaError;

        if (mediaData && mediaData.length > 0) {
          let userLikes = new Set<string>();
          let userFollows = new Set<string>();

          if (user) {
            const interactions = await fetchUserInteractions(user.id);
            userLikes = interactions.likes;
            userFollows = interactions.follows;
          }

          const enrichedData = (mediaData || []).map((item) => ({
            ...item,
            likes_count: item.likes_count || 0,
            is_liked: userLikes.has(item.id),
            is_following: userFollows.has(item.creator_name),
          }));

          setMediaContent(enrichedData);
          setTotalItems(count || 0);

          if (!user) {
            cache.set(cacheKey, {
              data: enrichedData,
              timestamp: now,
              userLikes,
              userFollows,
            });
          }
        } else {
          setMediaContent([]);
          setTotalItems(0);
        }
      }
    } catch (error) {
      console.error('Error fetching media:', error);
      setError('Failed to load media content. Please try again.');
      setMediaContent([]);
    } finally {
      fetchInProgressRef.current = false;
      setLoading(false);
    }
  }, [activeTab, selectedCategory, searchQuery, currentPage, user, fetchUserInteractions]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, selectedCategory]);

  useEffect(() => {
    fetchMediaContent();
  }, [activeTab, user, currentPage, fetchMediaContent]);

  useEffect(() => {
    if (!user) return;

    const likesSubscription = supabase
      .channel(`media_likes_${activeTab}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'media_likes' }, () => {
        if (!fetchInProgressRef.current) {
          userLikesCache.current.delete(user.id);
          fetchMediaContent();
        }
      })
      .subscribe();

    const followsSubscription = supabase
      .channel(`creator_follows_${activeTab}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'creator_follows' }, () => {
        if (!fetchInProgressRef.current) {
          userFollowsCache.current.delete(user.id);
          fetchMediaContent();
        }
      })
      .subscribe();

    return () => {
      likesSubscription.unsubscribe();
      followsSubscription.unsubscribe();
    };
  }, [user, activeTab, fetchMediaContent]);

  const handleLike = useCallback(async (mediaId: string) => {
    if (!user) {
      alert('Please sign in to like content.');
      navigate('/signin');
      return;
    }

    const item = mediaContent.find((m) => m.id === mediaId);
    if (!item) return;

    const wasLiked = item.is_liked;
    const previousContent = mediaContent;

    try {
      setMediaContent((prev) =>
        prev.map((m) =>
          m.id === mediaId
            ? {
                ...m,
                is_liked: !wasLiked,
                likes_count: wasLiked ? Math.max(0, (m.likes_count || 0) - 1) : (m.likes_count || 0) + 1
              }
            : m
        )
      );

      if (wasLiked) {
        const { error } = await supabase
          .from('media_likes')
          .delete()
          .eq('media_id', mediaId)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('media_likes')
          .insert({ media_id: mediaId, user_id: user.id });

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      setMediaContent(previousContent);
      setError('Failed to update like. Please try again.');
    }
  }, [user, mediaContent, navigate]);

  const handleFollow = useCallback(async (creatorName: string) => {
    if (!user) {
      alert('Please sign in to follow creators.');
      navigate('/signin');
      return;
    }

    const wasFollowing = mediaContent.some(m => m.creator_name === creatorName && m.is_following);
    const previousContent = mediaContent;

    try {
      setMediaContent((prev) =>
        prev.map((m) =>
          m.creator_name === creatorName
            ? { ...m, is_following: !wasFollowing }
            : m
        )
      );

      if (wasFollowing) {
        const { error } = await supabase
          .from('creator_follows')
          .delete()
          .eq('creator_name', creatorName)
          .eq('follower_id', user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('creator_follows')
          .insert({ creator_name: creatorName, follower_id: user.id });

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      setMediaContent(previousContent);
      setError('Failed to update follow status. Please try again.');
    }
  }, [user, mediaContent, navigate]);

  const handleSubscribe = useCallback(() => {
    if (!user) {
      alert('Please sign in to subscribe.');
      navigate('/signin');
      return;
    }
    alert('Premium subscription activated! Enjoy exclusive content.');
  }, [user, navigate]);

  const filteredContent = useMemo(() => {
    return mediaContent.filter((item) => {
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const matchesSearch =
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.creator_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

      return matchesCategory && matchesSearch;
    });
  }, [mediaContent, selectedCategory, searchQuery]);

  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  return (
    <div className="min-h-screen pt-20 pb-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-playfair font-bold text-white mb-2">Media</h1>
          <p className="text-gray-300">Celebrate amazing content from the Creators of your choice.</p>
        </div>

        <div className="flex space-x-1 mb-8 glass-effect p-2 rounded-xl overflow-x-auto whitespace-nowrap">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all duration-300 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-rose-500 to-purple-600 text-white shadow-lg'
                  : 'text-gray-300 hover:text-white hover:bg-white/10'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 glass-effect rounded-xl border border-white/20 text-white placeholder-gray-400 focus:ring-2 focus:ring-rose-400 focus:border-transparent transition-all"
            />
          </div>

          <div className="flex items-center space-x-4">
            <Filter className="text-gray-400 w-5 h-5" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-3 glass-effect rounded-xl border border-white/20 text-white bg-transparent focus:ring-2 focus:ring-rose-400 focus:border-transparent transition-all"
            >
              {categories[activeTab as keyof typeof categories]?.map((category) => (
                <option key={category} value={category} className="bg-gray-800">
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
            <p className="text-red-300">{error}</p>
            <button
              onClick={() => {
                setError(null);
                fetchMediaContent();
              }}
              className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors text-sm"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-400 mx-auto"></div>
            <p className="text-gray-400 mt-4">Loading content...</p>
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredContent.map((item) => (
                <MediaCard
                  key={item.id}
                  item={item}
                  activeTab={activeTab}
                  onLike={handleLike}
                  onFollow={handleFollow}
                  onSubscribe={handleSubscribe}
                  user={user}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-8 flex justify-center items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 glass-effect rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10 transition-colors"
                >
                  Previous
                </button>
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = Math.max(1, currentPage - 2) + i;
                    if (pageNum > totalPages) return null;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-2 rounded-lg transition-all ${
                          currentPage === pageNum
                            ? 'bg-gradient-to-r from-rose-500 to-purple-600 text-white'
                            : 'glass-effect text-gray-300 hover:text-white'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 glass-effect rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}

        {!loading && filteredContent.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              {activeTab === 'stream' && <Play className="w-16 h-16 mx-auto mb-4" />}
              {activeTab === 'listen' && <Headphones className="w-16 h-16 mx-auto mb-4" />}
              {activeTab === 'blog' && <Rss className="w-16 h-16 mx-auto mb-4" />}
              {activeTab === 'gallery' && <Image className="w-16 h-16 mx-auto mb-4" />}
              {activeTab === 'resources' && <ShoppingBag className="w-16 h-16 mx-auto mb-4" />}
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No content available</h3>
            <p className="text-gray-400">Check back later for new {activeTab} content!</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface MediaCardProps {
  item: MediaItem;
  activeTab: string;
  onLike: (id: string) => void;
  onFollow: (name: string) => void;
  onSubscribe: () => void;
  user: any;
}

const MediaCard = ({ item, activeTab, onLike, onFollow, onSubscribe, user }: MediaCardProps) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <div className="glass-effect rounded-2xl overflow-hidden hover-lift group">
      <div className="relative aspect-video bg-gray-800">
        <img
          src={item.thumbnail_url}
          alt={item.title}
          loading="lazy"
          onLoad={() => setImageLoaded(true)}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
        {!imageLoaded && (
          <div className="absolute inset-0 bg-gradient-to-r from-gray-800 to-gray-700 animate-pulse" />
        )}

        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          {activeTab === 'stream' && <Play className="w-12 h-12 text-white" />}
          {activeTab === 'listen' && <Headphones className="w-12 h-12 text-white" />}
          {activeTab === 'blog' && <Rss className="w-12 h-12 text-white" />}
          {activeTab === 'resources' && <ShoppingBag className="w-12 h-12 text-white" />}
        </div>

        {item.is_premium && (
          <div className="absolute top-2 right-2 px-2 py-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-black text-xs font-bold rounded-full">
            PREMIUM
          </div>
        )}

        {(activeTab === 'stream' || activeTab === 'listen') && item.duration && (
          <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 text-white text-xs rounded">
            {item.duration}
          </div>
        )}
        {activeTab === 'blog' && item.read_time && (
          <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 text-white text-xs rounded">
            {item.read_time}
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="text-white font-semibold mb-2 line-clamp-2">{item.title}</h3>
        <p className="text-gray-400 text-sm mb-3">{item.creator_name}</p>

        <div className="flex items-center justify-between text-sm text-gray-400 mb-4">
          {activeTab === 'stream' && (
            <>
              <div className="flex items-center space-x-1">
                <Eye className="w-4 h-4" />
                <span>{item.views_count.toLocaleString()}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Heart className={`w-4 h-4 ${item.is_liked ? 'fill-rose-400 text-rose-400' : ''}`} />
                <span>{item.likes_count || 0}</span>
              </div>
            </>
          )}
          {activeTab === 'listen' && (
            <div className="flex items-center space-x-1">
              <Play className="w-4 h-4" />
              <span>{item.plays_count.toLocaleString()} plays</span>
            </div>
          )}
          {activeTab === 'blog' && (
            <div className="flex items-center space-x-1">
              <MessageCircle className="w-4 h-4" />
              <span>{item.views_count}</span>
            </div>
          )}
          {activeTab === 'gallery' && (
            <div className="flex items-center space-x-1">
              <Heart className={`w-4 h-4 ${item.is_liked ? 'fill-rose-400 text-rose-400' : ''}`} />
              <span>{item.likes_count || 0}</span>
            </div>
          )}

          {activeTab === 'resources' && (
            <>
              <div className="flex items-center space-x-1">
                <Star className="w-4 h-4 text-yellow-400" />
                <span>{item.rating.toFixed(1)}</span>
              </div>
              <div className="text-rose-400 font-bold">UGX {item.price?.toLocaleString()}</div>
            </>
          )}
        </div>

        <div className="flex space-x-2">
          {activeTab === 'resources' ? (
            <>
              <button className="flex-1 py-2 bg-gradient-to-r from-rose-500 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all text-sm font-medium">
                Buy Now
              </button>
              <button className="p-2 glass-effect text-gray-400 hover:text-white rounded-lg transition-colors">
                <Download className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onFollow(item.creator_name)}
                className={`flex-1 py-2 rounded-lg hover:shadow-lg transition-all text-sm font-medium ${
                  item.is_following
                    ? 'bg-gray-600 text-white'
                    : 'bg-gradient-to-r from-rose-500 to-purple-600 text-white'
                }`}
              >
                {item.is_following ? 'Following' : 'Follow'}
              </button>
              <button
                onClick={() => onLike(item.id)}
                className={`p-2 glass-effect rounded-lg transition-colors ${
                  item.is_liked ? 'text-rose-400' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Heart className={`w-4 h-4 ${item.is_liked ? 'fill-current' : ''}`} />
              </button>
              <button className="p-2 glass-effect text-gray-400 hover:text-white rounded-lg transition-colors">
                <Share2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {item.is_premium && user?.tier === 'free' && (
          <div className="mt-3 p-3 bg-gradient-to-r from-yellow-400/20 to-orange-500/20 border border-yellow-400/30 rounded-lg">
            <p className="text-yellow-400 text-xs mb-2">Premium content - Subscribe to unlock</p>
            <button
              onClick={onSubscribe}
              className="w-full py-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-black text-xs font-bold rounded"
            >
              Subscribe Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
