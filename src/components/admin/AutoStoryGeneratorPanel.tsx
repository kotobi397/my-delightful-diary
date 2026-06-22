import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { BookOpen, Play, Loader2, Sparkles, RefreshCw } from 'lucide-react';

interface StoryConfig {
  enabled: boolean;
  topics: string[];
  chapters_per_story: number;
  stories_per_run: number;
  min_chapter_words: number;
  model: string;
  language: string;
  total_generated: number;
  last_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
}

const AutoStoryGeneratorPanel: React.FC = () => {
  const { toast } = useToast();
  const [cfg, setCfg] = useState<StoryConfig | null>(null);
  const [topicsText, setTopicsText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('auto_story_config')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (data) {
      const c = data as unknown as StoryConfig;
      setCfg(c);
      setTopicsText((c.topics || []).join('\n'));
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  const save = async (patch: Partial<StoryConfig>) => {
    setSaving(true);
    const { error } = await supabase
      .from('auto_story_config')
      .update(patch as any)
      .eq('id', 1);
    setSaving(false);
    if (error) {
      toast({ title: 'فشل الحفظ', description: error.message, variant: 'destructive' });
    } else {
      await load();
    }
  };

  const toggleEnabled = async (checked: boolean) => {
    await save({ enabled: checked });
    toast({
      title: checked ? '✅ تم تشغيل توليد القصص التلقائي' : '⏸️ تم إيقاف توليد القصص',
      description: checked
        ? 'سيقوم النظام بتوليد قصص جديدة بفصول كل 30 دقيقة باستخدام Mistral AI.'
        : 'لن يتم توليد قصص جديدة.',
    });
  };

  const saveTopics = async () => {
    const topics = topicsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    if (topics.length === 0) {
      toast({ title: 'أضف موضوعًا واحدًا على الأقل', variant: 'destructive' });
      return;
    }
    await save({ topics });
    toast({ title: 'تم حفظ المواضيع', description: `${topics.length} موضوع` });
  };

  const runNow = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        'auto-generate-stories-worker',
        { body: {} },
      );
      if (error) throw new Error(error.message);
      if (data?.skipped) {
        toast({ title: 'تم التخطي', description: data?.reason || 'معطّل' });
      } else {
        toast({
          title: 'اكتمل التشغيل',
          description: `أُنشئت ${data?.stories || 0} قصة بـ ${data?.chapters || 0} فصل`,
        });
      }
      await load();
    } catch (e: any) {
      toast({ title: 'فشل التشغيل', description: e.message, variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> جاري التحميل…
        </CardContent>
      </Card>
    );
  }

  if (!cfg) return null;

  return (
    <Card className="border-2 border-purple-500/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-purple-500" />
          توليد القصص تلقائياً من Archive.org
          {cfg.enabled ? (
            <Badge className="bg-green-600">يعمل</Badge>
          ) : (
            <Badge variant="secondary">متوقف</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Sparkles className="w-4 h-4" />
          <AlertDescription>
            يقوم النظام في الخلفية كل 30 دقيقة بجلب قصص حقيقية من Archive.org مع
            صورة الغلاف، وتقسيمها إلى فصول، ونسبها لحسابات بوتات الذكاء الاصطناعي.
            يعمل حتى لو كنت خارج الموقع.
          </AlertDescription>
        </Alert>

        <div className="flex items-center justify-between p-3 rounded-lg border">
          <div>
            <Label className="text-base">تشغيل التوليد التلقائي</Label>
            <p className="text-sm text-muted-foreground">
              تشغيل/إيقاف الـ Cron كل 30 دقيقة
            </p>
          </div>
          <Switch checked={cfg.enabled} onCheckedChange={toggleEnabled} disabled={saving} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label>قصص لكل تشغيلة</Label>
            <Input
              type="number"
              min={1}
              max={5}
              value={cfg.stories_per_run}
              onChange={(e) =>
                setCfg({ ...cfg, stories_per_run: parseInt(e.target.value) || 1 })
              }
              onBlur={() => save({ stories_per_run: cfg.stories_per_run })}
            />
          </div>
          <div>
            <Label>فصول لكل قصة</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={cfg.chapters_per_story}
              onChange={(e) =>
                setCfg({ ...cfg, chapters_per_story: parseInt(e.target.value) || 5 })
              }
              onBlur={() => save({ chapters_per_story: cfg.chapters_per_story })}
            />
          </div>
          <div>
            <Label>الحد الأدنى للكلمات</Label>
            <Input
              type="number"
              min={100}
              max={3000}
              step={50}
              value={cfg.min_chapter_words}
              onChange={(e) =>
                setCfg({ ...cfg, min_chapter_words: parseInt(e.target.value) || 350 })
              }
              onBlur={() => save({ min_chapter_words: cfg.min_chapter_words })}
            />
          </div>
        </div>

        <div>
          <Label>كلمات البحث في Archive.org (سطر لكل عبارة)</Label>
        </div>

        <div>
          <Label>قائمة المواضيع (سطر لكل موضوع)</Label>
          <Textarea
            rows={6}
            value={topicsText}
            onChange={(e) => setTopicsText(e.target.value)}
            placeholder="رحلة في الصحراء&#10;قصة حب في الأندلس&#10;سر المكتبة القديمة"
          />
          <div className="flex justify-end mt-2">
            <Button size="sm" variant="outline" onClick={saveTopics} disabled={saving}>
              حفظ المواضيع
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={runNow} disabled={running}>
            {running ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            تشغيل الآن
          </Button>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className="w-4 h-4 mr-2" /> تحديث
          </Button>
          <Badge variant="outline">
            إجمالي القصص المُنشأة: {cfg.total_generated || 0}
          </Badge>
          {cfg.last_run_at && (
            <Badge variant="outline">
              آخر تشغيل: {new Date(cfg.last_run_at).toLocaleString('ar')}
            </Badge>
          )}
        </div>

        {cfg.last_status && (
          <Alert>
            <AlertDescription className="text-sm">
              <strong>الحالة:</strong> {cfg.last_status}
              {cfg.last_error && (
                <div className="text-destructive mt-1">⚠️ {cfg.last_error}</div>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default AutoStoryGeneratorPanel;
