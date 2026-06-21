import { BookOpen, Quote as QuoteIcon, Star, Library } from 'lucide-react';

import { TabsList, TabsTrigger } from '@/components/ui/tabs';

type Props = {
  booksCount: number;
  quotesCount: number;
  reviewsCount: number;
  readingRoomCount?: number;
};

export function ProfileSectionTabs({ booksCount, quotesCount, reviewsCount, readingRoomCount }: Props) {
  return (
    <div className="flex justify-center mb-8" dir="rtl">
      <div className="relative rounded-full border border-border/70 bg-card/95 p-1 shadow-lg">
        <TabsList className="relative h-auto rounded-full bg-transparent p-0 flex-wrap">
          {/* الكتب */}
          <TabsTrigger
            value="books"
            className="group h-auto rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:shadow-primary/20 transition-colors hover:text-foreground"
          >
            <span className="inline-flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">الكتب</span>
              <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                {booksCount}
              </span>
            </span>
          </TabsTrigger>

          {/* غرفة القراءة */}
          <TabsTrigger
            value="reading-room"
            className="group h-auto rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:shadow-primary/20 transition-colors hover:text-foreground"
          >
            <span className="inline-flex items-center gap-2">
              <Library className="h-4 w-4" />
              <span className="hidden sm:inline">المكتبة</span>
              {readingRoomCount !== undefined && (
                <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                  {readingRoomCount}
                </span>
              )}
            </span>
          </TabsTrigger>

          {/* الاقتباسات */}
          <TabsTrigger
            value="quotes"
            className="group h-auto rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:shadow-primary/20 transition-colors hover:text-foreground"
          >
            <span className="inline-flex items-center gap-2">
              <QuoteIcon className="h-4 w-4" />
              <span className="hidden sm:inline">الاقتباسات</span>
              <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                {quotesCount}
              </span>
            </span>
          </TabsTrigger>

          {/* المراجعات */}
          <TabsTrigger
            value="reviews"
            className="group h-auto rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:shadow-primary/20 transition-colors hover:text-foreground"
          >
            <span className="inline-flex items-center gap-2">
              <Star className="h-4 w-4" />
              <span className="hidden sm:inline">المراجعات</span>
              <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                {reviewsCount}
              </span>
            </span>
          </TabsTrigger>
        </TabsList>
      </div>
    </div>
  );
}
