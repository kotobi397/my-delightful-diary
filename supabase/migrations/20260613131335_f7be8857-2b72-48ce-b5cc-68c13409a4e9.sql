CREATE OR REPLACE FUNCTION public.update_sitemap_on_author_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.dynamic_sitemap (url, page_type, entity_id, priority, changefreq)
    VALUES (
      'https://kotobi.netlify.app/author/' || COALESCE(NEW.slug, encode(NEW.name::bytea, 'base64')),
      'author', NEW.id, 0.7, 'weekly'
    ) ON CONFLICT (url) DO UPDATE SET lastmod = NOW(), updated_at = NOW();
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.slug IS DISTINCT FROM NEW.slug THEN
    UPDATE public.dynamic_sitemap
    SET url = 'https://kotobi.netlify.app/author/' || COALESCE(NEW.slug, encode(NEW.name::bytea, 'base64')),
        lastmod = NOW(), updated_at = NOW()
    WHERE entity_id = NEW.id AND page_type = 'author';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_sitemap_on_book_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    INSERT INTO public.dynamic_sitemap (url, page_type, entity_id, priority, changefreq)
    VALUES (
      'https://kotobi.netlify.app/book/' || COALESCE(NEW.slug, NEW.id::text),
      'book', NEW.id, 0.8, 'monthly'
    ) ON CONFLICT (url) DO UPDATE SET lastmod = NOW(), updated_at = NOW();
  END IF;

  IF NEW.status = 'rejected' AND (OLD.status IS DISTINCT FROM 'rejected') THEN
    DELETE FROM public.dynamic_sitemap WHERE entity_id = NEW.id AND page_type = 'book';
  END IF;

  RETURN NEW;
END;
$function$;