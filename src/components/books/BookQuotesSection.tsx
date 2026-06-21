import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChevronLeft, ChevronRight, Quote as QuoteIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { QuoteLikeButton } from '@/components/quotes/QuoteLikeButton';
import { UnifiedProfileLink } from '@/components/profile/UnifiedProfileLink';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

interface BookQuote {
  id: string;
  quote_text: string;
  created_at: string;
  user_id: string;
  page_number?: number | null;
  username?: string;
  avatar_url?: string | null;
}

interface BookQuotesSectionProps {
  bookId: string;
  bookTitle: string;
}

const BookQuotesSection: React.FC<BookQuotesSectionProps> = ({ bookId, bookTitle }) => {
  const [quotes, setQuotes] = useState<BookQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchQuotes = async () => {
      if (!bookId) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('quotes')
        .select('id, quote_text, created_at, user_id, page_number')
        .eq('book_id', bookId)
        .order('created_at', { ascending: false })
        .limit(30);

      if (cancelled) return;
      if (error || !data) {
        setQuotes([]);
        setLoading(false);
        return;
      }

      const userIds = [...new Set(data.map((q) => q.user_id).filter(Boolean))];
      let profileMap = new Map<string, { username?: string; avatar_url?: string | null }>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', userIds);
        profileMap = new Map((profiles || []).map((p) => [p.id, p]));
      }

      const enriched: BookQuote[] = data.map((q) => {
        const p = profileMap.get(q.user_id);
        return {
          ...q,
          username: p?.username || 'مستخدم',
          avatar_url: p?.avatar_url || null,
        };
      });
      if (!cancelled) {
        setQuotes(enriched);
        setLoading(false);
      }
    };
    fetchQuotes();
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  const scrollBy = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.85;
    el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  if (loading) return null;
  if (quotes.length === 0) return null;

  return (
    <Card className="bg-card/90 backdrop-blur-md border border-border shadow-lg rounded-2xl mt-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg md:text-xl font-bold font-amiri flex items-center gap-2">
            <QuoteIcon className="h-5 w-5 text-primary" />
            اقتباسات من الكتاب
            <span className="text-sm font-cairo text-muted-foreground font-normal">
              ({quotes.length})
            </span>
          </CardTitle>
          {quotes.length > 1 && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => scrollBy('right')}
                aria-label="السابق"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => scrollBy('left')}
                aria-label="التالي"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-3 md:px-6 pb-5">
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          dir="rtl"
        >
          {quotes.map((q) => (
            <article
              key={q.id}
              className="snap-start shrink-0 w-[88%] sm:w-[60%] md:w-[46%] lg:w-[38%] rounded-2xl border border-border/70 bg-gradient-to-br from-primary/5 via-transparent to-transparent p-4 md:p-5 flex flex-col gap-3 shadow-sm"
            >
              <div className="flex items-start gap-2">
                <QuoteIcon className="h-5 w-5 text-primary/60 shrink-0 mt-1" />
                <p className="font-amiri text-base md:text-lg leading-relaxed text-foreground line-clamp-6">
                  {q.quote_text}
                </p>
              </div>

              <div className="mt-auto flex items-center justify-between gap-2 pt-2 border-t border-border/50">
                <UnifiedProfileLink userId={q.user_id} username={q.username}>
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={q.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {q.username?.[0] || 'م'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-cairo font-medium text-foreground truncate">
                        {q.username}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-cairo">
                        {formatDistanceToNow(new Date(q.created_at), { addSuffix: true, locale: ar })}
                      </span>
                    </div>
                  </div>
                </UnifiedProfileLink>
                <QuoteLikeButton quoteId={q.id} />
              </div>
            </article>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default BookQuotesSection;
