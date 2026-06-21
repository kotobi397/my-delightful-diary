
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SimpleBookCard } from './SimpleBookCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, LoaderCircle } from 'lucide-react';
import { useCategoryImagesPreloader } from '@/hooks/useImagePreloader';

interface SimilarBook {
  id: string;
  title: string;
  author: string;
  cover_image_url: string;
  category: string;
  created_at: string;
  rating?: number;
}

interface SimilarBooksProps {
  bookId: string;
  category: string;
  darkMode?: boolean;
}

const SimilarBooks: React.FC<SimilarBooksProps> = ({ bookId, category, darkMode = false }) => {
  const [similarBooks, setSimilarBooks] = useState<SimilarBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const loadingRef = useRef<HTMLDivElement>(null);
  const BOOKS_PER_PAGE = 24;
  
  // تحميل مسبق لصور الكتب المشابهة - 24 دفعة واحدة
  useCategoryImagesPreloader(similarBooks);

  // مراقب التمرير للتحميل التلقائي - نفس نظام الواجهة الرئيسية
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting && hasMore && !loadingMore && !loading) {
          console.log('تحميل المزيد من الكتب المشابهة...');
          // تأخير لمدة ثانيتين مثل الواجهة الرئيسية
          setTimeout(() => {
            fetchSimilarBooks(currentPage + 1, true);
          }, 2000);
        }
      },
      {
        threshold: 0.1,
        rootMargin: '100px'
      }
    );

    if (loadingRef.current) {
      observer.observe(loadingRef.current);
    }

    return () => {
      if (loadingRef.current) {
        observer.unobserve(loadingRef.current);
      }
    };
  }, [hasMore, loadingMore, loading, currentPage]);

  const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 ساعة
  const SHARED_SESSION_ID = 'similar_books_shared';
  const getCacheKey = (page: number) => `similar_books:${bookId}:${category}:${page}`;
  const getPagePath = () => `/book/${bookId}/similar`;

  const readCache = async (page: number): Promise<SimilarBook[] | null> => {
    try {
      const { data, error } = await supabase
        .from('page_state_cache')
        .select('data_payload, expires_at')
        .eq('cache_key', getCacheKey(page))
        .maybeSingle();
      if (error || !data) return null;
      if (new Date(data.expires_at).getTime() < Date.now()) return null;
      const payload = data.data_payload as any;
      return (payload?.books ?? null) as SimilarBook[] | null;
    } catch {
      return null;
    }
  };

  const writeCache = async (page: number, books: SimilarBook[]) => {
    try {
      const now = Date.now();
      await supabase
        .from('page_state_cache')
        .upsert({
          cache_key: getCacheKey(page),
          page_path: getPagePath(),
          session_id: SHARED_SESSION_ID,
          timestamp: now,
          data_payload: { books } as any,
          expires_at: new Date(now + CACHE_TTL_MS).toISOString(),
        }, { onConflict: 'cache_key' });
    } catch (e) {
      console.warn('[SimilarBooks] فشل الكتابة في الكاش:', e);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // محاولة استرجاع كل الصفحات المخزنة مسبقاً من Supabase
      const cachedPages: SimilarBook[] = [];
      let page = 0;
      let lastPageSize = BOOKS_PER_PAGE;
      while (true) {
        const cached = await readCache(page);
        if (!cached) break;
        cachedPages.push(...cached);
        lastPageSize = cached.length;
        page++;
        if (page > 50) break; // حماية
      }
      if (cancelled) return;
      if (cachedPages.length > 0) {
        setSimilarBooks(cachedPages);
        setCurrentPage(page - 1);
        setHasMore(lastPageSize === BOOKS_PER_PAGE);
        setLoading(false);
        console.log(`[SimilarBooks] تم تحميل ${cachedPages.length} كتاب من كاش Supabase`);
        return;
      }
      fetchSimilarBooks();
    })();
    return () => { cancelled = true; };
  }, [bookId, category]);

  const fetchSimilarBooks = async (page = 0, append = false) => {
    try {
      if (page === 0) {
        setLoading(true);
        setSimilarBooks([]);
      } else {
        setLoadingMore(true);
      }
      
      console.log('[SimilarBooks] جلب الكتب المشابهة للتصنيف:', category, 'الصفحة:', page + 1);

      // استعلام واحد بمساواة دقيقة على التصنيف يستفيد من
      // idx_book_submissions_approved_category_created. كان استخدام
      // ILIKE المتعدد على عمود category يجبر Postgres على فحص ~28k صف
      // في كل فتح صفحة كتاب وكان أحد أهم أسباب استنزاف Supabase.
      const { data, error } = await supabase
        .from('book_submissions')
        .select('id, title, author, cover_image_url, s3_cover_image_url, category, created_at, rating')
        .eq('status', 'approved')
        .eq('category', category)
        .neq('id', bookId)
        .order('created_at', { ascending: false })
        .range(page * BOOKS_PER_PAGE, (page + 1) * BOOKS_PER_PAGE - 1);

      if (error) {
        console.error('[SimilarBooks] خطأ في جلب الكتب المشابهة:', error);
        return;
      }

      const newBooks = (data || []).map((b: any) => ({
        ...b,
        cover_image_url: b.s3_cover_image_url || b.cover_image_url,
      }));
      
      if (append) {
        setSimilarBooks(prev => [...prev, ...newBooks]);
      } else {
        setSimilarBooks(newBooks);
      }

      // فحص ما إذا كان هناك المزيد بناءً على حجم الصفحة المُرجَعة
      setHasMore(newBooks.length === BOOKS_PER_PAGE);
      setCurrentPage(page);

      // حفظ في كاش Supabase المشترك لتخفيف العبء
      writeCache(page, newBooks);

      console.log(`[SimilarBooks] تم جلب ${newBooks.length} كتاب مشابه - الصفحة ${page + 1}`);
    } catch (error) {
      console.error('[SimilarBooks] خطأ:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  return (
    <div className="bg-background py-12">
      <div className="container mx-auto px-4">
        <div className="text-center pb-6">
          <h2 className="text-2xl font-bold font-amiri text-foreground relative">
            كتب مشابهة قد تعجبك
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-24 h-0.5 bg-red-500 mt-2"></div>
          </h2>
        </div>
        <div className="px-6 pb-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mx-auto mb-4"></div>
              <p className="text-muted-foreground">جاري تحميل الكتب المشابهة...</p>
            </div>
          ) : similarBooks.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">لا توجد كتب أخرى في هذا التصنيف حالياً</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {similarBooks.map((book) => (
                <SimpleBookCard
                  key={book.id}
                  id={book.id}
                  title={book.title}
                  author={book.author}
                  cover_image={book.cover_image_url}
                  category={book.category}
                  created_at={book.created_at}
                  rating={book.rating}
                />
              ))}

              {/* مؤشر التحميل في وسط الكتب المشابهة - نفس شكل الواجهة الرئيسية */}
              {hasMore && (
                <div ref={loadingRef} className="col-span-2 md:col-span-3 lg:col-span-4 xl:col-span-5 flex justify-center items-center py-8">
                  <LoaderCircle className="h-8 w-8 text-red-500 animate-spin" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimilarBooks;
