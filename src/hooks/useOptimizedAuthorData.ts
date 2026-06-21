import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { optimizeImageUrl } from '@/utils/imageProxy';

interface OptimizedAuthorData {
  authorId: string | null;
  authorName: string;
  avatarUrl: string;
  bio: string;
  userId: string | null;
  followersCount: number;
  booksCount: number;
  isVerified: boolean;
  countryName: string | null;
  socialLinks: any;
  loading: boolean;
  error: string | null;
}

// تخزين مؤقت للبيانات لتجنب الطلبات المتكررة (في الذاكرة)
const authorCache = new Map<string, OptimizedAuthorData>();
const cacheTimeouts = new Map<string, NodeJS.Timeout>();

// تخزين مؤقت دائم في sessionStorage ليستمر بعد تحديث الصفحة
const SESSION_CACHE_PREFIX = 'authorDetailsCache:v1:';
const SESSION_CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 ساعة

const readSessionCache = (key: string): OptimizedAuthorData | null => {
  try {
    const raw = sessionStorage.getItem(SESSION_CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data || !parsed?.ts) return null;
    if (Date.now() - parsed.ts > SESSION_CACHE_TTL_MS) return null;
    return parsed.data as OptimizedAuthorData;
  } catch {
    return null;
  }
};

const writeSessionCache = (key: string, data: OptimizedAuthorData) => {
  try {
    sessionStorage.setItem(SESSION_CACHE_PREFIX + key, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // تجاهل أخطاء التخزين (مثلاً امتلاء المساحة)
  }
};

export const useOptimizedAuthorData = (authorName: string) => {
  // إنشاء مفتاح تخزين مؤقت
  const cacheKey = useMemo(() => {
    return authorName ? authorName.toLowerCase().trim() : '';
  }, [authorName]);

  // تهيئة الحالة من sessionStorage فوراً لتفادي وميض التحميل عند تحديث الصفحة
  const initialCached = cacheKey ? readSessionCache(cacheKey) : null;
  const [data, setData] = useState<OptimizedAuthorData>(() => initialCached ?? ({
    authorId: null,
    authorName,
    avatarUrl: '/lovable-uploads/b67a08a8-60e7-4592-9239-44d592bcd388.png',
    bio: '',
    userId: null,
    followersCount: 0,
    booksCount: 0,
    isVerified: false,
    countryName: null,
    socialLinks: {},
    loading: !initialCached,
    error: null
  }));

  useEffect(() => {
    if (!authorName || !cacheKey) {
      setData(prev => ({ ...prev, loading: false }));
      return;
    }

    // فحص التخزين المؤقت في الذاكرة أولاً
    const cachedData = authorCache.get(cacheKey);
    if (cachedData && !cachedData.loading) {
      setData(cachedData);
      writeSessionCache(cacheKey, cachedData);
      return;
    }

    // فحص sessionStorage ثم إظهار البيانات فوراً بدون إعادة جلب
    const sessionCached = readSessionCache(cacheKey);
    if (sessionCached && !sessionCached.loading) {
      setData(sessionCached);
      // لا نقوم بإعادة الجلب من Supabase طالما لدينا بيانات صالحة في الكاش
      return;
    }

    const fetchAuthorData = async () => {
      try {
        setData(prev => ({ ...prev, loading: true, error: null }));

        // استخدام الدالة المحسنة لجلب جميع بيانات المؤلف في طلب واحد
        const { data: authorData, error } = await supabase
          .rpc('get_complete_author_data', { p_author_name: authorName });

        if (error) {
          console.error('خطأ في جلب بيانات المؤلف:', error);
          
          // البحث بالطريقة التقليدية كحل احتياطي
          const { data: fallbackData } = await supabase
            .from('authors')
            .select('id, name, avatar_url, bio, user_id, followers_count, books_count, country_name, social_links')
            .eq('name', authorName)
            .maybeSingle();

          if (fallbackData) {
            const optimizedData: OptimizedAuthorData = {
              authorId: fallbackData.id,
              authorName: fallbackData.name,
            avatarUrl: optimizeImageUrl(fallbackData.avatar_url || '/lovable-uploads/b67a08a8-60e7-4592-9239-44d592bcd388.png', 'avatar'),
              bio: fallbackData.user_id ? '' : (fallbackData.bio || ''),
              userId: fallbackData.user_id,
              followersCount: fallbackData.followers_count || 0,
              booksCount: fallbackData.books_count || 0,
              isVerified: false, // سنحتاج للتحقق من التوثيق بشكل منفصل
              countryName: fallbackData.country_name,
              socialLinks: fallbackData.social_links || {},
              loading: false,
              error: null
            };

            setData(optimizedData);
            writeSessionCache(cacheKey, optimizedData);
            
            // حفظ في التخزين المؤقت لمدة 10 دقائق
            authorCache.set(cacheKey, optimizedData);
            
            // إزالة من التخزين المؤقت بعد 10 دقائق
            if (cacheTimeouts.has(cacheKey)) {
              clearTimeout(cacheTimeouts.get(cacheKey)!);
            }
            cacheTimeouts.set(cacheKey, setTimeout(() => {
              authorCache.delete(cacheKey);
              cacheTimeouts.delete(cacheKey);
            }, 10 * 60 * 1000));
          } else {
            setData(prev => ({
              ...prev,
              loading: false,
              error: 'لم يتم العثور على بيانات المؤلف'
            }));
          }
          return;
        }

        if (authorData && authorData.length > 0) {
          const author = authorData[0];
          
          // اختيار أفضل صورة متاحة (من الملف الشخصي أو من جدول المؤلفين)
          const bestAvatarUrl = optimizeImageUrl(
            author.profile_avatar || author.avatar_url || '/lovable-uploads/b67a08a8-60e7-4592-9239-44d592bcd388.png', 
            'avatar'
          );
          
          // اختيار النبذة:
          // - إذا كان المؤلف مربوطاً بحساب مستخدم (user_id موجود) فالمصدر الوحيد للنبذة هو ما يكتبه المستخدم في ملفه الشخصي،
          //   ولا نعرض النبذة المخزّنة في جدول authors (قد تكون مُولّدة آلياً).
          // - أما المؤلفون غير المرتبطين بحساب فنستخدم نبذة جدول authors كما هو الحال سابقاً.
          const bestBio = author.user_id
            ? (author.profile_bio || '')
            : (author.profile_bio || author.bio || '');

          const optimizedData: OptimizedAuthorData = {
            authorId: author.author_id,
            authorName: author.author_name,
            avatarUrl: bestAvatarUrl,
            bio: bestBio,
            userId: author.user_id,
            followersCount: author.followers_count || 0,
            booksCount: author.books_count || 0,
            isVerified: author.is_verified || false,
            countryName: author.country_name,
            socialLinks: author.social_links || {},
            loading: false,
            error: null
          };

          setData(optimizedData);
          writeSessionCache(cacheKey, optimizedData);
          
          // حفظ في التخزين المؤقت لمدة 10 دقائق
          authorCache.set(cacheKey, optimizedData);
          
          // إزالة من التخزين المؤقت بعد 10 دقائق
          if (cacheTimeouts.has(cacheKey)) {
            clearTimeout(cacheTimeouts.get(cacheKey)!);
          }
          cacheTimeouts.set(cacheKey, setTimeout(() => {
            authorCache.delete(cacheKey);
            cacheTimeouts.delete(cacheKey);
          }, 10 * 60 * 1000));

          console.log(`تم جلب بيانات المؤلف ${authorName} بنجاح من الدالة المحسنة`);
        } else {
          // إنشاء معرف افتراضي للمؤلف
          const fallbackId = authorName.toLowerCase().replace(/\s+/g, '-');
          
          const optimizedData: OptimizedAuthorData = {
            authorId: fallbackId,
            authorName,
            avatarUrl: '/lovable-uploads/b67a08a8-60e7-4592-9239-44d592bcd388.png',
            bio: '',
            userId: null,
            followersCount: 0,
            booksCount: 0,
            isVerified: false,
            countryName: null,
            socialLinks: {},
            loading: false,
            error: null
          };

          setData(optimizedData);
          writeSessionCache(cacheKey, optimizedData);
          
          // حفظ في التخزين المؤقت لمدة 5 دقائق فقط للبيانات الافتراضية
          authorCache.set(cacheKey, optimizedData);
          if (cacheTimeouts.has(cacheKey)) {
            clearTimeout(cacheTimeouts.get(cacheKey)!);
          }
          cacheTimeouts.set(cacheKey, setTimeout(() => {
            authorCache.delete(cacheKey);
            cacheTimeouts.delete(cacheKey);
          }, 5 * 60 * 1000));
        }

      } catch (err) {
        console.error('خطأ غير متوقع في جلب بيانات المؤلف:', err);
        setData(prev => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : 'حدث خطأ غير متوقع'
        }));
      }
    };

    fetchAuthorData();
  }, [authorName, cacheKey]);

  // دالة لمسح التخزين المؤقت إذا لزم الأمر
  const clearCache = () => {
    if (cacheKey && authorCache.has(cacheKey)) {
      authorCache.delete(cacheKey);
      if (cacheTimeouts.has(cacheKey)) {
        clearTimeout(cacheTimeouts.get(cacheKey)!);
        cacheTimeouts.delete(cacheKey);
      }
    }
  };

  // دالة لإعادة جلب البيانات
  const refetch = () => {
    clearCache();
    setData(prev => ({ ...prev, loading: true, error: null }));
  };

  return {
    ...data,
    clearCache,
    refetch
  };
};