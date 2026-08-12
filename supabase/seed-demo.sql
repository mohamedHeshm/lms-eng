-- Run after schema.sql and AFTER registering two accounts through the website.
-- Replace the UUIDs with values from: select id, full_name from public.profiles;
-- Then change the teacher role once:
-- update public.profiles set role='teacher' where id='TEACHER_UUID';
do $$
declare teacher uuid := 'TEACHER_UUID'; student uuid := 'STUDENT_UUID'; course_id uuid; module_id uuid; quiz_id uuid;
begin
  insert into public.courses(teacher_id,title,slug,subject,target_stages,description,price,is_published,requires_monthly_subscription) values(teacher,'مراجعة الفيزياء — الصف الثالث الثانوي','physics-grade-3','فيزياء',array['الثالثة الثانوية'],'شرح ومراجعة منظمة مع اختبارات قصيرة.',250,true,true) returning id into course_id;
  insert into public.course_modules(course_id,title,position) values(course_id,'الوحدة الأولى',1) returning id into module_id;
  insert into public.lessons(module_id,title,description,position,video_url,is_preview) values(module_id,'مقدمة الحركة','درس تمهيدي مجاني.',1,'https://www.youtube.com/embed/9vJRopau0g0',true);
  insert into public.content_items(teacher_id,title,kind,stage,file_url) values(teacher,'شيت مراجعة الحركة','worksheet','الثالثة الثانوية','https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'),(teacher,'صورة السبورة — الحركة','board','الثالثة الثانوية','https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'),(teacher,'مذكرة الوحدة الأولى','note','الثالثة الثانوية','https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf');
  insert into public.quizzes(teacher_id,title,stage,course_id,is_published) values(teacher,'اختبار الحركة الأول','الثالثة الثانوية',course_id,true) returning id into quiz_id;
  insert into public.quiz_questions(quiz_id,question,options,correct_option,position) values(quiz_id,'ما وحدة قياس السرعة؟','["متر/ثانية","كيلوجرام","نيوتن","جول"]'::jsonb,0,1);
  insert into public.enrollments(student_id,course_id) values(student,course_id);
  insert into public.monthly_subscriptions(student_id,teacher_id,starts_at,ends_at) values(student,teacher,now(),now()+interval '30 days');
  insert into public.live_sessions(course_id,teacher_id,title,stage,starts_at,meeting_url) values(course_id,teacher,'مراجعة مباشرة: الحركة','الثالثة الثانوية',now()+interval '2 days','https://meet.google.com/');
end $$;
