
CREATE TABLE public.chapter_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.story_chapters(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chapter_id, user_id)
);
GRANT SELECT ON public.chapter_likes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chapter_likes TO authenticated;
GRANT ALL ON public.chapter_likes TO service_role;
ALTER TABLE public.chapter_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chapter_likes_select_all" ON public.chapter_likes FOR SELECT USING (true);
CREATE POLICY "chapter_likes_insert_own" ON public.chapter_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "chapter_likes_delete_own" ON public.chapter_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.chapter_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.story_chapters(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.chapter_comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chapter_comments TO authenticated;
GRANT ALL ON public.chapter_comments TO service_role;
ALTER TABLE public.chapter_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chapter_comments_select_all" ON public.chapter_comments FOR SELECT USING (true);
CREATE POLICY "chapter_comments_insert_own" ON public.chapter_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "chapter_comments_update_own" ON public.chapter_comments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "chapter_comments_delete_own" ON public.chapter_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_chapter_likes_chapter ON public.chapter_likes(chapter_id);
CREATE INDEX idx_chapter_comments_chapter ON public.chapter_comments(chapter_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_chapter_comments_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER trg_chapter_comments_updated_at BEFORE UPDATE ON public.chapter_comments
FOR EACH ROW EXECUTE FUNCTION public.touch_chapter_comments_updated_at();
