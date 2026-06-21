import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * يزيد عدد مشاهدات الكتاب فورًا في كل مرة يفتح فيها المستخدم الكتاب.
 * يستخدم ref لمنع الازدواج داخل نفس عملية التركيب (mount) فقط،
 * بينما عند الفتح من جديد (mount جديد) يُحتسب المشاهدة من جديد.
 */
export const useBookViews = (bookId: string, enabled = true) => {
  const incrementedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (!bookId) return;
    if (incrementedRef.current === bookId) return;

    // ننتظر 3 ثوانٍ بعد ظهور الكتاب قبل احتساب المشاهدة
    const timer = setTimeout(async () => {
      incrementedRef.current = bookId;
      try {
        const { error } = await supabase.rpc('increment_book_views', {
          p_book_id: bookId,
        });
        if (error) {
          console.error('[useBookViews] خطأ في زيادة المشاهدات:', error);
        } else {
          console.log('[useBookViews] تم تسجيل مشاهدة للكتاب:', bookId);
        }
      } catch (err) {
        console.error('[useBookViews] خطأ غير متوقع:', err);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [bookId, enabled]);

  return { hasIncrementedView: enabled && incrementedRef.current === bookId };
};