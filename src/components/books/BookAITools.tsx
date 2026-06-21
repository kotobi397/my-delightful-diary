import React, { useState } from 'react';
import { Sparkles, BookOpen, Quote, HelpCircle, Loader2, Coins, Clock, Puzzle, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useGamificationState } from '@/hooks/useGamification';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import BookQuizDialog from '@/components/reading/BookQuizDialog';

type Action = 'summary' | 'quotes' | 'ask' | 'reading_time' | 'characters';

const FEATURES: { action: Action; title: string; price: number; icon: React.ReactNode; needsInput?: 'question' }[] = [
  { action: 'summary', title: 'تلخيص الكتاب', price: 30, icon: <BookOpen className="w-5 h-5" /> },
  { action: 'quotes', title: 'استخراج اقتباسات', price: 20, icon: <Quote className="w-5 h-5" /> },
  { action: 'ask', title: 'اطرح سؤالاً', price: 5, icon: <HelpCircle className="w-5 h-5" />, needsInput: 'question' },
  { action: 'reading_time', title: 'مدة القراءة المتوقعة', price: 10, icon: <Clock className="w-5 h-5" /> },
  { action: 'characters', title: '👥 تحليل الشخصيات', price: 40, icon: <Users className="w-5 h-5" /> },
];


interface Props {
  bookId: string;
  bookTitle: string;
}

const BookAITools: React.FC<Props> = ({ bookId, bookTitle }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: gam } = useGamificationState();
  const qc = useQueryClient();
  const [active, setActive] = useState<typeof FEATURES[number] | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [quizOpen, setQuizOpen] = useState(false);

  const coins = gam?.coins ?? 0;

  const openFeature = (f: typeof FEATURES[number]) => {
    if (!user) {
      toast.error('يجب تسجيل الدخول لاستخدام مزايا الذكاء الاصطناعي');
      navigate('/auth');
      return;
    }
    setActive(f);
    setInputValue('');
    setResult(null);
  };

  const runFeature = async () => {
    if (!active) return;
    if (coins < active.price) {
      toast.error(`تحتاج ${active.price} عملة، رصيدك ${coins} فقط`);
      return;
    }
    if (active.needsInput === 'question' && !inputValue.trim()) {
      toast.error('اكتب سؤالك');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-book-tools', {
        body: {
          action: active.action,
          bookId,
          question: active.needsInput === 'question' ? inputValue : undefined,
        },
      });
      if (error) {
        const msg = (error as any)?.context?.error || error.message || 'حدث خطأ';
        if (msg.includes('insufficient_coins')) toast.error('رصيدك غير كافٍ');
        else if (msg.includes('rate_limited')) toast.error('تم تجاوز الحد، حاول لاحقاً');
        else toast.error(msg);
        return;
      }
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      setResult(data.content);
      toast.success(`تم — خُصمت ${data.coins_spent} 🪙 (الرصيد: ${data.new_balance})`);
      qc.invalidateQueries({ queryKey: ['gamification', 'state'] });
    } catch (e: any) {
      toast.error(e?.message ?? 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card className="mt-8 p-5 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent" dir="rtl">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-bold font-amiri">مزايا الذكاء الاصطناعي</h3>
          </div>
          {user && (
            <div className="flex items-center gap-1.5 text-sm bg-card border rounded-full px-3 py-1">
              <Coins className="w-4 h-4 text-amber-500" />
              <span className="font-bold" dir="ltr">{coins.toLocaleString('en')}</span>
              <span className="text-muted-foreground text-xs">عملة</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {FEATURES.map((f) => (
            <button
              key={f.action}
              onClick={() => openFeature(f)}
              className="flex flex-col items-center gap-2 p-3 rounded-lg border border-border bg-card hover:border-primary hover:shadow-sm transition-all text-center"
            >
              <div className="text-primary">{f.icon}</div>
              <span className="text-xs font-semibold leading-tight">{f.title}</span>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground" dir="ltr">
                <Coins className="w-3 h-3 text-amber-500" />
                {f.price}
              </span>
            </button>
          ))}
          <button
            onClick={() => {
              if (!user) {
                toast.error('يجب تسجيل الدخول لاستخدام مزايا الذكاء الاصطناعي');
                navigate('/auth');
                return;
              }
              setQuizOpen(true);
            }}
            className="flex flex-col items-center gap-2 p-3 rounded-lg border border-border bg-card hover:border-primary hover:shadow-sm transition-all text-center"
          >
            <div className="text-primary"><Puzzle className="w-5 h-5" /></div>
            <span className="text-xs font-semibold leading-tight">🧩 اختبار بعد القراءة</span>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground" dir="ltr">
              <Coins className="w-3 h-3 text-amber-500" />
              30
            </span>

          </button>
        </div>


        {!user && (
          <p className="text-xs text-muted-foreground mt-3 text-center">
            <Link to="/auth" className="text-primary underline">سجّل الدخول</Link> لاستخدام هذه المزايا
          </p>
        )}
      </Card>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent
          dir="rtl"
          className="max-w-2xl max-h-[75vh] sm:max-h-[85vh] overflow-y-auto top-[42%] sm:top-[50%] translate-y-[-42%] sm:translate-y-[-50%]"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-amiri">
              <Sparkles className="w-5 h-5 text-primary" />
              {active?.title}
            </DialogTitle>
            <DialogDescription className="text-xs">
              الكتاب: {bookTitle} · التكلفة: {active?.price} 🪙
            </DialogDescription>
          </DialogHeader>

          {!result && (
            <div className="space-y-3">
              {active?.needsInput === 'question' && (
                <Textarea
                  placeholder="اكتب سؤالك عن الكتاب…"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  rows={3}
                  disabled={loading}
                />
              )}
              {!active?.needsInput && (
                <p className="text-sm text-muted-foreground">
                  سيتم خصم {active?.price} عملة من رصيدك ({coins} 🪙) لتنفيذ هذه الميزة.
                </p>
              )}
            </div>
          )}

          {result && (
            <div className="prose prose-sm max-w-none whitespace-pre-wrap font-cairo text-foreground leading-relaxed text-justify p-3 bg-muted/30 rounded-lg border">
              {result}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setActive(null)} disabled={loading}>
              {result ? 'إغلاق' : 'إلغاء'}
            </Button>
            {!result && (
              <Button onClick={runFeature} disabled={loading || coins < (active?.price ?? 0)}>
                {loading ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جارٍ المعالجة…</> : <>تنفيذ ({active?.price} 🪙)</>}
              </Button>
            )}
            {result && (
              <Button onClick={() => { setResult(null); setInputValue(''); }}>
                تنفيذ مرة أخرى
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BookQuizDialog
        open={quizOpen}
        onOpenChange={setQuizOpen}
        bookId={bookId}
        bookTitle={bookTitle}
      />
    </>

  );
};

export default BookAITools;
