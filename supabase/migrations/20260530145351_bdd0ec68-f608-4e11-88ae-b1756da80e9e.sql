
CREATE OR REPLACE FUNCTION public.normalize_arabic(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(
    regexp_replace(
      translate(
        regexp_replace(coalesce(t,''), '[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]', '', 'g'),
        'إأآٱؤئىةـ',
        'ااااوييه'
      ),
      '\s+', ' ', 'g'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.fuzzy_search_books(q text, lim int DEFAULT 24)
RETURNS TABLE (
  id uuid,
  title text,
  author text,
  category text,
  description text,
  slug text,
  rating numeric,
  views integer,
  cover_image_url text,
  s3_cover_image_url text,
  publisher text,
  created_at timestamptz,
  score real
)
LANGUAGE sql
STABLE
AS $$
  WITH nq AS (SELECT public.normalize_arabic(q) AS nq)
  SELECT
    b.id, b.title, b.author, b.category, b.description, b.slug,
    b.rating, b.views, b.cover_image_url, b.s3_cover_image_url,
    b.publisher, b.created_at,
    GREATEST(
      similarity(public.normalize_arabic(coalesce(b.title,'')),  (SELECT nq FROM nq)),
      similarity(public.normalize_arabic(coalesce(b.author,'')), (SELECT nq FROM nq)) * 1.1,
      similarity(public.normalize_arabic(coalesce(b.title,'') || ' ' || coalesce(b.author,'')), (SELECT nq FROM nq))
    )::real AS score
  FROM public.book_submissions b
  WHERE b.status = 'approved'
    AND (
      public.normalize_arabic(coalesce(b.title,''))  % (SELECT nq FROM nq)
      OR public.normalize_arabic(coalesce(b.author,'')) % (SELECT nq FROM nq)
      OR public.normalize_arabic(coalesce(b.title,'') || ' ' || coalesce(b.author,'')) % (SELECT nq FROM nq)
    )
  ORDER BY score DESC, coalesce(b.views,0) DESC
  LIMIT lim;
$$;

GRANT EXECUTE ON FUNCTION public.normalize_arabic(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fuzzy_search_books(text, int) TO anon, authenticated, service_role;
