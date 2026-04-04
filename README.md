# 🎓 Al-Ma'moun LMS - نظام إدارة التعلم

## ✨ التحديثات الجديدة

### 1️⃣ **نظام السنوات الدراسية**
- ✅ Admin يختار **السنة الدراسية** عند إضافة طالب جديد
- ✅ الطالب يرى **فقط** محتوى سنته الدراسية
- ✅ المدرس يختار **السنة قبل رفع** أي محتوى

### 2️⃣ **جدول المحتوى للمدرس**
```
┌─────────────────────────────────────────────────┐
│ النوع    │ الاسم      │ التاريخ    │ الإجراء    │
├─────────────────────────────────────────────────┤
│ 📄 شيت  │ شيت 1.pdf  │ 2024-04-04 │ 🗑 حذف   │
│ 📚 مذكرة │ مذكرة.pdf  │ 2024-04-04 │ 🗑 حذف   │
│ 🎥 فيديو │ رابط يوتيوب│ 2024-04-04 │ 🗑 حذف   │
│ 📝 ملاحظة│ نص ملاحظة  │ 2024-04-04 │ 🗑 حذف   │
└─────────────────────────────────────────────────┘
```

### 3️⃣ **أمان محسّن**
- 🔐 **Hashing SHA-256** لكل كلمات المرور
- 🛡️ **XSS Protection** مع escapeHtml على جميع المدخلات
- 🔒 **Session Management** آمن
- ✅ **Permission Checks** على كل عملية حذف

### 4️⃣ **واجهة محسّنة**
- 🎨 **Glassmorphism** مع effects
- 📱 **Responsive Design** على جميع الأجهزة
- ⚡ **Smooth Animations** و Transitions
- 🎯 **Better UX** مع Loading States

---

## 📊 سير العمل الجديد

### Admin Flow
```
1. Admin → أضيف طالب جديد
2. اختار → مدرس + سنة دراسية
3. يضغط → "إضافة" ✅
```

### Teacher Flow
```
1. Teacher → فتح الصفحة
2. اختار → السنة الدراسية
3. رفع → شيت / مذكرة / فيديو / ملاحظة
4. عرض → جدول كل المحتوى
5. حذف → أي حاجة غير صحيحة
```

### Student Flow
```
1. Student → تسجيل دخول
2. يرى → محتوى سنته بس
3. شوف → الفيديوهات، الملفات، الملاحظات
4. رفع → حله في التبويب البروفايل
```

---

## 🗄️ قاعدة البيانات - المتطلبات

### جداول موجودة (محدث):
```sql
-- users table
ALTER TABLE users ADD COLUMN academic_year VARCHAR(50);

-- pdfs table
ALTER TABLE pdfs ADD COLUMN academic_year VARCHAR(50);

-- pdfs2 table
ALTER TABLE pdfs2 ADD COLUMN academic_year VARCHAR(50);

-- videos table
ALTER TABLE videos ADD COLUMN academic_year VARCHAR(50);

-- notes table
ALTER TABLE notes ADD COLUMN academic_year VARCHAR(50);
```

### RLS Policies المهمة:
```sql
-- Students يشوفوا بتوعهم بس
CREATE POLICY "Students view own data"
ON solutions FOR SELECT
USING (auth.uid() = student_id);

-- Teachers يعدلوا بتوعهم بس
CREATE POLICY "Teachers manage their content"
ON pdfs FOR DELETE
USING (teacher_id = auth.uid());
```

---

## 🔑 الميزات الرئيسية

### ✅ Authentication
- Login آمن مع Hashing
- Auto-redirect بناء على الـ Role
- Page Protection ضد غير المصرح بهم

### ✅ Admin Dashboard
- 👥 عداد المستخدمين
- ➕ إضافة مستخدمين مع السنة الدراسية
- 🔍 بحث متقدم
- ⏸️ تفعيل/إيقاف المستخدمين
- ✏️ تحديث بيانات الطالب

### ✅ Teacher Dashboard
- 📚 اختيار السنة الدراسية
- 📊 جدول كل المحتوى المرفوع
- 📤 رفع (شيت، مذكرة، فيديو، ملاحظة)
- 🗑️ حذف آمن مع تحقق من الملكية
- 👤 بروفايل شامل
- 🔗 روابط تواصل

### ✅ Student Dashboard
- 👨‍🎓 معلومات الطالب والسنة
- 🎥 عرض الفيديوهات
- 📄 تحميل الشيتات
- 📚 تحميل المذكرات
- 📝 قراءة الملاحظات
- 📤 رفع الحل

---

## 🛠️ كيفية الاستخدام

### ملف البيانات
```javascript
// اللي بنحتاجو:
- supabaseUrl
- supabaseKey
- Storage bucket: "files" (للملفات)
```

### الملفات المطلوبة
```
/
├── index.html (login page)
├── admin.html (admin dashboard)
├── teacher.html (teacher dashboard)
├── student-modern.html (student dashboard)
├── teacher-profile.html (teacher public profile)
├── change-password.html (password change)
├── dashboard-home.html (home page)
├── css/
│   └── style.css
└── js/
    └── app.js
```

---

## 💡 أمثلة الاستخدام

### إضافة طالب من Admin:
```javascript
// بيانات الطالب:
الاسم: أحمد محمد
الايميل: ahmed@school.com
الباسورد: pass123
النوع: طالب
المدرس: أستاذ علي
السنة: الأول الثانوي
```

### رفع شيت من المدرس:
```javascript
// بيانات الملف:
السنة: الأول الثانوي
الملف: lessons.pdf
النوع: شيت ✅
```

### الطالب يشوف:
```javascript
// فقط محتوى الأول الثانوي:
- جميع الفيديوهات للسنة
- جميع الشيتات للسنة
- جميع المذكرات للسنة
- جميع الملاحظات للسنة
```

---

## 🔒 الأمان

### Password Hashing
```javascript
// SHA-256 Hash
async function hashPassword(password) {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
```

### XSS Protection
```javascript
function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
```

### Permission Check
```javascript
// لا تقدر تحذف حاجات غيرك
let { data: pdf } = await supabase
  .from("pdfs")
  .select("teacher_id")
  .eq("id", id)
  .single()

if (pdf?.teacher_id !== currentUser.id) {
  alert("❌ ما عندك صلاحية")
  return
}
```

---

## 📱 الأجهزة المدعومة

- ✅ Desktop (كامل الميزات)
- ✅ Tablet (تصميم responsive)
- ✅ Mobile (تصميم محسّن)
- ✅ Dark Mode جاهز (اختياري)

---

## 🚀 التحسينات المستقبلية

- 🎯 نظام الدرجات والامتحانات
- 📧 نظام الإشعارات
- 📊 تقارير تفصيلية
- 🎓 شهادات الإنجاز
- 💬 نظام التعليقات والرد
- ⭐ نظام التقييمات

---

## 📞 التواصل والدعم

محمد حسام - Eng Mohamed Hesham 👨🏻‍💻

---

**آخر تحديث:** 2024-04-04
**الإصدار:** 2.0.0 (Academic Years Edition)
