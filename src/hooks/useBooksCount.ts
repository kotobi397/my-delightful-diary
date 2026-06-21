import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const CACHE_KEY = 'kotobi_books_count_v1';

interface CachedCount {
  count: number;
  fetchedAt: number;
}

const readCache = (): CachedCount | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedCount;
    if (typeof parsed?.count !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeCache = (count: number) => {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ count, fetchedAt: Date.now() } satisfies CachedCount)
    );
  } catch {
    // ignore quota errors
  }
};

export const useBooksCount = () => {
  const cached = typeof window !== 'undefined' ? readCache() : null;
  const [totalBooks, setTotalBooks] = useState<number>(cached?.count ?? 0);
  // إذا كانت لدينا قيمة مخزّنة، لا نُظهر حالة التحميل (نعرضها فوراً)
  const [loading, setLoading] = useState<boolean>(!cached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchBooksCount = async (showLoading = false) => {
      try {
        if (showLoading) setLoading(true);

        const { count, error } = await supabase
          .from('book_submissions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'approved');

        if (cancelled) return;

        if (error) {
          console.error('خطأ في جلب عدد الكتب:', error);
          // لا نمسح الكاش الموجود — نُبقي القيمة المعروضة
          if (!cached) setError('فشل في جلب عدد الكتب');
          return;
        }

        const value = count || 0;
        setTotalBooks(value);
        writeCache(value);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        console.error('خطأ غير متوقع:', err);
        if (!cached) setError('حدث خطأ غير متوقع');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    // إذا لم يكن هناك كاش، اجلب فوراً مع إظهار التحميل.
    // إذا كان هناك كاش، اعرضه فوراً ولا تُعيد الجلب — سيتم التحديث فقط عند
    // إضافة كتاب جديد عبر اشتراك Realtime أدناه.
    if (!cached) {
      fetchBooksCount(true);
    }

    // الاستماع لتغيّرات جدول الكتب: عند إضافة كتاب جديد أو تغيّر حالته
    // إلى "approved" نُعيد جلب العدد مرة واحدة.
    const channel = supabase
      .channel('books-count-watch')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'book_submissions' },
        (payload) => {
          const status = (payload.new as { status?: string } | null)?.status;
          if (status === 'approved') fetchBooksCount(false);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'book_submissions' },
        (payload) => {
          const oldStatus = (payload.old as { status?: string } | null)?.status;
          const newStatus = (payload.new as { status?: string } | null)?.status;
          // عند اعتماد كتاب أو سحب اعتماده، حدّث العدّاد
          if (oldStatus !== newStatus && (oldStatus === 'approved' || newStatus === 'approved')) {
            fetchBooksCount(false);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'book_submissions' },
        (payload) => {
          const status = (payload.old as { status?: string } | null)?.status;
          if (status === 'approved') fetchBooksCount(false);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { totalBooks, loading, error };
};
