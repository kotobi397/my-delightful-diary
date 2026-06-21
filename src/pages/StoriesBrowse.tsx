import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { SEOHead } from '@/components/seo/SEOHead';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { BookOpen, Eye, Loader2, Search } from 'lucide-react';

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
  const [stories, setStories] = useState<StoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('user_stories')
        .select('id,title,description,cover_url,category,status,views_count,created_at')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(200);
      setStories((data || []) as StoryRow[]);
      setLoading(false);
    })();
  }, []);

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
              <Link key={s.id} to={`/story/${s.id}`}>
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
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default StoriesBrowse;
