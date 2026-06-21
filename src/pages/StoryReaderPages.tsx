import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { SEOHead } from '@/components/seo/SEOHead';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, BookOpen, ArrowRight, ArrowLeft, Eye } from 'lucide-react';
import ChapterInteractions from '@/components/reading/ChapterInteractions';
import { ChapterContent } from '@/lib/chapterContent';

interface Story {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  category: string | null;
  status: string;
  views_count: number;
  author_id: string;
}

interface ChapterMini { id: string; chapter_number: number; title: string; word_count: number; }
interface ChapterFull extends ChapterMini { content: string; }

export const StoryPublicPage: React.FC = () => {
  const { storyId } = useParams<{ storyId: string }>();
  const [story, setStory] = useState<Story | null>(null);
  const [chapters, setChapters] = useState<ChapterMini[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storyId) return;
    (async () => {
      const [{ data: s }, { data: c }] = await Promise.all([
        supabase.from('user_stories').select('*').eq('id', storyId).maybeSingle(),
        supabase.from('story_chapters').select('id,chapter_number,title,word_count').eq('story_id', storyId).eq('is_published', true).order('chapter_number'),
      ]);
      setStory(s as Story | null);
      setChapters((c || []) as ChapterMini[]);
      setLoading(false);
      if (s) {
        supabase.from('user_stories').update({ views_count: (s as Story).views_count + 1 }).eq('id', s.id).then(() => {});
      }
    })();
  }, [storyId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!story) return <div className="min-h-screen flex flex-col"><Navbar /><div className="flex-grow flex items-center justify-center text-sm">القصة غير موجودة</div><Footer /></div>;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead title={`${story.title} - منصة كتبي`} description={story.description || ''} canonical={`https://kotobi.xyz/story/${story.id}`} />
      <Navbar />
      <main className="flex-grow container mx-auto px-3 py-4 max-w-3xl">
        <Card className="mb-4">
          <CardContent className="p-4 flex gap-3">
            <div className="w-24 h-32 rounded bg-muted overflow-hidden flex-shrink-0">
              {story.cover_url ? <img src={story.cover_url} alt={story.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-muted-foreground"><BookOpen className="h-8 w-8" /></div>}
            </div>
            <div className="flex-1">
              <h1 className="text-lg font-black mb-1">{story.title}</h1>
              {story.category && <span className="text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{story.category}</span>}
              <p className="text-xs text-muted-foreground mt-2">{story.description}</p>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-2">
                <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {story.views_count}</span>
                <span>{chapters.length} فصل</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <h2 className="text-sm font-black mb-2">الفصول</h2>
        {chapters.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">لا يوجد فصول منشورة بعد</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {chapters.map(ch => (
              <Link key={ch.id} to={`/story/${story.id}/chapter/${ch.chapter_number}`}>
                <Card className="hover:border-primary transition-colors">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="text-xs font-black text-muted-foreground w-8">#{ch.chapter_number}</div>
                    <div className="flex-1">
                      <div className="font-black text-sm">{ch.title}</div>
                      <div className="text-[11px] text-muted-foreground">{ch.word_count} كلمة</div>
                    </div>
                    <ArrowLeft className="h-4 w-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export const ChapterReaderPage: React.FC = () => {
  const { storyId, chapterNumber } = useParams<{ storyId: string; chapterNumber: string }>();
  const navigate = useNavigate();
  const [chapter, setChapter] = useState<ChapterFull | null>(null);
  const [story, setStory] = useState<{ title: string } | null>(null);
  const [neighbors, setNeighbors] = useState<{ prev?: number; next?: number }>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storyId || !chapterNumber) return;
    setLoading(true);
    (async () => {
      const num = parseInt(chapterNumber, 10);
      const [{ data: s }, { data: c }, { data: nums }] = await Promise.all([
        supabase.from('user_stories').select('title,is_public').eq('id', storyId).maybeSingle(),
        supabase.from('story_chapters').select('id,chapter_number,title,word_count,content,views_count').eq('story_id', storyId).eq('chapter_number', num).eq('is_published', true).maybeSingle(),
        supabase.from('story_chapters').select('chapter_number').eq('story_id', storyId).eq('is_published', true).order('chapter_number'),
      ]);
      setStory(s as any);
      if (c) {
        setChapter(c as ChapterFull);
        supabase.from('story_chapters').update({ views_count: (c as any).views_count + 1 }).eq('id', (c as any).id).then(() => {});
      }
      const arr = (nums || []).map((r: any) => r.chapter_number);
      const idx = arr.indexOf(num);
      setNeighbors({ prev: idx > 0 ? arr[idx - 1] : undefined, next: idx >= 0 && idx < arr.length - 1 ? arr[idx + 1] : undefined });
      setLoading(false);
      window.scrollTo(0, 0);
    })();
  }, [storyId, chapterNumber]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!chapter) return <div className="min-h-screen flex flex-col"><Navbar /><div className="flex-grow flex items-center justify-center text-sm">الفصل غير متاح</div><Footer /></div>;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead title={`${chapter.title} - ${story?.title || ''}`} description={chapter.content.slice(0, 150)} canonical={`https://kotobi.xyz/story/${storyId}/chapter/${chapter.chapter_number}`} />
      <Navbar />
      <main className="flex-grow container mx-auto px-3 py-4 max-w-2xl">
        <Link to={`/story/${storyId}`} className="text-sm text-primary flex items-center gap-1 mb-3"><ArrowRight className="h-4 w-4" /> {story?.title}</Link>
        <h1 className="text-xl font-black mb-1">{chapter.title}</h1>
        <div className="text-xs text-muted-foreground mb-4">الفصل #{chapter.chapter_number} • {chapter.word_count} كلمة</div>

        <article className="prose prose-lg max-w-none text-base font-[Tajawal,sans-serif]" dir="rtl">
          <ChapterContent content={chapter.content} />
        </article>


        <ChapterInteractions chapterId={chapter.id} />


        <div className="flex gap-2 mt-6">
          <Button variant="outline" disabled={!neighbors.prev} onClick={() => neighbors.prev && navigate(`/story/${storyId}/chapter/${neighbors.prev}`)} className="flex-1">
            <ArrowRight className="h-4 w-4 ml-1" /> السابق
          </Button>
          <Button disabled={!neighbors.next} onClick={() => neighbors.next && navigate(`/story/${storyId}/chapter/${neighbors.next}`)} className="flex-1">
            التالي <ArrowLeft className="h-4 w-4 mr-1" />
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  );
};
