import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, TrendingUp } from 'lucide-react';

interface BoostSettings {
  enabled: boolean;
  min: number;
  max: number;
}

const DEFAULTS: BoostSettings = { enabled: false, min: 3, max: 10 };

const ViewsBoostManager: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<BoostSettings>(DEFAULTS);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'views_boost')
        .maybeSingle();
      if (!error && data?.value) {
        const v = data.value as any;
        setSettings({
          enabled: !!v.enabled,
          min: Number(v.min) || 3,
          max: Number(v.max) || 10,
        });
      }
      setLoading(false);
    })();
  }, []);

  const save = async (next: BoostSettings) => {
    setSaving(true);
    const { error } = await supabase
      .from('site_settings')
      .upsert({ key: 'views_boost', value: next as any, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    setSaving(false);
    if (error) {
      toast({ title: 'فشل الحفظ', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'تم الحفظ', description: 'تم تحديث إعدادات تعزيز المشاهدات' });
    return true;
  };

  const handleToggle = async (enabled: boolean) => {
    const next = { ...settings, enabled };
    setSettings(next);
    await save(next);
  };

  const handleSaveRange = async () => {
    let { min, max } = settings;
    if (min < 1) min = 1;
    if (max < min) max = min;
    const next = { ...settings, min, max };
    setSettings(next);
    await save(next);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          تعزيز المشاهدات
        </CardTitle>
        <CardDescription>
          عند التفعيل، تزداد مشاهدات الكتاب بشكل عشوائي ضمن النطاق المحدد بدلًا من +1 في كل مرة. عند الإيقاف يعود السلوك الطبيعي (+1).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <Label className="text-base">تفعيل التعزيز</Label>
            <p className="text-sm text-muted-foreground mt-1">
              الحالة الحالية: {settings.enabled ? 'مفعّل ✅' : 'متوقف ❌'}
            </p>
          </div>
          <Switch checked={settings.enabled} onCheckedChange={handleToggle} disabled={saving} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="min">الحد الأدنى للزيادة</Label>
            <Input
              id="min"
              type="number"
              min={1}
              value={settings.min}
              onChange={(e) => setSettings({ ...settings, min: parseInt(e.target.value) || 1 })}
            />
          </div>
          <div>
            <Label htmlFor="max">الحد الأعلى للزيادة</Label>
            <Input
              id="max"
              type="number"
              min={1}
              value={settings.max}
              onChange={(e) => setSettings({ ...settings, max: parseInt(e.target.value) || 1 })}
            />
          </div>
        </div>

        <Button onClick={handleSaveRange} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
          حفظ النطاق
        </Button>

        <p className="text-xs text-muted-foreground">
          مثال: عند ضبط النطاق 3 إلى 10، كل مشاهدة ستضيف عددًا عشوائيًا بين 3 و10.
        </p>
      </CardContent>
    </Card>
  );
};

export default ViewsBoostManager;