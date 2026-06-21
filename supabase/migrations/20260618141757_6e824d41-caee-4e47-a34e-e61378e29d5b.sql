
CREATE TABLE IF NOT EXISTS public.site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT ALL ON public.site_settings TO service_role;

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_settings readable by all" ON public.site_settings;
CREATE POLICY "site_settings readable by all"
ON public.site_settings FOR SELECT
USING (true);

DROP POLICY IF EXISTS "site_settings admin write" ON public.site_settings;
CREATE POLICY "site_settings admin write"
ON public.site_settings FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.email = (auth.jwt() ->> 'email') AND a.is_active = true))
WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.email = (auth.jwt() ->> 'email') AND a.is_active = true));

INSERT INTO public.site_settings (key, value)
VALUES ('views_boost', '{"enabled": false, "min": 3, "max": 10}'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.increment_book_views(p_book_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_setting JSONB;
  v_enabled BOOLEAN := false;
  v_min INT := 3;
  v_max INT := 10;
  v_inc INT := 1;
BEGIN
  SELECT value INTO v_setting FROM public.site_settings WHERE key = 'views_boost';
  IF v_setting IS NOT NULL THEN
    v_enabled := COALESCE((v_setting->>'enabled')::boolean, false);
    v_min := COALESCE((v_setting->>'min')::int, 3);
    v_max := COALESCE((v_setting->>'max')::int, 10);
  END IF;

  IF v_enabled THEN
    IF v_max < v_min THEN v_max := v_min; END IF;
    v_inc := v_min + floor(random() * (v_max - v_min + 1))::int;
  END IF;

  UPDATE public.book_submissions
  SET views = COALESCE(views, 0) + v_inc
  WHERE id = p_book_id AND status = 'approved';
END;
$function$;
