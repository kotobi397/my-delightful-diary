CREATE OR REPLACE FUNCTION public.try_app_advisory_lock(lock_name text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT pg_try_advisory_lock(hashtextextended(lock_name, 0));
$$;

CREATE OR REPLACE FUNCTION public.release_app_advisory_lock(lock_name text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT pg_advisory_unlock(hashtextextended(lock_name, 0));
$$;

GRANT EXECUTE ON FUNCTION public.try_app_advisory_lock(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_app_advisory_lock(text) TO anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_book_submissions_s3_retry_queue
ON public.book_submissions (file_size ASC NULLS FIRST, id)
WHERE status = 'approved'
  AND s3_migration_error IS NULL
  AND (s3_cover_image_url IS NULL OR s3_book_file_url IS NULL);

CREATE INDEX IF NOT EXISTS idx_book_submissions_approved_category_created
ON public.book_submissions (category, created_at DESC, id)
WHERE status = 'approved';

CREATE INDEX IF NOT EXISTS idx_book_submissions_approved_views
ON public.book_submissions (views DESC, id)
WHERE status = 'approved';

CREATE INDEX IF NOT EXISTS idx_authors_created_at_desc
ON public.authors (created_at DESC, id);

CREATE INDEX IF NOT EXISTS idx_page_state_cache_expires_at
ON public.page_state_cache (expires_at);

DELETE FROM public.page_state_cache WHERE expires_at < now();