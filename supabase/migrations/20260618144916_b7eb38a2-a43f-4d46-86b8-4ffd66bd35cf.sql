CREATE OR REPLACE FUNCTION public.get_total_book_views()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(views), 0)::bigint
  FROM public.book_submissions
  WHERE status = 'approved';
$$;

GRANT EXECUTE ON FUNCTION public.get_total_book_views() TO anon, authenticated, service_role;