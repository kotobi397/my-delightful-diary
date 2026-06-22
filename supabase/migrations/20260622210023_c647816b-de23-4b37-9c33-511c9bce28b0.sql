
-- إعدادات التوليد التلقائي للقصص
CREATE TABLE IF NOT EXISTS public.auto_story_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  enabled BOOLEAN NOT NULL DEFAULT false,
  topics JSONB NOT NULL DEFAULT '["مغامرة في الصحراء","قصة حب في الأندلس","رحلة بحث عن الحقيقة","سر القصر القديم","حكاية صياد البحر","المدينة المنسية","ذكريات الطفولة","رحلة عبر الزمن","لغز المكتبة القديمة","حلم الفتى الحالم"]'::jsonb,
  chapters_per_story INTEGER NOT NULL DEFAULT 5,
  stories_per_run INTEGER NOT NULL DEFAULT 1,
  min_chapter_words INTEGER NOT NULL DEFAULT 350,
  model TEXT NOT NULL DEFAULT 'mistral-small-latest',
  language TEXT NOT NULL DEFAULT 'ar',
  total_generated INTEGER NOT NULL DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  last_status TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT auto_story_config_singleton CHECK (id = 1)
);

INSERT INTO public.auto_story_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_story_config TO authenticated;
GRANT ALL ON public.auto_story_config TO service_role;

ALTER TABLE public.auto_story_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage auto_story_config"
ON public.auto_story_config FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- Cron job كل 30 دقيقة لتوليد القصص
SELECT cron.schedule(
  'auto-generate-stories-every-30-min',
  '13,43 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://kydmyxsgyxeubhmqzrgo.supabase.co/functions/v1/auto-generate-stories-worker',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5ZG15eHNneXhldWJobXF6cmdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY0ODQ3NjQsImV4cCI6MjA2MjA2MDc2NH0.b-ckDfOmmf2x__FG5Snm9px8j4pqPke5Ra1RgoGEqP0","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5ZG15eHNneXhldWJobXF6cmdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY0ODQ3NjQsImV4cCI6MjA2MjA2MDc2NH0.b-ckDfOmmf2x__FG5Snm9px8j4pqPke5Ra1RgoGEqP0"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
