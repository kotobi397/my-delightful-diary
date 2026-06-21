
-- 1) trigram extension + index for slug ILIKE fallback (book_submissions)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_book_submissions_slug_trgm
  ON public.book_submissions USING gin (slug gin_trgm_ops)
  WHERE status = 'approved';

-- 2) trigram for authors name ILIKE
CREATE INDEX IF NOT EXISTS idx_authors_name_trgm
  ON public.authors USING gin (name gin_trgm_ops);

-- 3) partial index to make the S3 migration scan instant
CREATE INDEX IF NOT EXISTS idx_book_submissions_s3_pending
  ON public.book_submissions (file_size NULLS FIRST)
  WHERE status = 'approved'
    AND s3_migration_error IS NULL
    AND (s3_cover_image_url IS NULL OR s3_book_file_url IS NULL);

-- 4) enable realtime for quotes / reviews / likes / replies so UI updates instantly
ALTER TABLE public.quotes REPLICA IDENTITY FULL;
ALTER TABLE public.quote_likes REPLICA IDENTITY FULL;
ALTER TABLE public.quote_replies REPLICA IDENTITY FULL;
ALTER TABLE public.book_reviews REPLICA IDENTITY FULL;
ALTER TABLE public.review_likes REPLICA IDENTITY FULL;
ALTER TABLE public.book_likes REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.quotes; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.quote_likes; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.quote_replies; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.book_reviews; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.review_likes; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.book_likes; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
