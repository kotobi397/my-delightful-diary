
-- user_stories table
CREATE TABLE public.user_stories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  category TEXT,
  language TEXT DEFAULT 'ar',
  status TEXT NOT NULL DEFAULT 'draft',
  is_public BOOLEAN NOT NULL DEFAULT false,
  views_count INTEGER NOT NULL DEFAULT 0,
  likes_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_stories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_stories TO authenticated;
GRANT ALL ON public.user_stories TO service_role;

ALTER TABLE public.user_stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view public stories"
  ON public.user_stories FOR SELECT
  USING (is_public = true OR auth.uid() = author_id);

CREATE POLICY "Authors can insert their stories"
  ON public.user_stories FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update their stories"
  ON public.user_stories FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can delete their stories"
  ON public.user_stories FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id);

CREATE INDEX idx_user_stories_author ON public.user_stories(author_id);
CREATE INDEX idx_user_stories_public ON public.user_stories(is_public, updated_at DESC);

-- story_chapters table
CREATE TABLE public.story_chapters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id UUID NOT NULL REFERENCES public.user_stories(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL DEFAULT 'فصل جديد',
  content TEXT NOT NULL DEFAULT '',
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  word_count INTEGER NOT NULL DEFAULT 0,
  views_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.story_chapters TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.story_chapters TO authenticated;
GRANT ALL ON public.story_chapters TO service_role;

ALTER TABLE public.story_chapters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published chapters of public stories"
  ON public.story_chapters FOR SELECT
  USING (
    (is_published = true AND EXISTS (
      SELECT 1 FROM public.user_stories s
      WHERE s.id = story_chapters.story_id AND s.is_public = true
    ))
    OR EXISTS (
      SELECT 1 FROM public.user_stories s
      WHERE s.id = story_chapters.story_id AND s.author_id = auth.uid()
    )
  );

CREATE POLICY "Authors can insert chapters in their stories"
  ON public.story_chapters FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_stories s
    WHERE s.id = story_chapters.story_id AND s.author_id = auth.uid()
  ));

CREATE POLICY "Authors can update chapters in their stories"
  ON public.story_chapters FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_stories s
    WHERE s.id = story_chapters.story_id AND s.author_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_stories s
    WHERE s.id = story_chapters.story_id AND s.author_id = auth.uid()
  ));

CREATE POLICY "Authors can delete chapters in their stories"
  ON public.story_chapters FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_stories s
    WHERE s.id = story_chapters.story_id AND s.author_id = auth.uid()
  ));

CREATE INDEX idx_story_chapters_story ON public.story_chapters(story_id, chapter_number);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_user_stories_updated_at
BEFORE UPDATE ON public.user_stories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_story_chapters_updated_at
BEFORE UPDATE ON public.story_chapters
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
