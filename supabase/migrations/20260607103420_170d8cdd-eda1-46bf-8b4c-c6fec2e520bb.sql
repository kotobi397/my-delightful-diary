
-- 1) إضافة عمود author_slug على جدول profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS author_slug text;

-- 2) دالة لإعادة حساب author_slug لمستخدم معين
CREATE OR REPLACE FUNCTION public.recompute_profile_author_slug(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(NULLIF(trim(slug), ''), NULLIF(trim(name), ''))
  INTO v_slug
  FROM public.authors
  WHERE user_id = p_user_id
  ORDER BY books_count DESC NULLS LAST, created_at ASC
  LIMIT 1;

  UPDATE public.profiles
  SET author_slug = v_slug
  WHERE id = p_user_id;
END;
$$;

-- 3) Trigger function على جدول authors لمزامنة العمود
CREATE OR REPLACE FUNCTION public.sync_profile_author_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_profile_author_slug(OLD.user_id);
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.user_id IS DISTINCT FROM NEW.user_id THEN
    PERFORM public.recompute_profile_author_slug(OLD.user_id);
  END IF;

  PERFORM public.recompute_profile_author_slug(NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_author_slug ON public.authors;
CREATE TRIGGER trg_sync_profile_author_slug
AFTER INSERT OR UPDATE OF user_id, slug, name, books_count OR DELETE
ON public.authors
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_author_slug();

-- 4) Backfill: ملء العمود لجميع المستخدمين المرتبطين بسجلات مؤلفين
UPDATE public.profiles p
SET author_slug = sub.identifier
FROM (
  SELECT DISTINCT ON (a.user_id)
    a.user_id,
    COALESCE(NULLIF(trim(a.slug), ''), NULLIF(trim(a.name), '')) AS identifier
  FROM public.authors a
  WHERE a.user_id IS NOT NULL
  ORDER BY a.user_id, a.books_count DESC NULLS LAST, a.created_at ASC
) sub
WHERE p.id = sub.user_id
  AND p.author_slug IS DISTINCT FROM sub.identifier;
