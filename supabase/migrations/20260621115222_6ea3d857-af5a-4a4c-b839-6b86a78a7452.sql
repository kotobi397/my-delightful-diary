CREATE OR REPLACE FUNCTION public.trg_like_award_xp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  today_count INTEGER;
  already_awarded BOOLEAN;
BEGIN
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;

  -- منح XP مرة واحدة فقط لكل كتاب لكل مستخدم (حتى لو أزال الإعجاب وأعاده)
  SELECT EXISTS (
    SELECT 1 FROM public.xp_ledger
    WHERE user_id = NEW.user_id
      AND reason = 'book_like'
      AND reference_id = NEW.book_id::text
  ) INTO already_awarded;

  IF already_awarded THEN
    RETURN NEW;
  END IF;

  -- حد يومي: 10 كتب مختلفة كحد أقصى
  SELECT COUNT(*) INTO today_count FROM public.xp_ledger
    WHERE user_id = NEW.user_id AND reason = 'book_like'
      AND created_at::date = (now() AT TIME ZONE 'UTC')::date;

  IF today_count < 10 THEN
    PERFORM public.award_xp(NEW.user_id, 5, 'book_like', NEW.book_id::text);
  END IF;

  RETURN NEW;
END $function$;