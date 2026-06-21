import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, Plus, ArrowRight, Trash2, ImageIcon, FileText, Eye } from 'lucide-react';
import { toast } from 'sonner';

interface Story {
  id: string;
  author_id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  category: string | null;
  language: string | null;
  status: string;
  is_public: boolean;
}

interface Chapter {
  id: string;
  chapter_number: number;
  title: string;
  is_published: boolean;
  word_count: number;
  updated_at: string;
}

const STORY_CATEGORIES = ['رواية', 'قصة قصيرة', 'شعر', 'خيال علمي', 'رومانسية', 'مغامرة', 'رعب', 'تاريخي', 'أدب', 'أخرى'];

const StoryEditorPage: React.FC = () => {
  const { storyId } = useParams<{ storyId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [story, setStory] = useState<Story | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  useEffect(() => {
    if (!storyId || !user) return;
    (async () => {
      const [{ data: s, error: e1 }, { data: c, error: e2 }] = await Promise.all([
        supabase.from('user_stories').select('*').eq('id', storyId).maybeSingle(),
        supabase.from('story_chapters').select('id,chapter_number,title,is_published,word_count,updated_at').eq('story_id', storyId).order('chapter_number'),
      ]);
      if (e1 || !s) { toast.error('تعذر تحميل القصة'); navigate('/write'); return; }
      if (s.author_id !== user.id) { toast.error('غير مصرح'); navigate('/write'); return; }
      setStory(s as Story);
      setChapters((c || []) as Chapter[]);
      if (e2) toast.error('تعذر تحميل الفصول');
      setLoading(false);
    })();
  }, [storyId, user, navigate]);

  const saveStory = async () => {
    if (!story) return;
    setSaving(true);
    const { error } = await supabase.from('user_stories').update({
      title: story.title.trim() || 'قصة بدون عنوان',
      description: story.description,
      category: story.category,
      language: story.language,
      status: story.status,
      is_public: story.is_public,
    }).eq('id', story.id);
    setSaving(false);
    if (error) toast.error('فشل الحفظ');
    else toast.success('تم الحفظ');
  };

  const uploadCover = async (file: File) => {
    if (!story || !user) return;
    setUploadingCover(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/${story.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('book-covers').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('book-covers').getPublicUrl(path);
      const url = pub.publicUrl;
      const { error } = await supabase.from('user_stories').update({ cover_url: url }).eq('id', story.id);
      if (error) throw error;
      setStory({ ...story, cover_url: url });
      toast.success('تم رفع الغلاف');
    } catch (e: any) {
      toast.error('فشل رفع الغلاف: ' + (e?.message || ''));
    } finally {
      setUploadingCover(false);
    }
  };

  const addChapter = async () => {
    if (!story) return;
    const nextNum = (chapters[chapters.length - 1]?.chapter_number || 0) + 1;
    const { data, error } = await supabase
      .from('story_chapters')
      .insert({ story_id: story.id, chapter_number: nextNum, title: `الفصل ${nextNum}`, content: '' })
      .select('id')
      .single();
    if (error || !data) { toast.error('فشل إضافة الفصل'); return; }
    navigate(`/write/${story.id}/chapter/${data.id}`);
  };

  const deleteChapter = async (id: string) => {
    if (!confirm('حذف هذا الفصل نهائياً؟')) return;
    const { error } = await supabase.from('story_chapters').delete().eq('id', id);
    if (error) { toast.error('فشل الحذف'); return; }
    setChapters(chapters.filter(c => c.id !== id));
    toast.success('تم الحذف');
  };

  const deleteStory = async () => {
    if (!story) return;
    if (!confirm('حذف القصة وجميع فصولها نهائياً؟')) return;
    const { error } = await supabase.from('user_stories').delete().eq('id', story.id);
    if (error) { toast.error('فشل الحذف'); return; }
    toast.success('تم الحذف');
    navigate('/write');
  };

  if (loading || !story) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <div className="flex-grow flex justify-center items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-grow container mx-auto px-3 py-4 max-w-3xl">
        <div className="flex items-center justify-between mb-4">
          <Link to="/write" className="text-sm text-primary flex items-center gap-1"><ArrowRight className="h-4 w-4" /> العودة</Link>
          <Button variant="destructive" size="sm" onClick={deleteStory}><Trash2 className="h-4 w-4 ml-1" /> حذف</Button>
        </div>

        <Card className="mb-4">
          <CardContent className="p-4 space-y-3">
            <div className="flex gap-3">
              <div className="w-24 h-32 rounded bg-muted overflow-hidden flex-shrink-0 relative group">
                {story.cover_url ? (
                  <img src={story.cover_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground"><ImageIcon className="h-8 w-8" /></div>
                )}
                <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs cursor-pointer transition-opacity">
                  {uploadingCover ? <Loader2 className="h-4 w-4 animate-spin" /> : 'تغيير'}
                  <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadCover(e.target.files[0])} />
                </label>
              </div>
              <div className="flex-1 space-y-2">
                <div>
                  <Label className="text-xs">العنوان</Label>
                  <Input value={story.title} onChange={e => setStory({ ...story, title: e.target.value })} maxLength={200} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">التصنيف</Label>
                    <Select value={story.category || ''} onValueChange={v => setStory({ ...story, category: v })}>
                      <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                      <SelectContent>{STORY_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">الحالة</Label>
                    <Select value={story.status} onValueChange={v => setStory({ ...story, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">مسودة</SelectItem>
                        <SelectItem value="ongoing">جارية</SelectItem>
                        <SelectItem value="completed">مكتملة</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs">الوصف</Label>
              <Textarea rows={3} maxLength={1000} value={story.description || ''} onChange={e => setStory({ ...story, description: e.target.value })} placeholder="عن ماذا تتحدث قصتك؟" />
            </div>

            <div className="flex items-center justify-between p-2 rounded border">
              <div>
                <Label className="text-sm font-black">نشر القصة للقراء</Label>
                <p className="text-[11px] text-muted-foreground">عند التفعيل، تظهر القصة وفصولها المنشورة لكل الزوار.</p>
              </div>
              <Switch checked={story.is_public} onCheckedChange={v => setStory({ ...story, is_public: v })} />
            </div>

            <div className="flex gap-2">
              <Button onClick={saveStory} disabled={saving} className="flex-1">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 ml-1" /> حفظ معلومات القصة</>}
              </Button>
              {story.is_public && (
                <Button variant="outline" onClick={() => navigate(`/story/${story.id}`)}><Eye className="h-4 w-4 ml-1" /> معاينة</Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-black">الفصول ({chapters.length})</h2>
          <Button size="sm" onClick={addChapter}><Plus className="h-4 w-4 ml-1" /> فصل جديد</Button>
        </div>

        {chapters.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2" />
            لا يوجد فصول بعد. ابدأ بإضافة الفصل الأول.
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {chapters.map(ch => (
              <Card key={ch.id} className="hover:border-primary transition-colors">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="text-xs font-black text-muted-foreground w-8">#{ch.chapter_number}</div>
                  <Link to={`/write/${story.id}/chapter/${ch.id}`} className="flex-1 min-w-0">
                    <div className="font-black text-sm truncate">{ch.title}</div>
                    <div className="text-[11px] text-muted-foreground">{ch.word_count} كلمة</div>
                  </Link>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${ch.is_published ? 'bg-green-500/15 text-green-600' : 'bg-muted text-muted-foreground'}`}>
                    {ch.is_published ? 'منشور' : 'مسودة'}
                  </span>
                  <Button size="icon" variant="ghost" onClick={() => deleteChapter(ch.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default StoryEditorPage;
