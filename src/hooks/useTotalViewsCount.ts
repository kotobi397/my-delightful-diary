import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const CACHE_KEY = 'kotobi_total_views_v1';
const TTL_MS = 10 * 60 * 1000; // 10 دقائق

interface CachedViews {
  count: number;
  fetchedAt: number;
}

const readCache = (): CachedViews | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedViews;
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
      JSON.stringify({ count, fetchedAt: Date.now() } satisfies CachedViews)
    );
  } catch {
    // ignore
  }
};

export const useTotalViewsCount = () => {
  const cached = typeof window !== 'undefined' ? readCache() : null;
  const isFresh = cached && Date.now() - cached.fetchedAt < TTL_MS;
  const [totalViews, setTotalViews] = useState<number>(cached?.count ?? 0);
  const [loading, setLoading] = useState<boolean>(!cached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchTotalViews = async (showLoading = false) => {
      try {
        if (showLoading) setLoading(true);

        // نستخدم RPC إن وُجدت، وإلا نلجأ لحساب على العميل عبر pagination صغيرة.
        // للحفاظ على البساطة والسرعة: استدعاء دالة postgres عبر select aggregate غير ممكن مباشرة،
        // لذلك نستخدم rpc مخصصة إن متوفرة، أو نقرأ عمود views بأقل بيانات ممكنة.
        const { data, error } = await supabase.rpc('get_total_book_views' as any);

        if (cancelled) return;

        if (!error && typeof data === 'number') {
          setTotalViews(data);
          writeCache(data);
          setError(null);
          return;
        }

        // fallback: جلب views فقط لكل الكتب المعتمدة وجمعها
        const { data: rows, error: rowsErr } = await supabase
          .from('book_submissions')
          .select('views')
          .eq('status', 'approved');

        if (cancelled) return;

        if (rowsErr) {
          if (!cached) setError('فشل في جلب عدد المشاهدات');
          return;
        }

        const sum = (rows || []).reduce((acc, r: any) => acc + (Number(r.views) || 0), 0);
        setTotalViews(sum);
        writeCache(sum);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        if (!cached) setError('حدث خطأ غير متوقع');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    // اجلب فقط إن لم يكن هناك كاش طازج
    if (!isFresh) {
      fetchTotalViews(!cached);
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { totalViews, loading, error };
};
