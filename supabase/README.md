# تشغيل قاعدة البيانات الجديدة

1. أنشئ مشروع Supabase جديد. انسخ Project URL وPublishable/anon key إلى `js/config.js`.
2. في SQL Editor شغّل `schema.sql` كاملًا.
3. إذا اخترت المشروع القديم بدل مشروع جديد: خذ Backup ثم شغّل `reset-legacy.sql`، وبعده `schema.sql`.
4. من الموقع أنشئ حسابين عبر `register.html`: واحد للمدرس وواحد للطالب، ثم أنشئ حساب ثالث للأدمن.
5. في SQL Editor نفّذ:

```sql
select id, full_name from public.profiles;
update public.profiles set role = 'admin' where id = 'ADMIN_UUID';
update public.profiles set role = 'teacher' where id = 'TEACHER_UUID';
```

6. بدّل `TEACHER_UUID` و`STUDENT_UUID` داخل `seed-demo.sql` بالقيم الحقيقية، ثم شغّله لإضافة كورس وشيت ومذكرة وحصة واختبار واشتراك تجريبي.

لا يوجد أي استخدام للجداول القديمة `users` أو `playlists`. كلمات المرور تدار فقط بواسطة Supabase Auth.
