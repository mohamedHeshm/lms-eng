// ================== إعداد Supabase ==================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = "https://dfxkuppxywldxsbyzfzo.supabase.co"
const supabaseKey = "sb_publishable_B3xVoCtEJtpStm76kM5KDw_WZgPsJXN"

const supabase = createClient(supabaseUrl, supabaseKey)

// ================== Helper Functions ==================
function escapeHtml(text) {
  if (!text) return ''
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function getCurrentUser() {
  try {
    const userJson = localStorage.getItem("currentUser")
    return userJson ? JSON.parse(userJson) : null
  } catch (e) {
    console.error("Error parsing user:", e)
    return null
  }
}

function showStatus(message, type = 'info') {
  const status = document.getElementById("loginStatus")
  if (status) {
    status.innerText = message
    status.style.color = type === 'error' ? '#ff4d4d' : type === 'success' ? '#25d366' : '#4facfe'
  }
}

// ================== تأمين الصفحات ==================
function protectPage() {
  const currentUser = getCurrentUser()
  const currentPage = window.location.pathname.split('/').pop() || 'index.html'

  // الصفحات المحمية
  const protectedPages = ['student-modern.html', 'teacher.html', 'admin.html', 'teacher-profile.html', 'dashboard-home.html', 'grades-management.html', 'student-grades.html', 'attendance-management.html']

  // إذا كان على صفحة محمية وما في user مسجل دخول
  if (protectedPages.includes(currentPage) && !currentUser) {
    alert('❌ يجب تسجيل الدخول أولاً')
    window.location.href = 'index.html'
    return false
  }

  // تحقق من الصفحة المناسبة للدور
  if (currentUser) {
    if (currentPage === 'admin.html' && currentUser.role !== 'admin') {
      alert('❌ صفحة الأدمن حصرية للأدمن')
      window.location.href = 'index.html'
      return false
    }
    if (currentPage === 'teacher.html' && currentUser.role !== 'teacher') {
      alert('❌ صفحة المدرس حصرية للمدرسين')
      window.location.href = 'index.html'
      return false
    }
    if (currentPage === 'student-modern.html' && currentUser.role !== 'student') {
      alert('❌ صفحة الطالب حصرية للطلاب')
      window.location.href = 'index.html'
      return false
    }
    if ((currentPage === 'grades-management.html' || currentPage === 'attendance-management.html') && currentUser.role !== 'teacher') {
      alert('❌ هذه الصفحة حصرية للمدرسين')
      window.location.href = 'index.html'
      return false
    }
    if (currentPage === 'student-grades.html' && currentUser.role !== 'student') {
      alert('❌ صفحة الدرجات حصرية للطلاب')
      window.location.href = 'index.html'
      return false
    }
  }

  return true
}

// ================== تسجيل دخول ==================
window.login = async function() {
  try {
    let email = document.getElementById("email")?.value.trim()
    let pass = document.getElementById("password")?.value.trim()
    let status = document.getElementById("loginStatus")

    if (!email || !pass) {
      showStatus("❌ يجب ملء جميع الحقول", 'error')
      return false
    }

    if (!email.includes('@')) {
      showStatus("❌ الايميل غير صحيح", 'error')
      return false
    }

    showStatus("⏳ جاري التحقق...", 'info')

    let { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .eq("password", pass)
      .single()

    if (error || !data) {
      showStatus("❌ بيانات دخول خاطئة", 'error')
      return false
    }

    if (data.is_active === false) {
      showStatus("🚫 حسابك موقوف", 'error')
      return false
    }

    localStorage.setItem("currentUser", JSON.stringify(data))

    // حفظ سجل الدخول (مع تتبع الأخطاء)
    try {
      const { error: logError } = await supabase.from("login_logs").insert([
        {
          user_id: data.id,
          user_name: data.name,
          user_email: data.email,
          user_role: data.role,
          login_time: new Date().toISOString()
        }
      ])
      if (logError) {
        console.error("⚠️ فشل تسجيل السجل:", logError.message, logError)
      } else {
        console.log("✅ تم تسجيل دخول المستخدم في login_logs")
      }
    } catch (logEx) {
      console.error("⚠️ Exception أثناء تسجيل السجل:", logEx)
    }

    showStatus("✅ تم! جاري التوجيه...", 'success')

    setTimeout(() => {
      if (data.role === "admin") location.href = "admin.html"
      else if (data.role === "teacher") location.href = "teacher.html"
      else if (data.role === "student") location.href = "student-modern.html"
    }, 500)

    return true

  } catch (error) {
    console.error("Login error:", error)
    showStatus("❌ خطأ في الاتصال", 'error')
    return false
  }
}

// ================== الرجوع للرئيسية ==================
window.goHome = function() {
  window.location.href = 'index.html'
}

// ================== Admin - إضافة مستخدم ==================
window.addUser = async function() {
  try {
    let name = document.getElementById("name")?.value.trim()
    let email = document.getElementById("userEmail")?.value.trim()
    let pass = document.getElementById("userPass")?.value.trim()
    let role = document.getElementById("role")?.value
    let teacherId = document.getElementById("teacherSelect")?.value
    let stage = document.getElementById("stageSelect")?.value

    if (!name || !email || !pass) {
      alert("❗ اكتب كل البيانات")
      return
    }

    if (!email.includes('@')) {
      alert("❌ الايميل غير صحيح")
      return
    }

    if (role === "student" && !stage) {
      alert("❌ يجب اختيار المرحلة الدراسية للطالب")
      return
    }

    // شيك البريد موجود؟
    let { data: exists } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)

    if (exists && exists.length > 0) {
      alert("⚠️ الايميل موجود بالفعل")
      return
    }

    // إضافة
    let { error } = await supabase.from("users").insert([
      {
        name,
        email,
        password: pass,
        role,
        teacher_id: role === "student" ? teacherId : null,
        stage: role === "student" ? stage : null,
        is_active: true
      }
    ])

    if (error) {
      alert("❌ حصل خطأ: " + error.message)
      return
    }

    alert("✅ تم إضافة المستخدم")
    document.getElementById("name").value = ""
    document.getElementById("userEmail").value = ""
    document.getElementById("userPass").value = ""
    document.getElementById("stageSelect").value = ""

    loadUsers()
    loadStats()

  } catch (error) {
    console.error("Error:", error)
    alert("❌ خطأ: " + error.message)
  }
}

window.togglePass = function() {
  let input = document.getElementById("userPass")
  if (input.type === "password") {
    input.type = "text"
  } else {
    input.type = "password"
  }
}

// ================== نظام الدرجات والحضور ==================

// دالة إضافة درجة للطالب
window.addGradeToStudent = async function(studentId, studentName, gradeType) {
  try {
    const currentUser = getCurrentUser()
    if (!currentUser || currentUser.role !== 'teacher') {
      alert('❌ يجب أن تكون مدرساً')
      return
    }

    const gradeValue = prompt(`أدخل درجة ${gradeType === 'exam' ? 'الامتحان' : 'المشاركة'} للطالب ${studentName}:`)
    if (gradeValue === null) return

    const grade = parseFloat(gradeValue)
    if (isNaN(grade) || grade < 0) {
      alert('❌ أدخل قيمة رقمية صحيحة')
      return
    }

    const { data, error } = await supabase.from("student_grades").insert([
      {
        student_id: studentId,
        teacher_id: currentUser.id,
        grade_type: gradeType,
        grade_value: grade,
        date_added: new Date().toISOString()
      }
    ])

    if (error) {
      alert(`❌ خطأ: ${error.message}`)
      return
    }

    alert(`✅ تمت إضافة الدرجة بنجاح`)

    // تحديث الشاشة
    if (window.loadStudentsGrades) {
      loadStudentsGrades()
    }

    // التحقق من الحد الأدنى وإرسال رسالة إنذار
    checkGradeThreshold(studentId, studentName, grade, gradeType)

  } catch (error) {
    console.error("Error:", error)
    alert(`❌ خطأ: ${error.message}`)
  }
}

// دالة التحقق من الحد الأدنى للدرجات وإرسال تنبيه واتساب
window.checkGradeThreshold = async function(studentId, studentName, gradeValue, gradeType) {
  try {
    const currentUser = getCurrentUser()
    if (!currentUser) return

    // الحصول على بيانات الطالب والحدود التي حددها المدرس
    const { data: gradeSettings, error: settingsError } = await supabase
      .from("grade_settings")
      .select("*")
      .eq("teacher_id", currentUser.id)
      .single()

    if (settingsError || !gradeSettings) {
      console.log("لم يتم تحديد حدود الدرجات")
      return
    }

    // التحقق من الحد الأدنى
    const threshold = gradeType === 'exam' ? gradeSettings.exam_threshold : gradeSettings.participation_threshold

    if (gradeValue < threshold) {
      // الحصول على بيانات ولي الأمر
      const { data: student, error: studentError } = await supabase
        .from("users")
        .select("parent_phone, name")
        .eq("id", studentId)
        .single()

      if (!studentError && student && student.parent_phone) {
        // إرسال رسالة واتساب لولي الأمر
        sendWhatsAppNotification(
          student.parent_phone,
          studentName,
          gradeValue,
          threshold,
          gradeType,
          currentUser
        )
      }
    }

  } catch (error) {
    console.error("Error checking threshold:", error)
  }
}

// دالة إرسال رسالة واتساب تلقائية
window.sendWhatsAppNotification = async function(parentPhone, studentName, grade, threshold, gradeType, teacher) {
  try {
    const message = `تنبيه من مدرس ${teacher.name}:\n\nالطالب: ${studentName}\nالدرجة الحصول عليها: ${grade}\nالحد الأدنى المطلوب: ${threshold}\n\nنوع الاختبار: ${gradeType === 'exam' ? 'امتحان' : 'مشاركة'}\n\nيرجى زيادة اهتمام الطالب بالدراسة 📚`

    // إرسال عبر API (تأكد من تفعيل WhatsApp API في Supabase)
    const { error } = await supabase.from("whatsapp_messages").insert([
      {
        to_phone: parentPhone,
        message: message,
        teacher_id: teacher.id,
        student_id: null,
        sent_at: new Date().toISOString(),
        sent: false
      }
    ])

    if (error) {
      console.error("فشل إرسال الرسالة:", error)
    } else {
      console.log(`✅ تم إضافة الرسالة للإرسال للرقم ${parentPhone}`)
    }

  } catch (error) {
    console.error("Error sending WhatsApp:", error)
  }
}

// دالة إضافة غياب للطالب
window.addAttendance = async function(studentId, studentName, status = 'absent') {
  try {
    const currentUser = getCurrentUser()
    if (!currentUser || currentUser.role !== 'teacher') {
      alert('❌ يجب أن تكون مدرساً')
      return
    }

    const { data, error } = await supabase.from("attendance").insert([
      {
        student_id: studentId,
        teacher_id: currentUser.id,
        status: status, // 'present' أو 'absent' أو 'late'
        date: new Date().toISOString().split('T')[0],
        marked_at: new Date().toISOString()
      }
    ])

    if (error) {
      alert(`❌ خطأ: ${error.message}`)
      return
    }

    alert(`✅ تم تسجيل الحضور`)

    if (window.loadAttendance) {
      loadAttendance()
    }

  } catch (error) {
    console.error("Error:", error)
    alert(`❌ خطأ: ${error.message}`)
  }
}

// دالة تحميل درجات الطالب
window.loadStudentGrades = async function() {
  try {
    const currentUser = getCurrentUser()
    if (!currentUser) return

    const container = document.getElementById("studentGradesContainer")
    if (!container) return

    container.innerHTML = "⏳ جاري التحميل..."

    const { data: grades, error } = await supabase
      .from("student_grades")
      .select("*")
      .eq("student_id", currentUser.id)
      .order("date_added", { ascending: false })

    if (error) {
      container.innerHTML = `❌ خطأ: ${error.message}`
      return
    }

    if (!grades || grades.length === 0) {
      container.innerHTML = "📭 لا توجد درجات حتى الآن"
      return
    }

    // حساب المعدل
    const examGrades = grades.filter(g => g.grade_type === 'exam').map(g => g.grade_value)
    const participationGrades = grades.filter(g => g.grade_type === 'participation').map(g => g.grade_value)

    const examAvg = examGrades.length > 0 ? (examGrades.reduce((a, b) => a + b, 0) / examGrades.length).toFixed(2) : "لا يوجد"
    const participationAvg = participationGrades.length > 0 ? (participationGrades.reduce((a, b) => a + b, 0) / participationGrades.length).toFixed(2) : "لا يوجد"

    let html = `
      <div style="background:white; padding:20px; border-radius:15px; margin-bottom:20px; box-shadow:0 5px 15px rgba(0,0,0,0.1);">
        <h3 style="color:#667eea; margin-bottom:15px;">📊 ملخص الدرجات</h3>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
          <div style="background:linear-gradient(135deg, #667eea, #764ba2); color:white; padding:15px; border-radius:10px;">
            <p style="font-size:14px; opacity:0.9;">متوسط درجات الامتحانات</p>
            <h3 style="font-size:28px; margin-top:10px;">${examAvg}/100</h3>
          </div>
          <div style="background:linear-gradient(135deg, #25d366, #20c35a); color:white; padding:15px; border-radius:10px;">
            <p style="font-size:14px; opacity:0.9;">متوسط درجات المشاركة</p>
            <h3 style="font-size:28px; margin-top:10px;">${participationAvg}/100</h3>
          </div>
        </div>
      </div>

      <div style="background:white; padding:20px; border-radius:15px; box-shadow:0 5px 15px rgba(0,0,0,0.1);">
        <h3 style="color:#667eea; margin-bottom:15px;">📝 تفاصيل الدرجات</h3>
        ${grades.map(g => `
          <div style="background:#f8f9fa; padding:15px; margin-bottom:10px; border-radius:10px; border-right:4px solid ${g.grade_type === 'exam' ? '#667eea' : '#25d366'};">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <p style="color:#333; font-weight:600;">${g.grade_type === 'exam' ? '📝 امتحان' : '🎤 مشاركة'}</p>
                <p style="color:#999; font-size:12px;">التاريخ: ${new Date(g.date_added).toLocaleDateString('ar-EG')}</p>
              </div>
              <div style="text-align:center;">
                <h3 style="color:#667eea; font-size:24px;">${g.grade_value}</h3>
                <p style="color:#999; font-size:12px;">من 100</p>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `

    container.innerHTML = html

  } catch (error) {
    console.error("Error:", error)
    const container = document.getElementById("studentGradesContainer")
    if (container) container.innerHTML = `❌ خطأ: ${error.message}`
  }
}

// دالة تحميل درجات الطلاب (للمدرس)
window.loadStudentsGrades = async function() {
  try {
    const currentUser = getCurrentUser()
    if (!currentUser || currentUser.role !== 'teacher') return

    const container = document.getElementById("gradesContainer")
    if (!container) return

    container.innerHTML = "⏳ جاري التحميل..."

    // الحصول على طلاب المدرس
    const { data: students, error: studentsError } = await supabase
      .from("users")
      .select("id, name, parent_phone")
      .eq("teacher_id", currentUser.id)
      .eq("role", "student")

    if (studentsError || !students) {
      container.innerHTML = "❌ خطأ في تحميل الطلاب"
      return
    }

    if (students.length === 0) {
      container.innerHTML = "📭 لا توجد طلاب لديك بعد"
      return
    }

    // الحصول على درجات جميع الطلاب
    const { data: allGrades } = await supabase
      .from("student_grades")
      .select("*")
      .in("student_id", students.map(s => s.id))

    let html = '<div style="display:grid; gap:20px;">'

    students.forEach(student => {
      const studentGrades = (allGrades || []).filter(g => g.student_id === student.id)
      const avgGrade = studentGrades.length > 0
        ? (studentGrades.reduce((sum, g) => sum + g.grade_value, 0) / studentGrades.length).toFixed(2)
        : "بدون"

      html += `
        <div style="background:white; padding:20px; border-radius:15px; box-shadow:0 5px 15px rgba(0,0,0,0.1); border-right:5px solid #667eea;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <div>
              <h3 style="color:#667eea;">${escapeHtml(student.name)}</h3>
              <p style="color:#999; font-size:13px;">رقم ولي الأمر: ${student.parent_phone || 'لم يتم إضافة'}</p>
            </div>
            <div style="text-align:center;">
              <h3 style="color:#25d366; font-size:24px;">${avgGrade}</h3>
              <p style="font-size:12px; color:#999;">متوسط</p>
            </div>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button onclick="window.addGradeToStudent('${student.id}', '${escapeHtml(student.name)}', 'exam')" style="flex:1; padding:10px; background:#667eea; color:white; border:none; border-radius:8px; cursor:pointer; font-family:'Cairo',sans-serif;">📝 إضافة درجة امتحان</button>
            <button onclick="window.addGradeToStudent('${student.id}', '${escapeHtml(student.name)}', 'participation')" style="flex:1; padding:10px; background:#25d366; color:white; border:none; border-radius:8px; cursor:pointer; font-family:'Cairo',sans-serif;">🎤 إضافة درجة مشاركة</button>
          </div>
        </div>
      `
    })

    html += '</div>'
    container.innerHTML = html

  } catch (error) {
    console.error("Error:", error)
    const container = document.getElementById("gradesContainer")
    if (container) container.innerHTML = `❌ خطأ: ${error.message}`
  }
}

// دالة تحديث بيانات الطالب (الاسم والهاتف ورقم ولي الأمر)
window.updateStudentInfo = async function() {
  try {
    const currentUser = getCurrentUser()
    if (!currentUser || currentUser.role !== 'student') {
      alert('❌ هذا الخيار للطلاب فقط')
      return
    }

    const studentName = document.getElementById("studentInfoName")?.value.trim()
    const studentPhone = document.getElementById("studentPhone")?.value.trim()
    const parentPhone = document.getElementById("parentPhone")?.value.trim()

    if (!studentName || !studentPhone || !parentPhone) {
      alert('❌ يجب ملء جميع الحقول')
      return
    }

    // التحقق من صيغة الهاتف
    if (!/^[0-9]{10,}$/.test(studentPhone.replace(/[\s-]/g, ''))) {
      alert('❌ رقم الهاتف غير صحيح')
      return
    }

    if (!/^[0-9]{10,}$/.test(parentPhone.replace(/[\s-]/g, ''))) {
      alert('❌ رقم ولي الأمر غير صحيح')
      return
    }

    const { data, error } = await supabase
      .from("users")
      .update({
        name: studentName,
        student_phone: studentPhone,
        parent_phone: parentPhone
      })
      .eq("id", currentUser.id)
      .select()

    if (error) {
      alert(`❌ خطأ: ${error.message}`)
      return
    }

    // تحديث البيانات المخزنة محلياً
    currentUser.name = studentName
    currentUser.student_phone = studentPhone
    currentUser.parent_phone = parentPhone
    localStorage.setItem("currentUser", JSON.stringify(currentUser))

    alert('✅ تم تحديث البيانات بنجاح')

  } catch (error) {
    console.error("Error:", error)
    alert(`❌ خطأ: ${error.message}`)
  }
}

// دالة تحديث حدود الدرجات من قبل المدرس
window.updateGradeThreshold = async function() {
  try {
    const currentUser = getCurrentUser()
    if (!currentUser || currentUser.role !== 'teacher') {
      alert('❌ يجب أن تكون مدرساً')
      return
    }

    const examThreshold = document.getElementById("examThreshold")?.value
    const participationThreshold = document.getElementById("participationThreshold")?.value

    if (!examThreshold || !participationThreshold) {
      alert('❌ يجب ملء جميع الحقول')
      return
    }

    // التحقق من أن القيم أرقام
    if (isNaN(examThreshold) || isNaN(participationThreshold)) {
      alert('❌ يجب أن تكون القيم أرقام')
      return
    }

    // البحث عن الإعدادات الحالية
    const { data: existing } = await supabase
      .from("grade_settings")
      .select("id")
      .eq("teacher_id", currentUser.id)
      .single()

    let error
    if (existing) {
      // تحديث الإعدادات
      const result = await supabase
        .from("grade_settings")
        .update({
          exam_threshold: parseFloat(examThreshold),
          participation_threshold: parseFloat(participationThreshold),
          updated_at: new Date().toISOString()
        })
        .eq("id", existing.id)
      error = result.error
    } else {
      // إضافة إعدادات جديدة
      const result = await supabase
        .from("grade_settings")
        .insert([{
          teacher_id: currentUser.id,
          exam_threshold: parseFloat(examThreshold),
          participation_threshold: parseFloat(participationThreshold),
          created_at: new Date().toISOString()
        }])
      error = result.error
    }

    if (error) {
      alert(`❌ خطأ: ${error.message}`)
      return
    }

    alert('✅ تم تحديث الحدود بنجاح')

  } catch (error) {
    console.error("Error:", error)
    alert(`❌ خطأ: ${error.message}`)
  }
}

// دالة تحميل إعدادات الحدود
window.loadGradeThresholds = async function() {
  try {
    const currentUser = getCurrentUser()
    if (!currentUser || currentUser.role !== 'teacher') return

    const { data: settings } = await supabase
      .from("grade_settings")
      .select("*")
      .eq("teacher_id", currentUser.id)
      .single()

    if (settings) {
      const examInput = document.getElementById("examThreshold")
      const participationInput = document.getElementById("participationThreshold")

      if (examInput) examInput.value = settings.exam_threshold || ''
      if (participationInput) participationInput.value = settings.participation_threshold || ''
    }

  } catch (error) {
    console.error("Error loading thresholds:", error)
  }
}

// دالة تحميل بيانات الطالب
window.loadStudentInfo = async function() {
  try {
    const currentUser = getCurrentUser()
    if (!currentUser || currentUser.role !== 'student') return

    const { data: student } = await supabase
      .from("users")
      .select("*")
      .eq("id", currentUser.id)
      .single()

    if (student) {
      const nameInput = document.getElementById("studentInfoName")
      const phoneInput = document.getElementById("studentPhone")
      const parentPhoneInput = document.getElementById("parentPhone")

      if (nameInput) nameInput.value = student.name || ''
      if (phoneInput) phoneInput.value = student.student_phone || ''
      if (parentPhoneInput) parentPhoneInput.value = student.parent_phone || ''
    }

  } catch (error) {
    console.error("Error loading student info:", error)
  }
}

// دالة إضافة حساب واتساب للمدرس
window.updateTeacherWhatsApp = async function() {
  try {
    const currentUser = getCurrentUser()
    if (!currentUser || currentUser.role !== 'teacher') {
      alert('❌ يجب أن تكون مدرساً')
      return
    }

    const whatsappNumber = document.getElementById("whatsappNumber")?.value.trim()
    const whatsappToken = document.getElementById("whatsappToken")?.value.trim()

    if (!whatsappNumber || !whatsappToken) {
      alert('❌ يجب ملء رقم الواتساب والرمز')
      return
    }

    const { error } = await supabase
      .from("users")
      .update({
        whatsapp_number: whatsappNumber,
        whatsapp_token: whatsappToken
      })
      .eq("id", currentUser.id)

    if (error) {
      alert(`❌ خطأ: ${error.message}`)
      return
    }

    alert('✅ تم حفظ بيانات الواتساب بنجاح')

  } catch (error) {
    console.error("Error:", error)
    alert(`❌ خطأ: ${error.message}`)
  }
}

// دالة تحميل بيانات الواتساب
window.loadTeacherWhatsApp = async function() {
  try {
    const currentUser = getCurrentUser()
    if (!currentUser || currentUser.role !== 'teacher') return

    const { data: teacher } = await supabase
      .from("users")
      .select("whatsapp_number, whatsapp_token")
      .eq("id", currentUser.id)
      .single()

    if (teacher) {
      const numberInput = document.getElementById("whatsappNumber")
      const tokenInput = document.getElementById("whatsappToken")

      if (numberInput) numberInput.value = teacher.whatsapp_number || ''
      if (tokenInput) tokenInput.value = teacher.whatsapp_token || ''
    }

  } catch (error) {
    console.error("Error loading WhatsApp data:", error)
  }
}

// تحميل الحماية عند تحميل الصفحة
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', protectPage)
} else {
  protectPage()
}

// دالة تحميل إحصائيات الحضور
window.loadAttendanceStats = async function() {
  try {
    const currentUser = getCurrentUser()
    if (!currentUser) return

    const container = document.getElementById("attendanceStatsContainer")
    if (!container) return

    container.innerHTML = "⏳ جاري التحميل..."

    let query = supabase.from("attendance").select("*")

    if (currentUser.role === 'student') {
      query = query.eq("student_id", currentUser.id)
    } else if (currentUser.role === 'teacher') {
      query = query.eq("teacher_id", currentUser.id)
    }

    const { data: records, error } = await query

    if (error) {
      container.innerHTML = `❌ خطأ: ${error.message}`
      return
    }

    if (!records || records.length === 0) {
      container.innerHTML = "📭 لا توجد سجلات حضور بعد"
      return
    }

    const present = records.filter(r => r.status === 'present').length
    const absent = records.filter(r => r.status === 'absent').length
    const late = records.filter(r => r.status === 'late').length
    const total = records.length
    const percentage = ((present / total) * 100).toFixed(2)

    let html = `
      <div style="background:white; padding:20px; border-radius:15px; box-shadow:0 5px 15px rgba(0,0,0,0.1);">
        <h3 style="color:#667eea; margin-bottom:20px;">📊 إحصائيات الحضور</h3>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:15px; margin-bottom:20px;">
          <div style="background:linear-gradient(135deg, #25d366, #20c35a); color:white; padding:15px; border-radius:10px; text-align:center;">
            <h4 style="font-size:28px; margin:10px 0;">✅ ${present}</h4>
            <p>حاضر</p>
          </div>
          <div style="background:linear-gradient(135deg, #ff6b6b, #ff5252); color:white; padding:15px; border-radius:10px; text-align:center;">
            <h4 style="font-size:28px; margin:10px 0;">❌ ${absent}</h4>
            <p>غائب</p>
          </div>
          <div style="background:linear-gradient(135deg, #ffc107, #ffb300); color:white; padding:15px; border-radius:10px; text-align:center;">
            <h4 style="font-size:28px; margin:10px 0;">⏰ ${late}</h4>
            <p>تأخر</p>
          </div>
          <div style="background:linear-gradient(135deg, #667eea, #764ba2); color:white; padding:15px; border-radius:10px; text-align:center;">
            <h4 style="font-size:28px; margin:10px 0;">${percentage}%</h4>
            <p>نسبة الحضور</p>
          </div>
        </div>
      </div>
    `

    container.innerHTML = html

  } catch (error) {
    console.error("Error:", error)
    const container = document.getElementById("attendanceStatsContainer")
    if (container) container.innerHTML = `❌ خطأ: ${error.message}`
  }
}

// Original functions from the app (keeping the existing functionality)
window.logout = function() {
  if (confirm("هل تريد تسجيل الخروج؟")) {
    localStorage.removeItem("currentUser")
    location.href = "index.html"
  }
}

window.openTab = function(tabId, button) {
  // إخفاء كل التابات
  const allTabs = document.querySelectorAll('.tab-content')
  allTabs.forEach(tab => tab.classList.remove('active'))

  // إظهار التاب المختار
  const tab = document.getElementById(tabId)
  if (tab) {
    tab.classList.add('active')

    // تحديث زر القائمة النشطة
    const allButtons = document.querySelectorAll('.menu-btn')
    allButtons.forEach(btn => btn.style.background = '')
    if (button) button.style.background = 'linear-gradient(135deg, #667eea, #764ba2)'
  }
}

window.toggleMenu = function() {
  const sidebar = document.querySelector('.sidebar')
  if (sidebar) {
    sidebar.classList.toggle('open')
  }
}

window.scrollToTop = function() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

window.scrollToBottom = function() {
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
}

// دالة تحويل رابط YouTube إلى embed
function convertToEmbed(url) {
  if (!url) return ''
  const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/)
  if (youtubeMatch && youtubeMatch[1]) {
    return `https://www.youtube.com/embed/${youtubeMatch[1]}`
  }
  return url
}

// تحميل الصفحات الأخرى الموجودة في الملف الأصلي
window.changePassword = async function() {
  try {
    const currentUser = getCurrentUser()
    if (!currentUser) {
      alert('❌ يجب تسجيل الدخول أولاً')
      return
    }

    const oldPass = document.getElementById("oldPassword")?.value.trim()
    const newPass = document.getElementById("newPassword")?.value.trim()
    const confirmPass = document.getElementById("confirmPassword")?.value.trim()

    if (!oldPass || !newPass || !confirmPass) {
      alert("❗ اكتب كل البيانات")
      return
    }

    if (oldPass !== currentUser.password) {
      alert("❌ كلمة المرور القديمة غير صحيحة")
      return
    }

    if (newPass !== confirmPass) {
      alert("❌ كلمة المرور الجديدة غير متطابقة")
      return
    }

    if (newPass.length < 6) {
      alert("❌ كلمة المرور يجب أن تكون 6 أحرف على الأقل")
      return
    }

    const { error } = await supabase
      .from("users")
      .update({ password: newPass })
      .eq("id", currentUser.id)

    if (error) {
      alert(`❌ خطأ: ${error.message}`)
      return
    }

    currentUser.password = newPass
    localStorage.setItem("currentUser", JSON.stringify(currentUser))

    alert("✅ تم تغيير كلمة المرور")
    document.getElementById("oldPassword").value = ""
    document.getElementById("newPassword").value = ""
    document.getElementById("confirmPassword").value = ""

  } catch (error) {
    console.error("Error:", error)
    alert(`❌ خطأ: ${error.message}`)
  }
}

// دالة تحميل إحصائيات الأدمن
window.loadStats = async function() {
  try {
    const { data: users } = await supabase.from("users").select("role")

    const totalUsers = users?.length || 0
    const teachers = users?.filter(u => u.role === 'teacher').length || 0
    const students = users?.filter(u => u.role === 'student').length || 0

    const totalEl = document.getElementById("totalUsers")
    const teachersEl = document.getElementById("teachersCount")
    const studentsEl = document.getElementById("studentsCount")

    if (totalEl) totalEl.textContent = totalUsers
    if (teachersEl) teachersEl.textContent = teachers
    if (studentsEl) studentsEl.textContent = students

  } catch (error) {
    console.error("Error loading stats:", error)
  }
}

window.loadUsers = async function() {
  try {
    const { data: users, error } = await supabase.from("users").select("*")

    if (error || !users) {
      alert('❌ فشل التحميل')
      return
    }

    const container = document.getElementById("users")
    if (!container) return

    if (users.length === 0) {
      container.innerHTML = "📭 لا توجد مستخدمين"
      return
    }

    let html = ''
    users.forEach(u => {
      html += `
        <div class="user-card">
          <h4>${escapeHtml(u.name)}</h4>
          <p>📧 ${escapeHtml(u.email)}</p>
          <p>👤 ${u.role === 'teacher' ? '👨‍🏫 مدرس' : u.role === 'student' ? '👨‍🎓 طالب' : '👑 أدمن'}</p>
          <p>حالة: ${u.is_active ? '✅ نشط' : '❌ موقوف'}</p>
          <button onclick="window.toggleUserStatus('${u.id}', ${!u.is_active})" style="background:#667eea;">${u.is_active ? 'إيقاف' : 'تفعيل'}</button>
          <button onclick="window.deleteUser('${u.id}')" class="danger">حذف</button>
        </div>
      `
    })

    container.innerHTML = html

  } catch (error) {
    console.error("Error:", error)
    alert(`❌ خطأ: ${error.message}`)
  }
}

window.toggleUserStatus = async function(userId, newStatus) {
  try {
    const { error } = await supabase
      .from("users")
      .update({ is_active: newStatus })
      .eq("id", userId)

    if (error) throw error

    alert("✅ تم تحديث حالة المستخدم")
    loadUsers()

  } catch (error) {
    console.error("Error:", error)
    alert(`❌ خطأ: ${error.message}`)
  }
}

window.deleteUser = async function(userId) {
  if (!confirm("⚠️ هل متأكد من حذف هذا المستخدم؟")) return

  try {
    const { error } = await supabase.from("users").delete().eq("id", userId)

    if (error) throw error

    alert("✅ تم حذف المستخدم")
    loadUsers()
    loadStats()

  } catch (error) {
    console.error("Error:", error)
    alert(`❌ خطأ: ${error.message}`)
  }
}

window.loadLoginLogs = async function() {
  try {
    const { data: logs, error } = await supabase
      .from("login_logs")
      .select("*")
      .order("login_time", { ascending: false })

    if (error) {
      alert(`❌ خطأ: ${error.message}`)
      return
    }

    const container = document.getElementById("loginLogsContainer")
    if (!container) return

    if (!logs || logs.length === 0) {
      container.innerHTML = "📭 لا توجد سجلات دخول"
      return
    }

    let html = '<div style="display:grid; gap:10px;">'
    logs.forEach(log => {
      const date = new Date(log.login_time).toLocaleString('ar-EG')
      html += `
        <div style="background:#f8f9fa; padding:15px; border-radius:10px; border-right:4px solid #667eea;">
          <p><strong>${escapeHtml(log.user_name)}</strong> - ${log.user_email}</p>
          <p style="font-size:13px; color:#999;">الدور: ${log.user_role === 'teacher' ? '👨‍🏫' : '👨‍🎓'} | الوقت: ${date}</p>
        </div>
      `
    })
    html += '</div>'

    container.innerHTML = html

  } catch (error) {
    console.error("Error:", error)
  }
}

window.filterLogs = function(role) {
  // سيتم تنفيذ هذا بعد تحميل السجلات
  loadLoginLogs()
}

window.onRoleChange = function() {
  const role = document.getElementById("role")?.value
  const teacherRow = document.getElementById("teacherSelectRow")
  const stageRow = document.getElementById("stageSelectRow")

  if (teacherRow) teacherRow.style.display = role === "student" ? "block" : "none"
  if (stageRow) stageRow.style.display = role === "student" ? "block" : "none"

  if (role === "student") {
    loadTeachers()
    loadStages()
  }
}

window.loadTeachers = async function() {
  try {
    const { data: teachers } = await supabase
      .from("users")
      .select("id, name")
      .eq("role", "teacher")

    const select = document.getElementById("teacherSelect")
    if (!select || !teachers) return

    select.innerHTML = '<option value="">اختر المدرس</option>'
    teachers.forEach(t => {
      const option = document.createElement("option")
      option.value = t.id
      option.textContent = escapeHtml(t.name)
      select.appendChild(option)
    })

  } catch (error) {
    console.error("Error:", error)
  }
}

window.loadStages = function() {
  const select = document.getElementById("stageSelect")
  if (!select) return

  const stages = ['الابتدائية', 'الإعدادية', 'الثانوية']
  select.innerHTML = '<option value="">اختر المرحلة</option>'
  stages.forEach(stage => {
    const option = document.createElement("option")
    option.value = stage
    option.textContent = stage
    select.appendChild(option)
  })
}

// مرة أخرى مع جميع الوظائف الأخرى من الملف الأصلي
window.loadAllPlaylistsHome = async function() {
  let container = document.getElementById("playlistsHomeGrid")
  if (!container) return

  container.innerHTML = "<p style='text-align:center; color:rgba(255,255,255,0.7); grid-column:1/-1;'>⏳ جاري التحميل...</p>"

  let { data: playlists, error } = await supabase
    .from("playlists")
    .select("*")
    .order("id", { ascending: false })

  if (error || !playlists) {
    container.innerHTML = `<p style='text-align:center; color:#f5576c; grid-column:1/-1;'>⚠️ لا يمكن تحميل القوائم. ${escapeHtml(error?.message || "")}</p>`
    return
  }
  if (playlists.length === 0) {
    container.innerHTML = "<p style='text-align:center; color:rgba(255,255,255,0.7); grid-column:1/-1;'>📭 لا توجد قوائم تشغيل بعد</p>"
    return
  }

  let { data: vids } = await supabase
    .from("playlist_videos")
    .select("playlist_id")

  container.innerHTML = ""
  playlists.forEach(p => {
    let count = (vids || []).filter(v => v.playlist_id === p.id).length
    container.innerHTML += `
      <div class="playlist-home-card" onclick="window.openPlaylist('${p.id}')">
        <div class="playlist-thumb">🎬</div>
        <div class="playlist-body">
          <h3>${escapeHtml(p.name)}</h3>
          <p class="teacher-name">👨‍🏫 ${escapeHtml(p.teacher_name || "مدرس")}</p>
          <div class="playlist-meta">
            <span>📺 ${count} فيديو</span>
            <span class="price">${p.price > 0 ? "💰 " + p.price + " ج" : "🆓 مجاني"}</span>
          </div>
        </div>
      </div>`
  })
}

window.openPlaylist = function(playlistId) {
  window.location.href = `playlist-view.html?id=${playlistId}`
}

window.loadPlaylistViewer = async function() {
  let viewer = document.getElementById("playlistViewer")
  if (!viewer) return

  let urlParams = new URLSearchParams(window.location.search)
  let playlistId = urlParams.get("id")
  if (!playlistId) {
    viewer.innerHTML = "<p style='color:#ff4d4d; text-align:center;'>❌ لم يتم تحديد قائمة</p>"
    return
  }

  let { data: playlist } = await supabase
    .from("playlists").select("*").eq("id", playlistId).single()

  let { data: videos } = await supabase
    .from("playlist_videos").select("*").eq("playlist_id", playlistId).order("id", { ascending: true })

  if (!playlist) {
    viewer.innerHTML = "<p style='color:#ff4d4d; text-align:center;'>❌ القائمة غير موجودة</p>"
    return
  }

  let currentUser = getCurrentUser()
  let canPlay = false
  let lockReason = ""

  if (!currentUser) {
    lockReason = "🔐 يجب تسجيل الدخول كطالب لمشاهدة الفيديوهات"
  } else if (currentUser.role !== "student") {
    canPlay = true
  } else {
    let { data: sols } = await supabase
      .from("solutions")
      .select("id")
      .eq("student_id", currentUser.id)
      .limit(1)

    if (sols && sols.length > 0) {
      canPlay = true
    } else {
      lockReason = "🔒 لمشاهدة الفيديوهات يجب أولاً رفع حل/تعديل على الملفات اللي بعتها لك المدرس"
    }
  }

  let header = `
    <div style="background:white; border-radius:20px; padding:30px; margin-bottom:25px; box-shadow:0 10px 30px rgba(0,0,0,0.1);">
      <h1 style="color:#667eea; margin-bottom:10px;">📺 ${escapeHtml(playlist.name)}</h1>
      <p style="color:#666; margin-bottom:8px;">👨‍🏫 ${escapeHtml(playlist.teacher_name || "مدرس")}</p>
      <p style="color:#666;">💰 ${playlist.price > 0 ? playlist.price + " جنيه" : "مجاني"} • 📺 ${(videos||[]).length} فيديو</p>
    </div>`

  if (!canPlay) {
    viewer.innerHTML = header + `
      <div style="background:linear-gradient(135deg,#fff3cd,#ffe8a1); border:2px solid #ffc107; padding:30px; border-radius:20px; text-align:center; color:#856404;">
        <div style="font-size:60px; margin-bottom:15px;">🔒</div>
        <h3 style="margin-bottom:15px;">القائمة مقفلة</h3>
        <p style="font-size:16px; margin-bottom:20px;">${lockReason}</p>
        ${currentUser && currentUser.role === "student"
          ? `<button onclick="window.location.href='student-modern.html'" style="background:linear-gradient(135deg,#667eea,#764ba2); color:white; border:none; padding:12px 30px; border-radius:10px; cursor:pointer; font-family:'Cairo', sans-serif; font-size:16px;">📤 ادخل صفحتك ارفع الحل</button>`
          : `<button onclick="window.location.href='index.html'" style="background:linear-gradient(135deg,#667eea,#764ba2); color:white; border:none; padding:12px 30px; border-radius:10px; cursor:pointer; font-family:'Cairo', sans-serif; font-size:16px;">🔐 تسجيل الدخول</button>`
        }
      </div>`
    return
  }

  if (!videos || videos.length === 0) {
    viewer.innerHTML = header + "<p style='text-align:center; color:#999;'>📭 لا توجد فيديوهات في القائمة بعد</p>"
    return
  }

  viewer.innerHTML = header + `
    <div style="display:grid; gap:20px;">
      ${videos.map((v, i) => `
        <div style="background:white; border-radius:15px; padding:20px; box-shadow:0 5px 15px rgba(0,0,0,0.08);">
          <h3 style="color:#667eea; margin-bottom:15px;">${i+1}. ${escapeHtml(v.title || "فيديو")}</h3>
          <div style="position:relative; padding-bottom:56.25%; height:0; overflow:hidden; border-radius:12px;">
            <iframe src="${escapeHtml(v.url)}" style="position:absolute; top:0; left:0; width:100%; height:100%; border:0;" allowfullscreen></iframe>
          </div>
        </div>
      `).join("")}
    </div>`
}

// إجراء التحقق الأولي على الصفحة
window.protectPage = protectPage