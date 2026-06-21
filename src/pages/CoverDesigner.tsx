import React, { useState, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Wand2, Loader2, Download, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

const BOOK_TYPES = ['رواية', 'قصة', 'دراسة', 'سيرة ذاتية', 'شعر', 'تاريخ', 'فلسفة', 'دين', 'علوم', 'تنمية بشرية', 'أطفال', 'فن', 'سياسة', 'اقتصاد', 'تكنولوجيا', 'عام'];

type Position = 'top' | 'center' | 'bottom';
type HAlign = 'right' | 'center' | 'left';

const POSITION_OPTIONS: { value: Position; label: string }[] = [
  { value: 'top', label: 'في الأعلى' },
  { value: 'center', label: 'في الوسط' },
  { value: 'bottom', label: 'في الأسفل' },
];

const HALIGN_OPTIONS: { value: HAlign; label: string }[] = [
  { value: 'right', label: 'إلى اليمين' },
  { value: 'center', label: 'في المنتصف' },
  { value: 'left', label: 'إلى اليسار' },
];

const positionToY = (pos: Position, height: number, isPill = false) => {
  if (isPill) {
    if (pos === 'top') return height * 0.07;
    if (pos === 'center') return height * 0.47;
    return height * 0.86;
  }
  if (pos === 'top') return height * 0.16;
  if (pos === 'center') return height * 0.5;
  return height * 0.84;
};

const loadCoverImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

const fitLines = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) => {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth || !current) current = test;
    else { lines.push(current); current = word; }
  }
  if (current) lines.push(current);
  return lines.slice(0, maxLines);
};

const drawCenteredArabicText = (
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number,
  maxWidth: number, maxLines: number, startSize: number, minSize: number, weight: number,
) => {
  if (!text.trim()) return y;
  let size = startSize;
  let lines: string[] = [];
  do {
    ctx.font = `${weight} ${size}px Arial, Tahoma, sans-serif`;
    lines = fitLines(ctx, text, maxWidth, maxLines);
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (widest <= maxWidth && lines.length <= maxLines) break;
    size -= 4;
  } while (size >= minSize);

  const lineHeight = size * 1.28;
  const top = y - ((lines.length - 1) * lineHeight) / 2;
  ctx.textAlign = 'center';
  ctx.direction = 'rtl';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.72)';
  ctx.lineWidth = Math.max(3, size * 0.08);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.72)';
  ctx.shadowBlur = size * 0.16;
  ctx.shadowOffsetY = size * 0.05;
  lines.forEach((line, i) => {
    const ly = top + i * lineHeight;
    ctx.strokeText(line, x, ly, maxWidth);
    ctx.fillText(line, x, ly, maxWidth);
  });
  ctx.shadowColor = 'transparent';
};

