import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

// تحويل ملف صورة إلى data URL (مع تصغير لتقليل حجم الإرسال للـ AI)
const fileToCompressedDataUrl = (file: File, maxDim = 1024, quality = 0.75): Promise<string> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('canvas ctx');
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
};

// التقاط إطار تمثيلي من ملف فيديو (الثانية 1 أو منتصف الفيديو)
const videoFileToFrameDataUrl = (file: File, maxDim = 1024, quality = 0.75): Promise<string> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    const cleanup = () => URL.revokeObjectURL(url);

    video.onloadedmetadata = () => {
      const seekTo = Math.min(1, (video.duration || 2) / 2);
      const onSeeked = () => {
        try {
          const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
          const w = Math.max(1, Math.round(video.videoWidth * scale));
          const h = Math.max(1, Math.round(video.videoHeight * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('canvas ctx');
          ctx.drawImage(video, 0, 0, w, h);
          cleanup();
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch (e) {
          cleanup();
          reject(e);
        }
      };
      video.onseeked = onSeeked;
      try {
        video.currentTime = seekTo;
      } catch (e) {
        cleanup();
        reject(e);
      }
    };
    video.onerror = (e) => { cleanup(); reject(e); };
  });
};

export interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption: string | null;
  duration: number;
  created_at: string;
  expires_at: string;
  is_active: boolean;
  book_id: string | null;
  book_slug: string | null;
}

export interface StoryWithUser extends Story {
  user: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
  views_count: number;
  is_viewed: boolean;
}

export interface GroupedStories {
  user: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
  stories: StoryWithUser[];
  has_unviewed: boolean;
}

export interface StoryViewer {
  id: string;
  viewer_id: string;
  viewed_at: string;
  has_liked: boolean;
  viewer: {
    username: string;
    avatar_url: string | null;
  };
}

// كاش عام يبقى صالحاً طوال الجلسة (يبقى حتى بعد تحديث الصفحة عبر sessionStorage)
const STORIES_CACHE_KEY = 'stories_cache_v1';
const STORIES_FETCHED_KEY = 'stories_fetched_v1';

const loadStoriesCache = (): GroupedStories[] => {
  try {
    const c = sessionStorage.getItem(STORIES_CACHE_KEY);
    return c ? JSON.parse(c) : [];
  } catch { return []; }
};

let globalStoriesCache: GroupedStories[] = typeof window !== 'undefined' ? loadStoriesCache() : [];
let globalCacheLoaded: boolean = typeof window !== 'undefined' && sessionStorage.getItem(STORIES_FETCHED_KEY) === '1';

