
-- Partial index for the S3 migration scan (top offender, 13.7M ms total)
-- Only indexes rows that still need migration (~6-8 rows out of 26k)
CREATE INDEX IF NOT EXISTS idx_book_submissions_s3_pending
  ON public.book_submissions (file_size ASC NULLS FIRST)
  WHERE status = 'approved'
    AND s3_migration_error IS NULL
    AND (s3_cover_image_url IS NULL OR s3_book_file_url IS NULL);

-- Functional index to speed up `slug ilike '...'` lookups (PostgREST .ilike on slug)
CREATE INDEX IF NOT EXISTS idx_book_submissions_lower_slug_approved
  ON public.book_submissions (lower(slug))
  WHERE status = 'approved';

-- Trigram index as fallback for true ilike with wildcards on slug
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_book_submissions_slug_trgm
  ON public.book_submissions USING gin (slug gin_trgm_ops)
  WHERE status = 'approved';

ANALYZE public.book_submissions;