const composeArabicCover = async (
  baseImageUrl: string, title: string, author: string, bookType: string,
  titlePos: Position, typePos: Position, typeAlign: HAlign,
) => {
  const img = await loadCoverImage(baseImageUrl);
  // Force taller portrait canvas (2:3.2 ratio) so the cover feels tall
  const width = 1024;
  const height = 1638;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return baseImageUrl;

  // Cover-fit the AI image into the taller canvas
  const sAspect = img.naturalWidth / img.naturalHeight;
  const tAspect = width / height;
  let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
  if (sAspect > tAspect) {
    sw = img.naturalHeight * tAspect;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    sh = img.naturalWidth / tAspect;
    sy = (img.naturalHeight - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);

  const shade = ctx.createLinearGradient(0, 0, 0, height);
  shade.addColorStop(0, 'rgba(0,0,0,0.50)');
  shade.addColorStop(0.3, 'rgba(0,0,0,0.10)');
  shade.addColorStop(0.7, 'rgba(0,0,0,0.10)');
  shade.addColorStop(1, 'rgba(0,0,0,0.58)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, width, height);

  const cleanTitle = title.trim();
  const cleanAuthor = author.trim();
  const cleanType = bookType.trim();
  const maxTextWidth = width * 0.82;

  // Category pill
  if (cleanType) {
    const categorySize = Math.max(30, width * 0.044);
    ctx.font = `700 ${categorySize}px Arial, Tahoma, sans-serif`;
    ctx.textAlign = 'center';
    ctx.direction = 'rtl';
    ctx.textBaseline = 'middle';
    const pillW = Math.min(width * 0.56, Math.max(width * 0.22, ctx.measureText(cleanType).width + width * 0.11));
    const pillH = categorySize * 1.8;
    const margin = width * 0.06;
    let pillX = (width - pillW) / 2;
    if (typeAlign === 'right') pillX = width - pillW - margin;
    else if (typeAlign === 'left') pillX = margin;
    const pillY = positionToY(typePos, height, true);
    ctx.fillStyle = 'rgba(0,0,0,0.44)';
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = Math.max(2, width * 0.003);
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(cleanType, pillX + pillW / 2, pillY + pillH / 2, pillW * 0.86);
  }

  drawCenteredArabicText(ctx, cleanTitle, width / 2, positionToY(titlePos, height), maxTextWidth, 3, width * 0.108, width * 0.056, 900);

  if (cleanAuthor) {
    drawCenteredArabicText(ctx, cleanAuthor, width / 2, height * 0.93, maxTextWidth, 2, width * 0.05, width * 0.034, 700);
  }

  return canvas.toDataURL('image/png');
};

const CoverDesigner: React.FC = () => {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [bookType, setBookType] = useState('رواية');
  const [prompt, setPrompt] = useState('');
  const [titlePos, setTitlePos] = useState<Position>('center');
  const [typePos, setTypePos] = useState<Position>('top');
  const [typeAlign, setTypeAlign] = useState<HAlign>('center');
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const stripTashkeel = (text: string) =>
    text.replace(/[\u064B-\u0652\u0670\u0640]/g, '').replace(/\s+/g, ' ').trim();

  const handleGenerate = useCallback(async () => {
    if (!title.trim()) { toast.error('أدخل عنوان الكتاب أولاً'); return; }
    if (prompt.trim().length < 3) { toast.error('اكتب وصفاً للغلاف'); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-cover-image', {
        body: { description: prompt.trim(), title: stripTashkeel(title), author: stripTashkeel(author), bookType },
      });
      if (error) { toast.error(error.message || 'فشل التوليد'); return; }
      if (data?.error) { toast.error(data.error); return; }
      if (data?.imageUrl) {
        const finalCover = await composeArabicCover(
          data.imageUrl, stripTashkeel(title), stripTashkeel(author), stripTashkeel(bookType),
          titlePos, typePos, typeAlign,
        );
        setImageUrl(finalCover);
        toast.success('تم إنشاء الغلاف!');
      } else toast.error('لم يتم إنشاء صورة');
    } catch (e: any) {
      toast.error(e?.message ?? 'حدث خطأ');
    } finally { setLoading(false); }
  }, [title, author, bookType, prompt, titlePos, typePos, typeAlign]);

  const handleDownload = useCallback(() => {
    if (!imageUrl) return;
    const link = document.createElement('a');
    link.download = `${title || 'غلاف-كتاب'}.png`;
    link.href = imageUrl;
    link.click();
  }, [imageUrl, title]);

  return (
    <div className="min-h-screen flex flex-col bg-background" dir="rtl">
      <Helmet>
        <title>تخيّل غلاف كتابك بالذكاء الاصطناعي - منصة كتبي</title>
        <meta name="description" content="أنشئ غلاف كتاب احترافي بالذكاء الاصطناعي مع تحكم بمكان العنوان والتصنيف." />
      </Helmet>
      <Navbar />
      <main className="flex-grow py-6">
        <div className="container mx-auto px-3 max-w-3xl">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary mb-3">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs font-bold">ميزة جديدة</span>
            </div>
            <h1 className="text-2xl font-black text-foreground mb-2">تخيّل غلاف كتابك بالذكاء الاصطناعي</h1>
            <p className="text-sm text-muted-foreground">
              تحكّم بمكان عنوان الكتاب وتصنيفه على الغلاف.
            </p>
          </div>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Wand2 className="h-5 w-5 text-primary" />
                إنشاء الغلاف
              </CardTitle>
              <CardDescription>اختر مكان النص ثم اضغط على زر التوليد.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="mb-2 block font-semibold">عنوان الكتاب</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: ظلال الذاكرة" className="text-right" dir="rtl" />
              </div>

              <div>
                <Label className="mb-2 block font-semibold">اسم المؤلف</Label>
                <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="مثال: أحمد محمد" className="text-right" dir="rtl" />
              </div>

              <div>
                <Label className="mb-2 block font-semibold">تصنيف الكتاب</Label>
                <Select value={bookType} onValueChange={setBookType}>
                  <SelectTrigger dir="rtl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BOOK_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-2 block font-semibold">مكان عنوان الكتاب</Label>
                  <Select value={titlePos} onValueChange={(v) => setTitlePos(v as Position)}>
                    <SelectTrigger dir="rtl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {POSITION_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-2 block font-semibold">مكان تصنيف الكتاب</Label>
                  <Select value={typePos} onValueChange={(v) => setTypePos(v as Position)}>
                    <SelectTrigger dir="rtl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {POSITION_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="mb-2 block font-semibold">محاذاة تصنيف الكتاب (يمين / وسط / يسار)</Label>
                <Select value={typeAlign} onValueChange={(v) => setTypeAlign(v as HAlign)}>
                  <SelectTrigger dir="rtl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {HALIGN_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="mb-2 block font-semibold">وصف الغلاف الذي تتخيّله</Label>
                <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="مثال: مدينة قديمة ليلاً، إضاءة قمر، ألوان داكنة مع لمسات ذهبية..." rows={5} className="text-right" dir="rtl" />
              </div>

              <Button onClick={handleGenerate} disabled={loading} className="w-full bg-gradient-to-r from-primary to-purple-600 hover:opacity-90 text-white font-bold" size="lg">
                {loading ? (<><Loader2 className="h-4 w-4 ml-2 animate-spin" /> جارٍ إنشاء الغلاف...</>) : (<><Wand2 className="h-4 w-4 ml-2" /> تخيّل الغلاف بالذكاء الاصطناعي</>)}
              </Button>

              {imageUrl && (
                <div className="pt-4 border-t">
                  <Label className="mb-3 block font-semibold">الغلاف الذي تم إنشاؤه</Label>
                  <div className="flex justify-center mb-3">
                    <img src={imageUrl} alt={title} className="w-full max-w-[420px] rounded-lg shadow-2xl border border-border" style={{ aspectRatio: '1024 / 1638', objectFit: 'cover' }} />
                  </div>
                  <Button onClick={handleDownload} variant="outline" className="w-full">
                    <Download className="h-4 w-4 ml-2" /> تحميل الغلاف
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default CoverDesigner;
