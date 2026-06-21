# ميزة "اكتب كتابك" (مثل Wattpad)

## نظرة عامة
قسم جديد يمكّن المستخدمين من كتابة كتبهم مباشرة داخل المنصة، فصلاً بعد فصل، مع حفظ تلقائي، ومسودات، ونشر للقراء، وإمكانية القراءة والتعليق.

## كيف تعمل في Wattpad (للمرجع)
- المستخدم ينشئ "قصة" (Story) بعنوان وغلاف وتصنيف ووصف.
- يضيف "فصولاً" (Parts/Chapters) داخل القصة، لكل فصل عنوان ومحتوى نصي.
- لكل فصل حالتان: مسودة (Draft) أو منشور (Published).
- القراء يقرؤون الفصول المنشورة، يعلقون، ويصوّتون.
- المؤلف يستطيع التعديل والإضافة في أي وقت.

## التطبيق في المنصة

### 1) قاعدة البيانات (Supabase)
جدولان جديدان + RLS + GRANTs:

**`user_stories`** — القصة/الكتاب الذي يكتبه المستخدم
- `id` (uuid)، `author_id` (uuid → auth.users)
- `title`، `description`، `cover_url`، `category`، `language`
- `status` (`draft` | `ongoing` | `completed`)
- `is_public` (bool — هل تظهر للقراء)
- `views_count`، `likes_count`
- `created_at`، `updated_at`

**`story_chapters`** — فصول القصة
- `id` (uuid)، `story_id` (uuid → user_stories ON DELETE CASCADE)
- `chapter_number` (int)، `title`، `content` (text — محتوى الفصل، يدعم نص طويل)
- `is_published` (bool)، `published_at`
- `word_count`، `views_count`
- `created_at`، `updated_at`

سياسات RLS:
- المؤلف: قراءة/كتابة/حذف قصصه وفصوله.
- الجميع (anon + authenticated): قراءة القصص حيث `is_public = true` والفصول حيث `is_published = true`.

### 2) الواجهة الأمامية

**صفحات جديدة:**
- `/write` — لوحة الكاتب: قائمة قصصه + زر "قصة جديدة".
- `/write/:storyId` — تحرير القصة (المعلومات + قائمة الفصول + إضافة فصل).
- `/write/:storyId/chapter/:chapterId` — محرر الفصل (Textarea كبيرة + حفظ تلقائي + زر نشر).
- `/story/:storyId` — صفحة عامة لعرض القصة وقائمة فصولها المنشورة.
- `/story/:storyId/chapter/:chapterNumber` — قراءة الفصل.

**مكونات:**
- `StoryEditor` — نموذج بيانات القصة (عنوان، وصف، غلاف عبر Storage، تصنيف).
- `ChapterEditor` — محرر النص مع حفظ تلقائي كل 5 ثوانٍ (debounce) وعدّاد كلمات.
- `ChaptersList` — قائمة فصول قابلة لإعادة الترتيب.
- `StoryReader` — واجهة قراءة بسيطة ومريحة (خط Tajawal، عرض مناسب، تنقل بين الفصول).

**روابط التنقل:**
- إضافة رابط "اكتب كتابك" في `Navbar` و `BottomNavigation` (للمستخدمين المسجلين).

### 3) Storage
استخدام bucket موجود `book-covers` (أو إنشاء `story-covers` إن لزم) لأغلفة القصص.

## ملاحظات
- ميزة منفصلة تماماً عن "رفع كتاب PDF" الحالي؛ هذه للكتابة داخل الموقع.
- لاحقاً يمكن إضافة: تعليقات على الفصول، تصويتات، إشعارات للمتابعين عند نشر فصل جديد.

هل تريد أن أبدأ التنفيذ الآن بهذا الشكل؟
