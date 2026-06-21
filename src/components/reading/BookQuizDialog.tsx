import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Award, AlertCircle, Puzzle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Difficulty = 'easy' | 'medium' | 'hard';
type QuizType = 'qcm' | 'true_false' | 'open';

interface Question {
  type: QuizType;
  question: string;
  options?: string[];
  correct_index?: number;
  expected_answer?: string;
  key_points?: string[];
  explanation?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bookId: string;
  bookTitle: string;
}

type Stage = 'config' | 'loading' | 'quiz' | 'results';

const QUIZ_TYPES: { v: QuizType; l: string; d: string }[] = [
  { v: 'qcm', l: 'اختيار من متعدد', d: 'QCM — 4 خيارات' },
  { v: 'true_false', l: 'صح أو خطأ', d: 'عبارات للحكم عليها' },
  { v: 'open', l: 'أسئلة مفتوحة', d: 'إجابة بأسلوبك' },
];

const BookQuizDialog: React.FC<Props> = ({ open, onOpenChange, bookId, bookTitle }) => {
  const { user } = useAuth();
  const [stage, setStage] = useState<Stage>('config');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [quizType, setQuizType] = useState<QuizType>('qcm');
  const [questionCount, setQuestionCount] = useState(10);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [quizId, setQuizId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Array<number | string>>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStage('config');
    setQuestions([]);
    setQuizId(null);
    setAnswers([]);
    setCurrentQ(0);
    setError(null);
  };

  const handleStart = async () => {
    setStage('loading');
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('generate-book-quiz', {
        body: { bookId, difficulty, questionCount, quizType, forceRefresh: false },
      });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      if (!data?.questions || data.questions.length === 0) {
        throw new Error('لم نتمكن من توليد أسئلة لهذا الكتاب');
      }
      const qs: Question[] = data.questions;
      setQuestions(qs);
      setQuizId(data.quizId ?? null);
      setAnswers(qs.map((q) => (q.type === 'open' ? '' : -1)));
      setCurrentQ(0);
      setStage('quiz');
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'حدث خطأ');
      setStage('config');
      toast.error(e?.message || 'فشل توليد الاختبار');
    }
  };

  const handleAnswer = (val: number | string) => {
    const next = [...answers];
    next[currentQ] = val;
    setAnswers(next);
  };

  const gradeOpen = (q: Question, ans: string): number => {
    const text = (ans || '').toLowerCase();
    if (!text.trim() || !q.key_points?.length) return 0;
    const hits = q.key_points.filter((k) => text.includes(k.toLowerCase().slice(0, Math.min(8, k.length)))).length;
    return hits / q.key_points.length;
  };

  const computeScore = () => {
    let s = 0;
    questions.forEach((q, i) => {
      if (q.type === 'open') {
        s += gradeOpen(q, String(answers[i] ?? '')) >= 0.5 ? 1 : 0;
      } else {
        if (answers[i] === q.correct_index) s += 1;
      }
    });
    return s;
  };

  const handleSubmit = async () => {
    const score = computeScore();
    setStage('results');
    if (user) {
      await supabase.from('book_quiz_attempts').insert({
        user_id: user.id,
        book_id: bookId,
        quiz_id: quizId,
        difficulty,
        question_count: questions.length,
        score,
        answers: answers.map((a, i) => ({
          q: questions[i].question,
          type: questions[i].type,
          chosen: a,
          correct: questions[i].correct_index ?? questions[i].expected_answer,
        })),
      });
    }
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const score = computeScore();
  const isAnswered = (i: number) => {
    const q = questions[i];
    if (!q) return false;
    if (q.type === 'open') return String(answers[i] ?? '').trim().length > 5;
    return answers[i] !== -1;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Puzzle className="w-5 h-5 text-primary" />
            اختبار بعد القراءة: {bookTitle}
          </DialogTitle>
        </DialogHeader>

        {stage === 'config' && (
          <div className="space-y-5">
            <p className="text-muted-foreground text-sm">
              🧩 اختبر فهمك للكتاب بأسئلة مولّدة آلياً بالذكاء الاصطناعي.
            </p>
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-lg p-3 text-xs text-amber-900 dark:text-amber-200">
              💰 توليد اختبار جديد يكلّف <strong>30 عملة</strong>. الاختبارات المخزّنة سابقاً لنفس الإعدادات مجانية.
            </div>


            <div>
              <Label className="mb-2 block font-semibold">نوع الاختبار</Label>
              <RadioGroup
                value={quizType}
                onValueChange={(v) => setQuizType(v as QuizType)}
                className="grid grid-cols-1 gap-2"
              >
                {QUIZ_TYPES.map((opt) => (
                  <Label
                    key={opt.v}
                    className={cn(
                      'border rounded-lg p-3 cursor-pointer transition flex items-center justify-between gap-2',
                      quizType === opt.v ? 'border-primary bg-primary/10' : 'hover:bg-accent',
                    )}
                  >
                    <RadioGroupItem value={opt.v} className="sr-only" />
                    <span className="font-semibold">{opt.l}</span>
                    <span className="text-xs text-muted-foreground">{opt.d}</span>
                  </Label>
                ))}
              </RadioGroup>
            </div>

            <div>
              <Label className="mb-2 block font-semibold">الصعوبة</Label>
              <RadioGroup
                value={difficulty}
                onValueChange={(v) => setDifficulty(v as Difficulty)}
                className="grid grid-cols-3 gap-2"
              >
                {[
                  { v: 'easy', l: 'سهل' },
                  { v: 'medium', l: 'متوسط' },
                  { v: 'hard', l: 'صعب' },
                ].map((opt) => (
                  <Label
                    key={opt.v}
                    className={cn(
                      'border rounded-lg p-3 text-center cursor-pointer transition',
                      difficulty === opt.v ? 'border-primary bg-primary/10' : 'hover:bg-accent',
                    )}
                  >
                    <RadioGroupItem value={opt.v} className="sr-only" />
                    {opt.l}
                  </Label>
                ))}
              </RadioGroup>
            </div>

            <div>
              <Label className="mb-2 block font-semibold">عدد الأسئلة</Label>
              <RadioGroup
                value={String(questionCount)}
                onValueChange={(v) => setQuestionCount(Number(v))}
                className="grid grid-cols-3 gap-2"
              >
                {[5, 10, 15].map((n) => (
                  <Label
                    key={n}
                    className={cn(
                      'border rounded-lg p-3 text-center cursor-pointer transition',
                      questionCount === n ? 'border-primary bg-primary/10' : 'hover:bg-accent',
                    )}
                  >
                    <RadioGroupItem value={String(n)} className="sr-only" />
                    {n} أسئلة
                  </Label>
                ))}
              </RadioGroup>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleStart} className="flex-1">ابدأ الاختبار</Button>
              <Button variant="ghost" onClick={() => handleClose(false)}>لاحقاً</Button>
            </div>
          </div>
        )}

        {stage === 'loading' && (
          <div className="py-12 flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-muted-foreground">جاري توليد الأسئلة بالذكاء الاصطناعي...</p>
          </div>
        )}

        {stage === 'quiz' && questions.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>سؤال {currentQ + 1} من {questions.length}</span>
              <div className="flex-1 mx-3 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }}
                />
              </div>
            </div>

            <h3 className="text-lg font-semibold leading-relaxed">
              {questions[currentQ].question}
            </h3>

            {questions[currentQ].type === 'open' ? (
              <Textarea
                value={String(answers[currentQ] ?? '')}
                onChange={(e) => handleAnswer(e.target.value)}
                placeholder="اكتب إجابتك هنا…"
                rows={5}
              />
            ) : (
              <div className="space-y-2">
                {(questions[currentQ].options ?? []).map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => handleAnswer(i)}
                    className={cn(
                      'w-full text-right p-3 rounded-lg border transition',
                      answers[currentQ] === i ? 'border-primary bg-primary/10 font-medium' : 'hover:bg-accent',
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                disabled={currentQ === 0}
                onClick={() => setCurrentQ(currentQ - 1)}
              >
                السابق
              </Button>
              {currentQ < questions.length - 1 ? (
                <Button
                  className="flex-1"
                  disabled={!isAnswered(currentQ)}
                  onClick={() => setCurrentQ(currentQ + 1)}
                >
                  التالي
                </Button>
              ) : (
                <Button
                  className="flex-1"
                  disabled={questions.some((_, i) => !isAnswered(i))}
                  onClick={handleSubmit}
                >
                  إنهاء وعرض النتيجة
                </Button>
              )}
            </div>
          </div>
        )}

        {stage === 'results' && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <div className="text-5xl font-black text-primary mb-2">
                {score} / {questions.length}
              </div>
              <p className="text-muted-foreground">
                {score === questions.length ? '🏆 ممتاز! درجة كاملة' :
                 score / questions.length >= 0.7 ? '👏 أداء رائع' :
                 score / questions.length >= 0.5 ? '👍 جيد، يمكنك مراجعة بعض النقاط' :
                 '📖 ربما تحتاج لإعادة القراءة'}
              </p>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto">
              {questions.map((q, i) => {
                const isOpen = q.type === 'open';
                const correct = isOpen
                  ? gradeOpen(q, String(answers[i] ?? '')) >= 0.5
                  : answers[i] === q.correct_index;
                return (
                  <div
                    key={i}
                    className={cn(
                      'p-3 rounded-lg border text-sm',
                      correct ? 'border-green-500/30 bg-green-500/5' : 'border-destructive/30 bg-destructive/5',
                    )}
                  >
                    <p className="font-semibold mb-1">{i + 1}. {q.question}</p>
                    {isOpen ? (
                      <>
                        <p className="text-xs"><span className="text-muted-foreground">إجابتك:</span> {String(answers[i] ?? '') || '—'}</p>
                        <p className="text-xs mt-1"><span className="text-muted-foreground">الإجابة النموذجية:</span> {q.expected_answer}</p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        الإجابة الصحيحة: {q.options?.[q.correct_index ?? 0]}
                      </p>
                    )}
                    {q.explanation && (
                      <p className="text-xs mt-1 text-muted-foreground italic">💡 {q.explanation}</p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2">
              <Button onClick={reset} variant="outline" className="flex-1">
                <Award className="w-4 h-4 ml-2" />
                اختبار جديد
              </Button>
              <Button onClick={() => handleClose(false)} className="flex-1">إغلاق</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BookQuizDialog;
