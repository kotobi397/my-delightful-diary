
-- 1) Reset failed/stuck items so they get picked again
UPDATE public.text_extraction_queue
SET status = 'pending', attempts = 0, last_error = NULL, started_at = NULL, finished_at = NULL, updated_at = now()
WHERE status IN ('failed', 'processing');

-- 2) Reset stuck/failed extraction records
UPDATE public.book_extracted_text
SET extraction_status = 'pending', extraction_error = NULL, updated_at = now()
WHERE extraction_status IN ('processing', 'failed');

-- 3) Reset queue rows marked completed but whose book has no completed text
UPDATE public.text_extraction_queue q
SET status = 'pending', attempts = 0, last_error = NULL, started_at = NULL, finished_at = NULL, updated_at = now()
WHERE q.status = 'completed'
  AND NOT EXISTS (
    SELECT 1 FROM public.book_extracted_text bet
    WHERE bet.book_id = q.book_id
      AND bet.extraction_status = 'completed'
      AND COALESCE(bet.text_length, 0) > 0
  );

-- 4) Add brand-new queue entries for books that have no queue row at all
INSERT INTO public.text_extraction_queue (book_id, status, attempts)
SELECT ab.id, 'pending', 0
FROM public.approved_books ab
WHERE ab.book_file_url IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.text_extraction_queue q WHERE q.book_id = ab.id)
  AND NOT EXISTS (
    SELECT 1 FROM public.book_extracted_text bet
    WHERE bet.book_id = ab.id
      AND bet.extraction_status = 'completed'
      AND COALESCE(bet.text_length, 0) > 0
  )
ON CONFLICT (book_id) DO NOTHING;
