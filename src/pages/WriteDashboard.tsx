import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { SEOHead } from '@/components/seo/SEOHead';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PenSquare, Plus, BookOpen, Eye, Heart, LogIn, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface StoryRow {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  status: string;
  is_public: boolean;
  views_count: number;
  likes_count: number;
  updated_at: string;
}

const WriteDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stories, setStories] = useState<StoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      const { data, error } = await supabase
        .from('user_stories')
        .select('*')
        .eq('author_id', user.id)
        .order('updated_at', { ascending: false });
      if (error) toast.error('فشل تحميل القصص');
      else setStories((data || []) as StoryRow[]);
      setLoading(false);
    })();
  }, [user]);

  const createStory = async () => {
    if (!user) return;
    setCreating(true);
    const { data, error } = await supabase
      .from('user_stories')
      .insert({ author_id: user.id, title: 'قصة بدون عنوان', description: '' })
      .select('id')
      .single();
    setCreating(false);
    if (error || !data) { toast.error('تعذر إنشاء القصة'); return; }
    navigate(`/write/${data.id}`);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-grow flex items-center justify-center px-4 py-10">
          <Card className="max-w-md w-full">
            <CardContent className="p-6 text-center space-y-4">
              <PenSquare className="h-10 w-10 mx-auto text-primary" />
              <h1 className="text-xl font-black">اكتب كتابك داخل المنصة</h1>
              <p className="text-sm text-muted-foreground">سجّل الدخول لتبدأ كتابة قصتك فصلاً بعد فصل ومشاركتها مع القراء.</p>
              <Button onClick={() => navigate('/auth')} className="w-full">
                <LogIn className="ml-2 h-4 w-4" /> تسجيل الدخول
              </Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead title="اكتب كتابك - منصة كتبي" description="اكتب قصتك أو كتابك مباشرة داخل المنصة وانشرها للقراء." canonical="https://kotobi.xyz/write" />
      <Navbar />
      <main className="flex-grow container mx-auto px-3 py-4 max-w-4xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-black flex items-center gap-2"><PenSquare className="h-5 w-5 text-primary" /> اكتب كتابك</h1>
            <p className="text-xs text-muted-foreground mt-1">أنشئ قصتك، اكتب فصولها، وانشرها للقراء.</p>
          </div>
          <Button onClick={createStory} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 ml-1" />}
            قصة جديدة
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : stories.length === 0 ? (
          <Card><CardContent className="p-8 text-center">
            <BookOpen className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-black mb-3">لم تنشئ أي قصة بعد</p>
            <Button onClick={createStory} disabled={creating}><Plus className="h-4 w-4 ml-1" /> ابدأ كتابة قصتك الأولى</Button>
          </CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {stories.map(s => (
              <Link key={s.id} to={`/write/${s.id}`}>
                <Card className="hover:border-primary transition-colors">
                  <CardContent className="p-3 flex gap-3">
                    <div className="w-16 h-24 rounded bg-muted overflow-hidden flex-shrink-0">
                      {s.cover_url ? (
                        <img src={s.cover_url} alt={s.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground"><BookOpen className="h-6 w-6" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-black text-sm truncate">{s.title}</h3>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${s.is_public ? 'bg-green-500/15 text-green-600' : 'bg-muted text-muted-foreground'}`}>
                          {s.is_public ? 'منشورة' : 'مسودة'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{s.description || 'لا يوجد وصف'}</p>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {s.views_count}</span>
                        <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {s.likes_count}</span>
                      </div>
                    </div>
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

export default WriteDashboard;
