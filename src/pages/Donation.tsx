import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Heart, Database, Users, Target, Gift, Loader2, X, Shield, Lock } from "lucide-react";
import { SEOHead } from "@/components/seo/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";


const PRESET_AMOUNTS = [3, 5, 10, 20];
const MIN_AMOUNT = 1;
const MAX_AMOUNT = 1000;

const Donation = () => {
  const [currentAmount, setCurrentAmount] = useState(0);
  const [selectedAmount, setSelectedAmount] = useState<number>(5);
  const [loading, setLoading] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const targetAmount = 30;
  const progressPercentage = Math.min((currentAmount / targetAmount) * 100, 100);
  const remainingAmount = Math.max(targetAmount - currentAmount, 0);

  useEffect(() => {
    sessionStorage.setItem('donation_page_visited', 'true');
  }, []);

  const handleDonate = async () => {
    if (selectedAmount < MIN_AMOUNT || selectedAmount > MAX_AMOUNT) {
      toast({
        title: "مبلغ غير صالح",
        description: `يجب أن يكون المبلغ بين $${MIN_AMOUNT} و $${MAX_AMOUNT}`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('polar-create-checkout', {
        body: { amount: selectedAmount },
      });

      if (error) throw error;
      if (!data?.url) throw new Error("لم يتم إنشاء جلسة الدفع");

      sessionStorage.setItem('donation_initiated', 'true');

      // Open inside our custom in-site dialog (embedded iframe)
      const url = new URL(data.url);
      url.searchParams.set('embed', 'true');
      url.searchParams.set('theme', 'light');
      setCheckoutUrl(url.toString());
    } catch (err: any) {
      console.error('Donation error:', err);
      toast({
        title: "خطأ في إنشاء التبرع",
        description: err?.message || "حدث خطأ، يرجى المحاولة مرة أخرى",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SEOHead
        title="ادعم مكتبتنا الرقمية - تبرع لمنصة كتبي"
        description="ساعدنا في الحفاظ على مكتبة الكتب المجانية وتوفير المحتوى التعليمي للجميع. تبرع الآن لدعم منصة كتبي المجانية بدون إعلانات مزعجة."
        keywords="تبرع, دعم, مكتبة رقمية, كتب مجانية, منصة كتبي, تبرعات, مساعدة, محتوى تعليمي, مكتبة عربية"
        canonical="https://kotobi.xyz/donation"
        ogType="website"
        ogImage="/lovable-uploads/b1cd70fc-5c3b-47ac-ba45-cc3236f7c840.png"
      />
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto px-4 py-8 max-w-4xl"
           style={{ 
             fontFamily: 'Tajawal, sans-serif',
             fontWeight: '400',
             fontSize: '18px',
             lineHeight: '1.7'
           }}>
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center items-center gap-3 mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Heart className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl font-black bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent"
                style={{ 
                  fontFamily: 'Tajawal, sans-serif',
                  fontWeight: '400',
                  fontSize: 'clamp(28px, 5vw, 36px)'
                }}>
              ادعم مكتبتنا الرقمية
            </h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto"
             style={{ 
               fontFamily: 'Tajawal, sans-serif',
               fontWeight: '400',
               fontSize: '20px',
               lineHeight: '1.8'
             }}>
            ساعدنا في الحفاظ على مكتبة الكتب المجانية وتوفير المحتوى التعليمي للجميع
          </p>
          
          {/* No Ads Message */}
          <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border">
            <div className="text-center">
              <h3 className="text-lg font-bold text-foreground mb-2"
                  style={{ 
                    fontFamily: 'Tajawal, sans-serif',
                    fontWeight: '400',
                    fontSize: '18px'
                  }}>
                📱 موقع بدون إعلانات مزعجة
              </h3>
              <p className="text-sm text-muted-foreground"
                 style={{ 
                   fontFamily: 'Tajawal, sans-serif',
                   fontWeight: '400',
                   fontSize: '15px',
                   lineHeight: '1.6'
                 }}>
                نحن نرفض وضع الإعلانات المزعجة في موقعنا لتوفير تجربة قراءة مريحة وممتعة للجميع.<br/>
                بدلاً من ذلك، نعتمد على تبرعاتكم الكريمة للحفاظ على الخدمة مجانية ونظيفة.
              </p>
            </div>
          </div>

          {/* Donation Examples */}
          <div className="mt-4 p-4 bg-accent/50 rounded-lg border border-border">
            <div className="text-center">
              <h3 className="text-lg font-bold text-foreground mb-3"
                  style={{ 
                    fontFamily: 'Tajawal, sans-serif',
                    fontWeight: '400',
                    fontSize: '18px'
                  }}>
                ✨ ساعدنا في بناء شيء رائع
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="text-center p-3 bg-card/50 rounded-lg border border-border">
                  <div className="text-3xl mb-2">🌱</div>
                  <p className="text-sm text-foreground font-bold">
                    ازرع بذرة المعرفة
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    كل تبرع صغير يساعد في نمو المكتبة
                  </p>
                </div>
                <div className="text-center p-3 bg-card/50 rounded-lg border border-border">
                  <div className="text-3xl mb-2">🚀</div>
                  <p className="text-sm text-foreground font-bold">
                    انطلق معنا للمستقبل
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    استثمر في مشروع تعليمي يخدم الجميع
                  </p>
                </div>
                <div className="text-center p-3 bg-card/50 rounded-lg border border-border">
                  <div className="text-3xl mb-2">💎</div>
                  <p className="text-sm text-foreground font-bold">
                    كن جزءاً من القصة
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    ساهم في بناء مكتبة رقمية للأجيال القادمة
                  </p>
                </div>
              </div>
              <div className="mt-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-sm text-center text-foreground font-bold"
                   style={{ 
                     fontFamily: 'Tajawal, sans-serif',
                     fontWeight: '400',
                     fontSize: '14px',
                     lineHeight: '1.6'
                   }}>
                  🌟 كل دولار تتبرع به اليوم سيعود عليك بالمعرفة والفائدة مضاعفة غداً
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Donation Options */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"
                       style={{ 
                         fontFamily: 'Tajawal, sans-serif',
                         fontWeight: '400',
                         fontSize: '22px'
                       }}>
              <Gift className="h-5 w-5" />
              تبرع لدعم المكتبة
            </CardTitle>
            <CardDescription style={{ 
                               fontFamily: 'Tajawal, sans-serif',
                               fontWeight: '400',
                               fontSize: '16px'
                             }}>
              كل مساهمة تساعد في الحفاظ على الخدمة مجانية للجميع
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Polar Checkout Button */}
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-secondary/10 to-primary/10 p-6 rounded-lg border border-secondary/20">
                <div className="flex flex-col items-center space-y-4">
                  <div className="flex items-center gap-2">
                    <Heart className="h-5 w-5 text-primary" />
                    <span className="font-bold text-foreground" 
                          style={{ 
                            fontFamily: 'Tajawal, sans-serif',
                            fontWeight: '400',
                            fontSize: '16px'
                          }}>
                      تبرع بالمبلغ الذي تراه مناسباً
                    </span>
                  </div>
                  
                  {/* Amount selector */}
                  <div className="w-full">
                    <p className="text-sm text-foreground font-bold mb-2 text-center"
                       style={{ fontFamily: 'Tajawal, sans-serif', fontSize: '14px' }}>
                      أمثلة على مبالغ التبرع (USD)
                    </p>
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {PRESET_AMOUNTS.map((amt) => (
                        <Button
                          key={amt}
                          type="button"
                          variant={selectedAmount === amt ? "default" : "outline"}
                          onClick={() => setSelectedAmount(amt)}
                          className="font-bold"
                        >
                          ${amt}
                        </Button>
                      ))}
                    </div>
                    <input
                      type="number"
                      min={MIN_AMOUNT}
                      max={MAX_AMOUNT}
                      step="1"
                      value={selectedAmount}
                      onChange={(e) => setSelectedAmount(Math.max(MIN_AMOUNT, Number(e.target.value) || MIN_AMOUNT))}
                      className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-center font-bold"
                      placeholder="أدخل مبلغاً مخصصاً"
                    />
                  </div>

                  {!checkoutUrl && (
                    <>
                      <Button
                        onClick={handleDonate}
                        disabled={loading}
                        className="w-full font-bold text-lg py-6 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                      >
                        {loading ? (
                          <Loader2 className="h-5 w-5 ml-2 animate-spin" />
                        ) : (
                          <Heart className="h-5 w-5 ml-2" />
                        )}
                        {loading ? "جاري التحضير..." : `تبرع بـ $${selectedAmount} الآن`}
                      </Button>
                      <p className="text-xs text-center text-muted-foreground"
                         style={{ fontFamily: 'Tajawal, sans-serif', fontWeight: '400', fontSize: '13px' }}>
                        سيظهر نموذج الدفع الآمن أسفل الزر داخل الموقع
                      </p>
                    </>
                  )}
                </div>

                {/* Inline embedded Polar checkout (no popup) */}
                {checkoutUrl && (
                  <div className="mt-6 rounded-xl overflow-hidden border-2 border-primary/30 bg-white shadow-lg">
                    <div className="bg-gradient-to-r from-primary to-secondary p-4 text-primary-foreground flex items-center gap-3">
                      <div className="p-2 bg-white/20 rounded-full">
                        <Heart className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-base">إتمام التبرع</h3>
                        <div className="flex items-center gap-3 text-xs opacity-90 mt-1">
                          <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> دفع مشفّر</span>
                          <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> آمن</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setCheckoutUrl(null)}
                        className="p-2 hover:bg-white/20 rounded-full transition-colors"
                        aria-label="إلغاء"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    <iframe
                      src={checkoutUrl}
                      title="Polar Checkout"
                      className="w-full bg-white"
                      style={{ height: '720px', border: 'none', display: 'block' }}
                      allow="payment *"
                    />
                    <div className="p-3 bg-muted/50 text-center text-xs text-muted-foreground border-t border-border">
                      الدفع بواسطة Polar — منصة دفع موثوقة عالمياً
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>


        {/* Why Donate Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"
                       style={{ 
                         fontFamily: 'Tajawal, sans-serif',
                         fontWeight: '400',
                         fontSize: '22px'
                       }}>
              <Database className="h-5 w-5" />
              لماذا نحتاج التبرعات؟
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                    <Database className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 style={{ 
                         fontFamily: 'Tajawal, sans-serif',
                         fontWeight: '400',
                         fontSize: '18px'
                       }}>تخزين قاعدة البيانات</h3>
                    <p className="text-sm text-muted-foreground"
                       style={{ 
                         fontFamily: 'Tajawal, sans-serif',
                         fontWeight: '400',
                         fontSize: '15px'
                       }}>
                      تكلفة استضافة وتخزين آلاف الكتب والملفات
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                    <Target className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h3 style={{ 
                         fontFamily: 'Tajawal, sans-serif',
                         fontWeight: '400',
                         fontSize: '18px'
                       }}>تحديثات وتحسينات</h3>
                    <p className="text-sm text-muted-foreground"
                       style={{ 
                         fontFamily: 'Tajawal, sans-serif',
                         fontWeight: '400',
                         fontSize: '15px'
                       }}>
                      تطوير الموقع وإضافة مميزات جديدة
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Where does the money go */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"
                       style={{
                         fontFamily: 'Tajawal, sans-serif',
                         fontWeight: '400',
                         fontSize: '22px'
                       }}>
              <Target className="h-5 w-5" />
              أين تذهب أموال التبرع؟
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground leading-relaxed"
               style={{
                 fontFamily: 'Tajawal, sans-serif',
                 fontWeight: '400',
                 fontSize: '17px',
                 lineHeight: '1.9'
               }}>
              يتم صرف أموال التبرع على إيجارات خوادم الموقع والخدمات السحابية وخدمات الشبكات
              <strong> CDN </strong> وخدمات الأمن السيبراني ومرتبات مطوّري الموقع ومسؤولي
              الخوادم ومراجعي المحتوى وحقوق النشر.
            </p>

            <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center p-3 bg-primary/5 rounded-lg border border-primary/20">
                <div className="text-2xl font-black text-primary" dir="ltr">26,600+</div>
                <p className="text-xs text-muted-foreground mt-1">عنوان كتاب</p>
              </div>
              <div className="text-center p-3 bg-primary/5 rounded-lg border border-primary/20">
                <div className="text-2xl font-black text-primary" dir="ltr">9,190+</div>
                <p className="text-xs text-muted-foreground mt-1">مؤلف وكاتب</p>
              </div>
              <div className="text-center p-3 bg-primary/5 rounded-lg border border-primary/20">
                <div className="text-2xl font-black text-primary" dir="ltr">28</div>
                <p className="text-xs text-muted-foreground mt-1">تصنيف وفئة</p>
              </div>
              <div className="text-center p-3 bg-primary/5 rounded-lg border border-primary/20">
                <div className="text-2xl font-black text-primary" dir="ltr">970+</div>
                <p className="text-xs text-muted-foreground mt-1">اقتباس ومراجعة من القرّاء</p>
              </div>
            </div>

            <p className="text-foreground leading-relaxed mt-5"
               style={{
                 fontFamily: 'Tajawal, sans-serif',
                 fontWeight: '400',
                 fontSize: '17px',
                 lineHeight: '1.9'
               }}>
              هذا تحدٍّ كبير، فالأمر يحتاج إلى أجهزة بعتاد قوي وشبكات بباقات ضخمة وهي
              مكلفة للغاية. ومع ذلك، <strong>لا يتم دفع أي أموال لناشري ومؤلفي الكتب حتى الآن</strong>،
              ولا يزال وسيستمر النشر في منصة كتبي <strong>مجانياً وغير محدود</strong> بإذن الله.
            </p>
          </CardContent>
        </Card>

        {/* Thank You Message */}
        <div className="text-center p-6 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg border border-primary/20 mb-20">
          <Heart className="h-8 w-8 text-primary mx-auto mb-3" />
          <h3 className="text-xl font-bold mb-2"
              style={{ 
                fontFamily: 'Tajawal, sans-serif',
                fontWeight: '400',
                fontSize: '24px'
              }}>شكراً لدعمك</h3>
          <p className="text-muted-foreground"
             style={{ 
               fontFamily: 'Tajawal, sans-serif',
               fontWeight: '400',
               fontSize: '17px'
             }}>
            كل تبرع يساعد في بناء مجتمع تعليمي أفضل ومحتوى مجاني للجميع
          </p>
        </div>
      </div>
    </div>
    </>

  );
};

export default Donation;