export const useStories = () => {
  const { user } = useAuth();
  const [stories, setStories] = useState<GroupedStories[]>(globalStoriesCache);
  const [loading, setLoading] = useState(!globalCacheLoaded);
  const [uploading, setUploading] = useState(false);
  const fetchingRef = useRef(false);

  // جلب جميع القصص النشطة مجمعة حسب المستخدم
  const fetchStories = useCallback(async (force = false) => {
    // منع الجلب المتكرر المتزامن
    if (fetchingRef.current) return;
    
    // استخدام الكاش إذا تم التحميل مسبقاً (لا يتم التحديث إلا يدوياً أو عند force)
    if (!force && globalCacheLoaded && globalStoriesCache.length >= 0) {
      setStories(globalStoriesCache);
      setLoading(false);
      return;
    }

    try {
      fetchingRef.current = true;
      // لا نضع loading=true إذا كان لدينا بيانات مخزنة مؤقتاً
      if (globalStoriesCache.length === 0) {
        setLoading(true);
      }
      
      const { data: storiesData, error: storiesError } = await supabase
        .from('stories')
        .select('*')
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (storiesError) throw storiesError;

      if (!storiesData || storiesData.length === 0) {
        globalStoriesCache = [];
        globalCacheLoaded = true;
        try {
          sessionStorage.setItem(STORIES_CACHE_KEY, '[]');
          sessionStorage.setItem(STORIES_FETCHED_KEY, '1');
        } catch {}
        setStories([]);
        return;
      }

      const userIds = [...new Set(storiesData.map(s => s.user_id))];
      const storyIds = storiesData.map(s => s.id);

      // جلب البيانات بالتوازي لتسريع التحميل
      const [profilesResult, viewsResult, viewsCountsResult] = await Promise.all([
        supabase.from('profiles').select('id, username, avatar_url').in('id', userIds),
        user 
          ? supabase.from('story_views').select('story_id').eq('viewer_id', user.id).in('story_id', storyIds)
          : Promise.resolve({ data: [] }),
        supabase.from('story_views').select('story_id').in('story_id', storyIds),
      ]);

      const viewedStoryIds = viewsResult.data?.map(v => v.story_id) || [];

      const viewsCountMap: Record<string, number> = {};
      viewsCountsResult.data?.forEach(v => {
        viewsCountMap[v.story_id] = (viewsCountMap[v.story_id] || 0) + 1;
      });

      const profilesMap = new Map(profilesResult.data?.map(p => [p.id, p]) || []);
      
      const storiesWithUsers: StoryWithUser[] = storiesData.map(story => ({
        ...story,
        media_type: story.media_type as 'image' | 'video',
        user: profilesMap.get(story.user_id) || { 
          id: story.user_id, 
          username: 'مستخدم', 
          avatar_url: null 
        },
        views_count: viewsCountMap[story.id] || 0,
        is_viewed: viewedStoryIds.includes(story.id),
      }));

      const grouped: Record<string, GroupedStories> = {};
      
      storiesWithUsers.forEach(story => {
        if (!grouped[story.user_id]) {
          grouped[story.user_id] = {
            user: story.user,
            stories: [],
            has_unviewed: false,
          };
        }
        grouped[story.user_id].stories.push(story);
        if (!story.is_viewed) {
          grouped[story.user_id].has_unviewed = true;
        }
      });

      const sortedGroups = Object.values(grouped).sort((a, b) => {
        if (user && a.user.id === user.id) return -1;
        if (user && b.user.id === user.id) return 1;
        if (a.has_unviewed && !b.has_unviewed) return -1;
        if (!a.has_unviewed && b.has_unviewed) return 1;
        return 0;
      });

      // تحديث الكاش العام
      globalStoriesCache = sortedGroups;
      globalCacheLoaded = true;
      try {
        sessionStorage.setItem(STORIES_CACHE_KEY, JSON.stringify(sortedGroups));
        sessionStorage.setItem(STORIES_FETCHED_KEY, '1');
      } catch {}

      setStories(sortedGroups);
    } catch (error) {
      console.error('Error fetching stories:', error);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [user]);
  // إضافة قصة جديدة
  const addStory = async (file: File, caption?: string, bookInfo?: { bookId: string; bookSlug: string }) => {
    if (!user) {
      toast.error('يجب تسجيل الدخول لإضافة قصة');
      return null;
    }

    try {
      setUploading(true);

      const isVideo = file.type.startsWith('video/');
      const mediaType = isVideo ? 'video' : 'image';

      // 🛡️ فحص المحتوى بالذكاء الاصطناعي قبل الرفع
      try {
        const previewDataUrl = isVideo
          ? await videoFileToFrameDataUrl(file)
          : await fileToCompressedDataUrl(file);

        const { data: modData, error: modError } = await supabase.functions.invoke(
          'moderate-story-content',
          { body: { image_data_url: previewDataUrl, caption: caption || '' } },
        );

        if (!modError && modData && modData.allowed === false) {
          const msg = modData.message || 'تم رفض القصة: المحتوى غير مسموح به في منصة كتب.';
          toast.error(msg);
          setUploading(false);
          return null;
        }
      } catch (modErr) {
        // في حالة فشل الفحص نتابع النشر حتى لا نوقف الخدمة
        console.warn('Story moderation skipped due to error:', modErr);
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('stories')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('stories')
        .getPublicUrl(fileName);

      const { data: storyData, error: storyError } = await supabase
        .from('stories')
        .insert({
          user_id: user.id,
          media_url: urlData.publicUrl,
          media_type: mediaType,
          caption: caption || null,
          duration: isVideo ? 15 : 5,
          book_id: bookInfo?.bookId || null,
          book_slug: bookInfo?.bookSlug || null,
        })
        .select()
        .single();

      if (storyError) throw storyError;

      toast.success('تم نشر القصة بنجاح!');
      fetchStories(true);
      return storyData;
    } catch (error) {
      console.error('Error adding story:', error);
      toast.error('حدث خطأ في نشر القصة');
      return null;
    } finally {
      setUploading(false);
    }
  };

  // حذف قصة
  const deleteStory = async (storyId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('stories')
        .delete()
        .eq('id', storyId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success('تم حذف القصة');
      fetchStories(true);
      return true;
    } catch (error) {
      console.error('Error deleting story:', error);
      toast.error('حدث خطأ في حذف القصة');
      return false;
    }
  };

  // تسجيل مشاهدة
  const recordView = async (storyId: string) => {
    if (!user) return;

    try {
      await supabase
        .from('story_views')
        .upsert({
          story_id: storyId,
          viewer_id: user.id,
        }, {
          onConflict: 'story_id,viewer_id',
        });
    } catch (error) {
      console.error('Error recording view:', error);
    }
  };

  // جلب قائمة المشاهدين
  const getStoryViewers = async (storyId: string): Promise<StoryViewer[]> => {
    try {
      const [viewsResult, likesResult] = await Promise.all([
        supabase
          .from('story_views')
          .select('id, viewer_id, viewed_at')
          .eq('story_id', storyId)
          .order('viewed_at', { ascending: false }),
        supabase
          .from('story_likes')
          .select('user_id')
          .eq('story_id', storyId),
      ]);

      if (viewsResult.error) throw viewsResult.error;

      const viewsData = viewsResult.data;
      if (!viewsData || viewsData.length === 0) return [];

      const likedUserIds = new Set(likesResult.data?.map(l => l.user_id) || []);

      const viewerIds = viewsData.map(v => v.viewer_id);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', viewerIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

      return viewsData.map(view => ({
        ...view,
        has_liked: likedUserIds.has(view.viewer_id),
        viewer: profilesMap.get(view.viewer_id) || {
          username: 'مستخدم',
          avatar_url: null,
        },
      }));
    } catch (error) {
      console.error('Error fetching viewers:', error);
      return [];
    }
  };

  // إعجاب / إلغاء إعجاب بقصة
  const toggleLike = async (storyId: string): Promise<boolean | null> => {
    if (!user) return null;

    try {
      // التحقق هل أعجب بها مسبقاً
      const { data: existing } = await supabase
        .from('story_likes')
        .select('id')
        .eq('story_id', storyId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        // إلغاء الإعجاب
        await supabase
          .from('story_likes')
          .delete()
          .eq('id', existing.id);
        return false;
      } else {
        // إضافة إعجاب
        await supabase
          .from('story_likes')
          .insert({
            story_id: storyId,
            user_id: user.id,
          });
        return true;
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      return null;
    }
  };

  // التحقق من حالة الإعجاب
  const isStoryLiked = async (storyId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { data } = await supabase
        .from('story_likes')
        .select('id')
        .eq('story_id', storyId)
        .eq('user_id', user.id)
        .maybeSingle();

      return !!data;
    } catch {
      return false;
    }
  };

  // جلب عدد الإعجابات
  const getStoryLikesCount = async (storyId: string): Promise<number> => {
    try {
      const { count } = await supabase
        .from('story_likes')
        .select('id', { count: 'exact', head: true })
        .eq('story_id', storyId);

      return count || 0;
    } catch {
      return 0;
    }
  };

  const hasMyStory = stories.some(g => g.user.id === user?.id);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  return {
    stories,
    loading,
    uploading,
    hasMyStory,
    addStory,
    deleteStory,
    recordView,
    getStoryViewers,
    toggleLike,
    isStoryLiked,
    getStoryLikesCount,
    refreshStories: fetchStories,
  };
};
