import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Loader2,
  ArrowRight,
  Save,
  CheckCircle2,
  XCircle,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { ChapterContent } from '@/lib/chapterContent';
import { ChapterBlocksEditor } from '@/components/writing/ChapterBlocksEditor';

interface Chapter {
  id: string;
  story_id: string;
  chapter_number: number;
  title: string;
  content: string;
  is_published: boolean;
  word_count: number;
}

const countWords = (s: string) => {
  // Strip image markers before counting.
  const text = s.replace(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g, ' ');
  return text.trim() ? text.trim().split(/\s+/).length : 0;
};

const ChapterEditorPage: React.FC = () => {
  const { storyId, chapterId } = useParams<{ storyId: string; chapterId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const dirtyRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!chapterId || !user) return;
    (async () => {
      const { data, error } = await supabase
        .from('story_chapters')
        .select(
          'id,story_id,chapter_number,title,content,is_published,word_count, user_stories!inner(author_id)',
        )
        .eq('id', chapterId)
        .maybeSingle();
      if (error || !data) {
        toast.error('تعذر تحميل الفصل');
        navigate(`/write/${storyId}`);
        return;
      }
      // @ts-ignore
      if (data.user_stories?.author_id !== user.id) {
        toast.error('غير مصرح');
        navigate('/write');
        return;
      }
      const { user_stories: _u, ...rest } = data as any;
      setChapter(rest as Chapter);
      setLoading(false);
    })();
  }, [chapterId, user, navigate, storyId]);

  const save = async (next: Chapter, silent = false) => {
    setSaving(true);
    const wc = countWords(next.content);
    const { error } = await supabase
      .from('story_chapters')
      .update({
        title: next.title.trim() || `الفصل ${next.chapter_number}`,
        content: next.content,
        word_count: wc,
      })
      .eq('id', next.id);
    setSaving(false);
    if (error) {
      if (!silent) toast.error('فشل الحفظ');
      return false;
    }
    dirtyRef.current = false;
    setSavedAt(new Date());
    if (!silent) toast.success('تم الحفظ');
    return true;
  };

  // Auto-save debounced
  useEffect(() => {
    if (!chapter || !dirtyRef.current) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      if (chapter) save(chapter, true);
    }, 2000);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [chapter?.content, chapter?.title]);

  const update = (patch: Partial<Chapter>) => {
    if (!chapter) return;
    dirtyRef.current = true;
    setChapter({ ...chapter, ...patch });
  };

  const togglePublish = async () => {
    if (!chapter) return;
    await save(chapter, true);
    const newState = !chapter.is_published;
    const { error } = await supabase
      .from('story_chapters')
      .update({
        is_published: newState,
        published_at: newState ? new Date().toISOString() : null,
      })
      .eq('id', chapter.id);
    if (error) {
      toast.error('فشل تحديث حالة النشر');
      return;
    }
    setChapter({ ...chapter, is_published: newState });
    toast.success(newState ? 'تم نشر الفصل' : 'تم إلغاء النشر');
  };

  if (loading || !chapter || !user) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <div className="flex-grow flex justify-center items-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const wc = countWords(chapter.content);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-grow container mx-auto px-3 py-4 max-w-3xl">
        <div className="flex items-center justify-between mb-3">
          <Link
            to={`/write/${storyId}`}
            className="text-sm text-primary flex items-center gap-1"
          >
            <ArrowRight className="h-4 w-4" /> العودة للقصة
          </Link>
          <div className="text-[11px] text-muted-foreground flex items-center gap-2">
            {saving ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" /> جارٍ الحفظ...
              </>
            ) : savedAt ? (
              <>تم الحفظ {savedAt.toLocaleTimeString('ar')}</>
            ) : null}
          </div>
        </div>

        <div className="mb-2 text-xs text-muted-foreground">
          الفصل #{chapter.chapter_number} • {wc} كلمة
        </div>

        <Input
          value={chapter.title}
          onChange={(e) => update({ title: e.target.value })}
          maxLength={200}
          className="text-lg font-black mb-3"
          placeholder="عنوان الفصل"
        />

        <ChapterBlocksEditor
          chapterId={chapter.id}
          userId={user.id}
          initialContent={chapter.content}
          onChange={(content) => update({ content })}
        />

        <div className="mt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowPreview((v) => !v)}
            className="gap-1"
          >
            <Eye className="h-4 w-4" />
            <span>{showPreview ? 'إخفاء المعاينة' : 'معاينة كما يرى القارئ'}</span>
          </Button>
        </div>

        {showPreview && (
          <div className="mt-3 p-4 border rounded-lg bg-muted/30">
            <div dir="rtl">
              <ChapterContent content={chapter.content} />
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-4 sticky bottom-2 bg-background/95 backdrop-blur p-2 rounded-lg border">
          <Button
            onClick={() => save(chapter)}
            disabled={saving}
            variant="outline"
            className="flex-1"
          >
            <Save className="h-4 w-4 ml-1" /> حفظ
          </Button>
          <Button
            onClick={togglePublish}
            className="flex-1"
            variant={chapter.is_published ? 'secondary' : 'default'}
          >
            {chapter.is_published ? (
              <>
                <XCircle className="h-4 w-4 ml-1" /> إلغاء النشر
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 ml-1" /> نشر الفصل
              </>
            )}
          </Button>
        </div>
      </main>
    </div>
  );
};

export default ChapterEditorPage;
