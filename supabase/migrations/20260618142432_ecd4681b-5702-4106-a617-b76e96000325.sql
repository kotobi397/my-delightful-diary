
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users a
    WHERE a.email = (auth.jwt() ->> 'email')
      AND a.is_active = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated, anon;

DROP POLICY IF EXISTS "site_settings admin write" ON public.site_settings;
CREATE POLICY "site_settings admin write"
ON public.site_settings FOR ALL
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());
