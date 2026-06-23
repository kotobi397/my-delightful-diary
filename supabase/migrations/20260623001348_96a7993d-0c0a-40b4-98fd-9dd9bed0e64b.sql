GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_story_config TO authenticated;
GRANT ALL ON public.auto_story_config TO service_role;

CREATE OR REPLACE FUNCTION public.is_current_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = auth.uid()
      AND is_active = true
  )
  OR public.is_admin_user(auth.email());
$$;

DROP POLICY IF EXISTS "Admins manage auto_story_config" ON public.auto_story_config;

CREATE POLICY "Admins manage auto_story_config"
ON public.auto_story_config
FOR ALL
TO authenticated
USING (public.is_current_admin_user())
WITH CHECK (public.is_current_admin_user());