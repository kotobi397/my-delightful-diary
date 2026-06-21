import React, { useState, useEffect, useMemo } from 'react';
import { useBooksCount } from '@/hooks/useBooksCount';
import { useTotalViewsCount } from '@/hooks/useTotalViewsCount';
import { toLatinDigits } from '@/utils/numberUtils';

interface BookStatsCounterProps {
  className?: string;
}

export const BookStatsCounter: React.FC<BookStatsCounterProps> = React.memo(({ className }) => {
  const { totalBooks, loading, error } = useBooksCount();
  const { totalViews, loading: viewsLoading, error: viewsError } = useTotalViewsCount();
  const [displayCount, setDisplayCount] = useState(0);
  const [displayViews, setDisplayViews] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // تأثير العد التصاعدي المحسّن باستخدام requestAnimationFrame
  useEffect(() => {
    if (!loading && totalBooks > 0) {
      setIsAnimating(true);
      const duration = 1000; // 1 ثانية
      const startTime = Date.now();
      let animationId: number;
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // استخدام easing function للحركة السلسة
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const currentValue = Math.floor(totalBooks * easeOutQuart);
        
        setDisplayCount(currentValue);
        
        if (progress < 1) {
          animationId = requestAnimationFrame(animate);
        } else {
          setDisplayCount(totalBooks);
          setIsAnimating(false);
        }
      };
      
      animationId = requestAnimationFrame(animate);
      
      // تنظيف العداد عند إلغاء المكون
      return () => {
        if (animationId) {
          cancelAnimationFrame(animationId);
        }
      };
    }
  }, [totalBooks, loading]);

  // عدّ تصاعدي لإجمالي المشاهدات
  useEffect(() => {
    if (!viewsLoading && totalViews > 0) {
      const duration = 1000;
      const startTime = Date.now();
      let animationId: number;
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        setDisplayViews(Math.floor(totalViews * easeOutQuart));
        if (progress < 1) {
          animationId = requestAnimationFrame(animate);
        } else {
          setDisplayViews(totalViews);
        }
      };
      animationId = requestAnimationFrame(animate);
      return () => {
        if (animationId) cancelAnimationFrame(animationId);
      };
    }
  }, [totalViews, viewsLoading]);

  // تحسين الأداء بحفظ القيم المحسوبة
  const formattedCount = useMemo(() => 
    toLatinDigits(displayCount.toString()), 
    [displayCount]
  );

  const formattedViews = useMemo(
    () => toLatinDigits(displayViews.toString()),
    [displayViews]
  );

  const subtitleText = useMemo(() => {
    if (loading) return 'جاري العد...';
    if (error) return 'تعذر جلب العدد';
    return 'كتاب متاح';
  }, [loading, error]);

  const mainText = useMemo(() => {
    if (loading) return '…';
    if (error) return '—';
    return formattedCount;
  }, [loading, error, formattedCount]);

  const viewsMainText = useMemo(() => {
    if (viewsLoading) return '…';
    if (viewsError) return '—';
    return formattedViews;
  }, [viewsLoading, viewsError, formattedViews]);

  const viewsSubtitle = useMemo(() => {
    if (viewsLoading) return 'جاري العد...';
    if (viewsError) return 'تعذر جلب العدد';
    return 'إجمالي المشاهدات';
  }, [viewsLoading, viewsError]);

  return (
    <div className={`flex items-center justify-center min-h-[92px] ${className ?? ''}`.trim()}>
      <div className="flex items-stretch justify-center gap-6 md:gap-10">
        {/* عدد الكتب */}
        <div className="text-center">
          <div
            className={`text-3xl md:text-4xl font-bold tabular-nums transition-all duration-500 ease-out ${
              isAnimating ? 'text-yellow-400' : 'text-white'
            }`}
            style={{
              textShadow: '0 2px 4px rgba(0, 0, 0, 0.4)',
              letterSpacing: '0.02em',
              transform: isAnimating ? 'scale(1.05)' : 'scale(1)',
            }}
            aria-live="polite"
          >
            {mainText}
          </div>
          <div
            className="text-gray-300 text-base md:text-lg"
            style={{ textShadow: '0 1px 3px rgba(0, 0, 0, 0.3)', minHeight: '1.75rem' }}
          >
            {subtitleText}
          </div>
        </div>

        {/* فاصل */}
        <div className="w-px bg-white/20 self-stretch" aria-hidden="true" />

        {/* إجمالي المشاهدات */}
        <div className="text-center">
          <div
            className="text-3xl md:text-4xl font-bold tabular-nums text-amber-300"
            style={{
              textShadow: '0 2px 4px rgba(0, 0, 0, 0.4)',
              letterSpacing: '0.02em',
            }}
            aria-live="polite"
          >
            {viewsMainText}
          </div>
          <div
            className="text-gray-300 text-base md:text-lg"
            style={{ textShadow: '0 1px 3px rgba(0, 0, 0, 0.3)', minHeight: '1.75rem' }}
          >
            {viewsSubtitle}
          </div>
        </div>
      </div>
    </div>
  );
});