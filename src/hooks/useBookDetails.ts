
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { validatePDFUrl, enhancePDFUrl } from '@/utils/pdfValidator';
import { convertPdfToProxyUrl } from '@/utils/imageProxy';

const isSupabasePublicFileUrl = (url: string) => url.includes('/storage/v1/object/public/');

interface BookDetails {
  id: string;
  title: string;
  subtitle?: string;
  author: string;
  author_image_url?: string;
  category: string;
  description: string;
  language: string;
  publication_year?: number;
  page_count?: number;
  publisher?: string;
  cover_image_url?: string;
  book_file_url?: string;
  file_type?: string;
  display_type?: string;
  views: number;
  rating?: number;
  created_at: string;
  user_email?: string;
  file_size?: number;
  slug?: string;
}

// ============= Persistent cache (sessionStorage) =============
// يحتفظ بآخر بيانات الكتاب لكل bookId/slug حتى عند تحديث الصفحة،
// بحيث يتم عرض البيانات فوراً بدون إعادة جلب من Supabase.
const CACHE_PREFIX = 'bookDetailsCache:v1:';
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 ساعة

const readCache = (key: string): BookDetails | null => {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data || !parsed?.ts) return null;
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed.data as BookDetails;
  } catch {
    return null;
  }
};

const writeCache = (key: string, data: BookDetails) => {
  try {
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ ts: Date.now(), data }));
    // خزّن نسخة ثانية تحت الـ id الحقيقي أيضاً لتسريع الوصول لاحقاً
    if (data.id && data.id !== key) {
      sessionStorage.setItem(CACHE_PREFIX + data.id, JSON.stringify({ ts: Date.now(), data }));
    }
    if (data.slug && data.slug !== key) {
      sessionStorage.setItem(CACHE_PREFIX + data.slug, JSON.stringify({ ts: Date.now(), data }));
    }
  } catch {
    // تجاهل أخطاء التخزين (مثلاً امتلاء المساحة)
  }
};

// Helper: fetch with retry on transient errors
const fetchBookWithRetry = async (bookId: string, retries = 2): Promise<{ data: any; error: any }> => {
  let lastError: any = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const { data, error } = await supabase.rpc('get_book_details', { p_book_id: bookId });
    if (!error) return { data, error: null };
    lastError = error;
    if (error.code === '42501') return { data: null, error };
    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }
  return { data: null, error: lastError };
};

export const useBookDetails = (bookId: string) => {
  // تهيئة الحالة من الكاش فوراً (متزامن) لتفادي وميض التحميل عند تحديث الصفحة
  const initialCached = bookId ? readCache(bookId) : null;
  const [book, setBook] = useState<BookDetails | null>(initialCached);
  const [loading, setLoading] = useState(!initialCached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    // قراءة من الكاش عند كل تغيير لـ bookId — عرض فوري
    const cached = readCache(bookId);
    if (cached) {
      setBook(cached);
      setLoading(false);
      setError(null);
      // تحديث خفيف في الخلفية لعدد المشاهدات فقط (stale-while-revalidate)
      // حتى تظهر زيادة المشاهدات بعد القراءة دون إعادة جلب كامل
      (async () => {
        try {
          const { data, error } = await supabase
            .from('book_submissions')
            .select('views')
            .eq('id', cached.id)
            .maybeSingle();
          if (cancelled || error || !data) return;
          const freshViews = (data as any).views ?? 0;
          if (freshViews !== cached.views) {
            const updated = { ...cached, views: freshViews };
            setBook(updated);
            writeCache(bookId, updated);
          }
        } catch {
          // تجاهل
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    const fetchBookDetails = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: supabaseError } = await fetchBookWithRetry(bookId, 2);

        if (cancelled) return;

        if (supabaseError && supabaseError.code === '42501') {
          setError('ليس لديك تصريح لرؤية هذا الكتاب');
          setBook(null);
          return;
        }
        if (supabaseError) {
          setError('فشل في تحميل تفاصيل الكتاب');
          return;
        }

        if (data && data.length > 0) {
          const bookData = data[0];

          let pdfUrl = bookData.book_file_url;
          if (pdfUrl) {
            if (!validatePDFUrl(pdfUrl)) {
              if (!pdfUrl.startsWith('http')) {
                pdfUrl = 'https://' + pdfUrl;
              }
            }
            if (isSupabasePublicFileUrl(pdfUrl)) {
              pdfUrl = convertPdfToProxyUrl(pdfUrl);
            }
          }

          if (cancelled) return;

          const formattedBookData: BookDetails = {
            id: bookData.id,
            title: bookData.title,
            subtitle: bookData.subtitle,
            author: bookData.author,
            author_image_url: bookData.author_image_url,
            category: bookData.category,
            description: bookData.description,
            language: bookData.language,
            publication_year: bookData.publication_year,
            page_count: bookData.page_count,
            cover_image_url: bookData.cover_image_url,
            book_file_url: pdfUrl,
            file_type: bookData.file_type,
            display_type: bookData.display_type,
            views: bookData.views || 0,
            rating: bookData.rating,
            created_at: bookData.created_at,
            user_email: bookData.user_email,
            file_size: bookData.file_size,
            slug: bookData.slug,
            publisher: bookData.publisher
          };
          if (!cancelled) {
            setBook(formattedBookData);
            writeCache(bookId, formattedBookData);
          }
        } else {
          if (!cancelled) setError('الكتاب غير موجود أو ليس لديك إذن عرض');
        }
      } catch (err: any) {
        if (cancelled) return;
        if (err?.code === '42501' || err?.message?.includes('permission')) {
          setError('ليس لديك تصريح لرؤية هذا المحتوى');
        } else {
          setError('فشل في تحميل تفاصيل الكتاب');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchBookDetails();
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  return { book, loading, error };
};
