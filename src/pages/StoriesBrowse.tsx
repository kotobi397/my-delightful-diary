import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { SEOHead } from '@/components/seo/SEOHead';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { BookOpen, Eye, Loader2, Search, Trash2 } from 'lucide-react';

interface StoryRow {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  category: string | null;
  status: string;
  views_count: number;
  created_at: string;
}

const StoriesBrowse: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stories, setStories] = useState<StoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<StoryRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('user_stories')
      .select('id,title,description,cover_url,category,status,views_count,created_at')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) {
      toast({ title: 'تعذر تحميل القصص', description: error.message, variant: 'destructive' });
    } else {
      setStories((data || []) as StoryRow[]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    (async () => {
      if (!user?.id) { setIsAdmin(false); return; }
      const { data } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();
      setIsAdmin(!!data);
    })();
  }, [user?.id]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      // Delete child chapters first (in case of no cascade)
      await supabase.from('story_chapters').delete().eq('story_id', pendingDelete.id);
      const { error } = await supabase.from('user_stories').delete().eq('id', pendingDelete.id);
      if (error) throw error;
      toast({ title: 'تم حذف القصة' });
      setStories((prev) => prev.filter((s) => s.id !== pendingDelete.id));
      setPendingDelete(null);
    } catch (e: any) {
      toast({ title: 'فشل الحذف', description: e.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const filtered = q.trim()
    ? stories.filter(s => (s.title + ' ' + (s.description || '') + ' ' + (s.category || '')).toLowerCase().includes(q.toLowerCase()))
    : stories;

  return (
    <div className="min-h-screen flex flex-col bg-background" dir="rtl">
      <SEOHead title="قصص المستخدمين - منصة كتبي" description="اكتشف القصص والكتب التي يكتبها المستخدمون على منصة كتبي." canonical="https://kotobi.xyz/stories" />
      <Navbar />
      <main className="flex-grow container mx-auto px-3 py-4 max-w-5xl">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-black">قصص المستخدمين</h1>
        </div>
        <div className="relative mb-4">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="ابحث في قصص المستخدمين..." className="pr-9" />
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">لا توجد قصص بعد</CardContent></Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map(s => (
              <div key={s.id} className="relative">
                <Link to={`/story/${s.id}`}>
                  <Card className="hover:border-primary transition-colors h-full">
                    <CardContent className="p-2">
                      <div className="aspect-[3/4] rounded bg-muted overflow-hidden mb-2">
                        {s.cover_url ? (
                          <img src={s.cover_url} alt={s.title} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground"><BookOpen className="h-8 w-8" /></div>
                        )}
                      </div>
                      <div className="font-black text-sm line-clamp-2">{s.title}</div>
                      {s.category && <div className="text-[10px] text-primary mt-1">{s.category}</div>}
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
                        <Eye className="h-3 w-3" /> {s.views_count}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
                {isAdmin && (
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute top-1 left-1 h-7 w-7 shadow-md z-10"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPendingDelete(s); }}
                    aria-label="حذف القصة"
                    title="حذف القصة (إدارة)"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف القصة نهائياً؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف القصة "{pendingDelete?.title}" وكل فصولها. لا يمكن التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'حذف نهائي'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StoriesBrowse;
