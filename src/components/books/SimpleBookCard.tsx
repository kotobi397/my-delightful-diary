import React, { memo } from 'react';
import { AspectRatio } from "@/components/ui/aspect-ratio";
import BookImageLoader from './BookImageLoader';
import { createBookSlug } from '@/utils/bookSlug';
import { StarRating } from '@/components/ui/star-rating';
import { DisplayOnlyIcon } from '@/components/icons/DisplayOnlyIcon';

interface SimpleBookCardProps {
  id: string;
  title: string;
  author: string;
  cover_image?: string;
  category: string;
  optimized_cover_url?: string;
  created_at?: string;
  display_only?: boolean;
  publisher?: string;
  compact?: boolean;
  onNavigate?: (bookPath: string) => void;
  rating?: number;
  index?: number;
  slug?: string | null;
  bookStats?: {
    total_reviews: number;
    average_rating: number;
    rating_distribution: Record<string, number>;
  };
}

export const SimpleBookCard = memo(({
  title,
  author,
  cover_image,
  optimized_cover_url,
  created_at,
  display_only,
  publisher,
  rating,
  index = 99,
  slug,
  bookStats,
}: SimpleBookCardProps) => {
  const resolvedSlug = (slug && slug.trim()) || createBookSlug(title, author);
  const bookUrl = `/book/${resolvedSlug}`;


  const validCoverImage = optimized_cover_url?.trim() || cover_image?.trim() || '/placeholder.svg';
  const displayTitle = title || 'عنوان غير متوفر';
  const displayAuthor = author || 'مؤلف غير معروف';

  const showNewBadge = created_at
    ? Date.now() - new Date(created_at).getTime() < 15 * 86400000
    : false;

  const finalRating = bookStats?.average_rating || rating || 0;
  const totalReviews = bookStats?.total_reviews || 0;

  return (
    <a
      href={bookUrl}
      className="group block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-2xl"
    >
      <div className="relative h-full flex flex-col rounded-2xl bg-card text-card-foreground border border-border/60 p-2.5">
        {/* Cover */}
        <div className="relative w-full mx-auto max-w-[140px]">
          <AspectRatio ratio={3 / 4.5}>
            <div className="relative w-full h-full rounded-xl overflow-hidden bg-muted/60">
              <BookImageLoader
                src={validCoverImage}
                fallbackSrc="/placeholder.svg"
                alt={displayTitle}
                className="w-full h-full object-cover"
                priority={index < 4}
              />
            </div>
          </AspectRatio>

          {showNewBadge && (
            <span className="absolute top-1.5 left-1.5 bg-primary text-primary-foreground text-[10px] leading-none px-2 py-1 rounded-full font-semibold">
              جديد
            </span>
          )}

          {display_only && (
            <span className="absolute bottom-1.5 right-1.5 bg-background/90 rounded-full p-1 border border-border/50">
              <DisplayOnlyIcon className="h-5 w-5" />
            </span>
          )}
        </div>

        {/* Text */}
        <div className="flex w-full flex-1 flex-col items-center text-center mt-2.5 px-1">
          <p
            className="font-tajawal text-card-foreground line-clamp-2 leading-snug min-h-[38px]"
            style={{ fontWeight: 600, fontSize: '14px' }}
            title={displayTitle}
          >
            {displayTitle}
          </p>

          <p
            className="font-tajawal text-primary/90 line-clamp-1 mt-1"
            style={{ fontWeight: 500, fontSize: '12.5px' }}
            title={displayAuthor}
          >
            {displayAuthor}
          </p>

          {publisher && (
            <p
              className="font-tajawal text-muted-foreground text-[11px] line-clamp-1 mt-0.5"
              title={publisher}
            >
              {publisher}
            </p>
          )}
        </div>

        {/* Rating */}
        <div className="flex justify-center mt-2 pt-2 border-t border-border/40 w-full">
          <StarRating
            rating={finalRating}
            totalReviews={totalReviews}
            size="sm"
            className="max-w-full scale-[0.9] sm:scale-95 origin-center"
          />
        </div>
      </div>
    </a>
  );
});

SimpleBookCard.displayName = 'SimpleBookCard';
