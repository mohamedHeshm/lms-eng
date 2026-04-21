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
  const protectedPages = ['student-modern.html', 'teacher.html', 'admin.html', 'teacher-profile.html', 'dashboard-home.html']

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
  if (input) input.type = input.type === "password" ? "text" : "password"
}

// ================== Users ==================
window.loadUsers = async function() {
  try {
    searchUsers()
  } catch (error) {
    console.error("Error loading users:", error)
  }
}

window.searchUsers = async function() {
  try {
    let search = document.getElementById("search")?.value.toLowerCase() || ""
    let { data: users, error } = await supabase.from("users").select("*")

    let container = document.getElementById("users")
    if (!container || !users) return

    container.innerHTML = ""

    users.forEach((u) => {
      if (u.role === "admin") return

      let match =
        (u.name && u.name.toLowerCase().includes(search)) ||
        u.email.toLowerCase().includes(search)

      if (!match) return

      let stageText = u.stage ? `📚 ${u.stage}` : ""

      container.innerHTML += `
        <div class="user-card">
          <h4>${escapeHtml(u.name || "بدون اسم")}</h4>
          <p>${escapeHtml(u.email)}</p>
          <p>👤 ${u.role === "teacher" ? "مدرس" : "طالب"}</p>
          ${stageText ? `<p>${stageText}</p>` : ""}
          <p>${u.is_active ? "🟢 نشط" : "🔴 متوقف"}</p>

          <button onclick="window.toggleUser('${u.id}')">
            ${u.is_active ? "⏸ إيقاف" : "▶️ تشغيل"}
          </button>

          <button onclick="window.deleteUser('${u.id}')" class="danger">🗑 حذف</button>
        </div>
      `
    })

    if (container.innerHTML === "") {
      container.innerHTML = "<p style='text-align:center; color:#999;'>لا توجد نتائج</p>"
    }

  } catch (error) {
    console.error("Search error:", error)
  }
}

window.deleteUser = async function(id) {
  try {
    if (!confirm("هل متأكد من حذف المستخدم؟")) return

    let currentUser = getCurrentUser()
    if (id === currentUser.id) {
      return alert("❌ لا تقدر تحذف حسابك")
    }

    let { error } = await supabase.from("users").delete().eq("id", id)
    if (error) {
      alert("❌ خطأ في الحذف: " + error.message)
      return
    }

    alert("✅ تم حذف المستخدم")
    loadUsers()
    loadStats()

  } catch (error) {
    console.error("Delete error:", error)
    alert("❌ خطأ: " + error.message)
  }
}

window.toggleUser = async function(id) {
  try {
    let { data } = await supabase.from("users").select("is_active").eq("id", id).single()
    if (!data) return

    await supabase.from("users")
      .update({ is_active: !data.is_active })
      .eq("id", id)

    alert(`✅ تم ${!data.is_active ? 'تفعيل' : 'إيقاف'} المستخدم`)
    loadUsers()

  } catch (error) {
    console.error("Toggle error:", error)
    alert("❌ خطأ: " + error.message)
  }
}

// ================== Stats ==================
window.loadStats = async function() {
  try {
    let { data: users } = await supabase.from("users").select("role")
    if (!users) return

    let el = (id) => document.getElementById(id)
    if (el("totalUsers")) el("totalUsers").innerText = users.length
    if (el("teachersCount")) el("teachersCount").innerText = users.filter(u => u.role === "teacher").length
    if (el("studentsCount")) el("studentsCount").innerText = users.filter(u => u.role === "student").length

  } catch (error) {
    console.error("Stats error:", error)
  }
}

// ================== Login Logs ==================
let allLoginLogs = []

window.loadLoginLogs = async function() {
  let container = document.getElementById("loginLogsContainer")
  try {
    if (container) container.innerHTML = "<p style='text-align:center; color:#999;'>⏳ جاري تحميل السجلات...</p>"

    let { data: logs, error } = await supabase
      .from("login_logs")
      .select("*")
      .order("login_time", { ascending: false })
      .limit(500)

    if (error) {
      console.error("❌ Login logs error:", error)
      if (container) {
        container.innerHTML = `
          <div style="background:#fff3cd; border:2px solid #ffc107; padding:20px; border-radius:12px; color:#856404;">
            <h4>⚠️ تعذّر تحميل السجل</h4>
            <p style="margin-top:10px;">${escapeHtml(error.message)}</p>
            <p style="margin-top:10px; font-size:13px;">السبب الأرجح: جدول <code>login_logs</code> غير موجود في قاعدة البيانات،
            أو سياسات RLS لا تسمح بالقراءة. شغّل ملف <code>setup-database.sql</code> اللي موجود مع الملفات.</p>
          </div>`
      }
      return
    }

    allLoginLogs = logs || []
    console.log(`✅ تم تحميل ${allLoginLogs.length} سجل دخول`)
    displayLoginLogs('all')

  } catch (error) {
    console.error("Load login logs error:", error)
    if (container) container.innerHTML = `<p style='color:#ff4d4d;'>❌ خطأ: ${escapeHtml(error.message)}</p>`
  }
}

window.filterLogs = function(role) {
  displayLoginLogs(role)
}

function displayLoginLogs(role) {
  let container = document.getElementById("loginLogsContainer")
  if (!container) return

  let filtered = allLoginLogs
  if (role !== 'all') {
    filtered = allLoginLogs.filter(log => log.user_role === role)
  }

  container.innerHTML = ""

  if (filtered.length === 0) {
    container.innerHTML = "<p style='text-align:center; color:#999;'>لا توجد سجلات</p>"
    return
  }

  filtered.forEach(log => {
    let date = new Date(log.login_time)
    let formattedDate = date.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    let formattedTime = date.toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })

    let roleIcon = log.user_role === 'student' ? '👨‍🎓' :
                   log.user_role === 'teacher' ? '👨‍🏫' : '👑'
    let roleText = log.user_role === 'student' ? 'طالب' :
                   log.user_role === 'teacher' ? 'مدرس' : 'أدمن'

    container.innerHTML += `
      <div class="user-card" style="margin:10px 0;">
        <h4>${roleIcon} ${escapeHtml(log.user_name)}</h4>
        <p>📧 ${escapeHtml(log.user_email)}</p>
        <p>👤 ${roleText}</p>
        <p>📅 ${formattedDate} | ⏰ ${formattedTime}</p>
      </div>
    `
  })
}

// ================== تغيير الباسورد ==================
window.goToChangePassword = function() {
  window.location.href = 'change-password.html'
}

// ================== Notes ==================
window.addNote = async function() {
  try {
    let noteInput = document.getElementById("noteInput")
    let note = noteInput?.value.trim()
    let stageSelect = document.getElementById("noteStageSelect")
    let stage = stageSelect?.value
    let currentUser = getCurrentUser()

    if (!note) {
      alert("❗ اكتب الملاحظة")
      return
    }
    if (!stage) {
      alert("❗ اختر المرحلة الدراسية أولاً")
      return
    }
    if (!currentUser) {
      alert("❗ مش مسجل دخول")
      return
    }

    let { error } = await supabase.from("notes").insert([
      { teacher_id: currentUser.id, content: note, stage: stage }
    ])

    if (error) {
      alert("❌ خطأ: " + error.message)
      return
    }

    noteInput.value = ""
    stageSelect.value = ""
    alert("✅ تم النشر")
    loadTeacherContent()

  } catch (error) {
    console.error("Add note error:", error)
    alert("❌ خطأ: " + error.message)
  }
}

// ================== Video ==================
function convertToEmbed(url) {
  if (url.includes("watch?v=")) return url.replace("watch?v=", "embed/")
  if (url.includes("youtu.be/")) {
    let id = url.split("youtu.be/")[1].split("?")[0]
    return "https://www.youtube.com/embed/" + id
  }
  return url
}

window.addVideo = async function() {
  try {
    let input = document.getElementById("videoInput")
    let url = input?.value.trim()
    let stageSelect = document.getElementById("videoStageSelect")
    let stage = stageSelect?.value
    let currentUser = getCurrentUser()

    if (!url) {
      alert("❗ حط رابط الفيديو")
      return
    }
    if (!stage) {
      alert("❗ اختر المرحلة الدراسية أولاً")
      return
    }
    if (!currentUser) {
      alert("❗ مش مسجل دخول")
      return
    }

    let { error } = await supabase.from("videos").insert([
      { teacher_id: currentUser.id, url: convertToEmbed(url), stage: stage }
    ])

    if (error) {
      alert("❌ خطأ: " + error.message)
      return
    }

    input.value = ""
    stageSelect.value = ""
    alert("✅ تم نشر الفيديو")
    loadTeacherContent()

  } catch (error) {
    console.error("Add video error:", error)
    alert("❌ خطأ: " + error.message)
  }
}

// ================== PDF ==================
window.uploadPDF = async function() {
  try {
    let file = document.getElementById("pdfFile")?.files[0]
    let status = document.getElementById("status")
    let stageSelect = document.getElementById("pdfStageSelect")
    let stage = stageSelect?.value
    let currentUser = getCurrentUser()

    if (!file) {
      status.innerText = "❗ اختار ملف PDF"
      return
    }
    if (!stage) {
      status.innerText = "❗ اختر المرحلة الدراسية أولاً"
      return
    }
    if (!currentUser) {
      status.innerText = "❗ مش مسجل دخول"
      return
    }

    status.innerText = "⏳ جاري الرفع..."

    let safeName = file.name.replace(/\s+/g, "_")
    let path = "pdfs/" + currentUser.id + "_" + Date.now() + "_" + safeName

    let { data: uploadData, error: uploadError } = await supabase.storage
      .from("files")
      .upload(path, file, { upsert: true })

    if (uploadError) {
      status.innerText = "❌ خطأ في الرفع: " + uploadError.message
      return
    }

    let { data: urlData } = supabase.storage.from("files").getPublicUrl(path)
    let publicUrl = urlData.publicUrl

    let { error: dbError } = await supabase.from("pdfs").insert([
      { teacher_id: currentUser.id, file_url: publicUrl, file_name: file.name, stage: stage }
    ])

    if (dbError) {
      status.innerText = "❌ خطأ في الحفظ: " + dbError.message
      return
    }

    status.innerText = "✅ تم النشر بنجاح"
    document.getElementById("pdfFile").value = ""
    stageSelect.value = ""
    loadTeacherContent()

  } catch (error) {
    console.error("Upload PDF error:", error)
    let status = document.getElementById("status")
    status.innerText = "❌ خطأ: " + error.message
  }
}

window.uploadPDF2 = async function() {
  try {
    let file = document.getElementById("pdf2File")?.files[0]
    let status = document.getElementById("status2")
    let stageSelect = document.getElementById("pdf2StageSelect")
    let stage = stageSelect?.value
    let currentUser = getCurrentUser()

    if (!file) {
      status.innerText = "❗ اختار ملف PDF"
      return
    }
    if (file.type !== "application/pdf") {
      status.innerText = "❌ لازم PDF"
      return
    }
    if (!stage) {
      status.innerText = "❗ اختر المرحلة الدراسية أولاً"
      return
    }
    if (!currentUser) {
      status.innerText = "❗ مش مسجل دخول"
      return
    }

    status.innerText = "⏳ جاري الرفع..."

    let path = "pdfs2/" + currentUser.id + "_" + Date.now() + "_" + file.name

    let { error } = await supabase.storage.from("files").upload(path, file, { upsert: true })
    if (error) {
      status.innerText = "❌ " + error.message
      return
    }

    let { data } = supabase.storage.from("files").getPublicUrl(path)

    let { error: dbError } = await supabase.from("pdfs2").insert([
      { teacher_id: currentUser.id, file_url: data.publicUrl, file_name: file.name, stage: stage }
    ])

    if (dbError) {
      status.innerText = "❌ خطأ: " + dbError.message
      return
    }

    status.innerText = "✅ تم"
    document.getElementById("pdf2File").value = ""
    stageSelect.value = ""
    loadTeacherContent()

  } catch (error) {
    console.error("Upload PDF2 error:", error)
    let status = document.getElementById("status2")
    status.innerText = "❌ خطأ: " + error.message
  }
}

// ================== تحميل محتوى المدرس ==================
window.loadTeacherContent = async function() {
  try {
    let currentUser = getCurrentUser()
    if (!currentUser) return

    const [
      { data: videos },
      { data: pdfs },
      { data: pdfs2 },
      { data: notes }
    ] = await Promise.all([
      supabase.from("videos").select("*").eq("teacher_id", currentUser.id).order("id", { ascending: false }),
      supabase.from("pdfs").select("*").eq("teacher_id", currentUser.id).order("id", { ascending: false }),
      supabase.from("pdfs2").select("*").eq("teacher_id", currentUser.id).order("id", { ascending: false }),
      supabase.from("notes").select("*").eq("teacher_id", currentUser.id).order("id", { ascending: false })
    ])

    // Videos
    let videoList = document.getElementById("videoListTeacher")
    if (videoList && videos) {
      videoList.innerHTML = ""
      if (videos.length > 0) {
        videos.forEach(v => {
          videoList.innerHTML += `
            <div class="card" style="margin:10px 0; padding:15px; background:#f5f7ff; border-radius:10px;">
              <p>📚 <strong>المرحلة:</strong> ${escapeHtml(v.stage || "غير محدد")}</p>
              <p><a href="${escapeHtml(v.url)}" target="_blank" style="color:#667eea;">🎥 فتح الفيديو</a></p>
              <button onclick="deleteVideo('${v.id}')" style="background:#ff4d4d; margin-top:10px; padding:8px 16px; width:auto;">🗑 حذف</button>
            </div>
          `
        })
      } else {
        videoList.innerHTML = "<p style='text-align:center; color:#999;'>مفيش فيديوهات</p>"
      }
    }

    // Notes
    let noteList = document.getElementById("noteListTeacher")
    if (noteList && notes) {
      noteList.innerHTML = ""
      if (notes.length > 0) {
        notes.forEach(n => {
          noteList.innerHTML += `
            <div class="card" style="margin:10px 0; padding:15px; background:#f5f7ff; border-radius:10px;">
              <p>📚 <strong>المرحلة:</strong> ${escapeHtml(n.stage || "غير محدد")}</p>
              <p>📝 ${escapeHtml(n.content)}</p>
              <button onclick="deleteNote('${n.id}')" style="background:#ff4d4d; margin-top:10px; padding:8px 16px; width:auto;">🗑 حذف</button>
            </div>
          `
        })
      } else {
        noteList.innerHTML = "<p style='text-align:center; color:#999;'>مفيش ملاحظات</p>"
      }
    }

    // PDFs الأول
    let pdfList = document.getElementById("pdfListTeacher")
    if (pdfList && pdfs) {
      pdfList.innerHTML = ""
      if (pdfs.length > 0) {
        pdfs.forEach(p => {
          pdfList.innerHTML += `
            <div class="card" style="margin:10px 0; padding:15px; background:#f5f7ff; border-radius:10px;">
              <p>📚 <strong>المرحلة:</strong> ${escapeHtml(p.stage || "غير محدد")}</p>
              <p><a href="${escapeHtml(p.file_url)}" target="_blank" style="color:#667eea;">📄 ${escapeHtml(p.file_name)}</a></p>
              <button onclick="deletePDF('${p.id}')" style="background:#ff4d4d; margin-top:10px; padding:8px 16px; width:auto;">🗑 حذف</button>
            </div>
          `
        })
      } else {
        pdfList.innerHTML = "<p style='text-align:center; color:#999;'>مفيش ملفات</p>"
      }
    }

    // PDFs الثاني
    let pdfList2 = document.getElementById("pdfListTeacher2")
    if (pdfList2 && pdfs2) {
      pdfList2.innerHTML = ""
      if (pdfs2.length > 0) {
        pdfs2.forEach(p => {
          pdfList2.innerHTML += `
            <div class="card" style="margin:10px 0; padding:15px; background:#f5f7ff; border-radius:10px;">
              <p>📚 <strong>المرحلة:</strong> ${escapeHtml(p.stage || "غير محدد")}</p>
              <p><a href="${escapeHtml(p.file_url)}" target="_blank" style="color:#667eea;">📄 ${escapeHtml(p.file_name)}</a></p>
              <button onclick="deletePDF2('${p.id}')" style="background:#ff4d4d; margin-top:10px; padding:8px 16px; width:auto;">🗑 حذف</button>
            </div>
          `
        })
      } else {
        pdfList2.innerHTML = "<p style='text-align:center; color:#999;'>مفيش ملفات</p>"
      }
    }

  } catch (error) {
    console.error("Load teacher content error:", error)
  }
}

// ================== حذف المحتوى ==================
window.deleteVideo = async function(id) {
  if (!confirm("هل متأكد من حذف الفيديو؟")) return
  try {
    let { error } = await supabase.from("videos").delete().eq("id", id)
    if (error) {
      alert("❌ خطأ في الحذف: " + error.message)
      return
    }
    alert("✅ تم الحذف")
    loadTeacherContent()
  } catch (error) {
    console.error("Delete video error:", error)
    alert("❌ خطأ: " + error.message)
  }
}

window.deleteNote = async function(id) {
  if (!confirm("هل متأكد من حذف الملاحظة؟")) return
  try {
    let { error } = await supabase.from("notes").delete().eq("id", id)
    if (error) {
      alert("❌ خطأ في الحذف: " + error.message)
      return
    }
    alert("✅ تم الحذف")
    loadTeacherContent()
  } catch (error) {
    console.error("Delete note error:", error)
    alert("❌ خطأ: " + error.message)
  }
}

window.deletePDF = async function(id) {
  if (!confirm("هل متأكد من حذف الملف؟")) return
  try {
    let { error } = await supabase.from("pdfs").delete().eq("id", id)
    if (error) {
      alert("❌ خطأ في الحذف: " + error.message)
      return
    }
    alert("✅ تم الحذف")
    loadTeacherContent()
  } catch (error) {
    console.error("Delete PDF error:", error)
    alert("❌ خطأ: " + error.message)
  }
}

window.deletePDF2 = async function(id) {
  if (!confirm("هل متأكد من حذف الملف؟")) return
  try {
    let { error } = await supabase.from("pdfs2").delete().eq("id", id)
    if (error) {
      alert("❌ خطأ في الحذف: " + error.message)
      return
    }
    alert("✅ تم الحذف")
    loadTeacherContent()
  } catch (error) {
    console.error("Delete PDF2 error:", error)
    alert("❌ خطأ: " + error.message)
  }
}

// ================== Teacher Profile ==================
window.loadCurrentProfile = async function() {
  try {
    let currentUser = getCurrentUser()
    if (!currentUser) return

    let { data, error } = await supabase
      .from("teacher_profile")
      .select("*")
      .eq("teacher_id", currentUser.id)
      .single()

    if (error || !data) {
      let preview = document.getElementById("profilePreview")
      if (preview) preview.innerHTML = "<p>لم تقم بإضافة بروفايل بعد</p>"
      return
    }

    let preview = document.getElementById("profilePreview")
    if (preview) {
      preview.innerHTML = `
        ${data.image_url ? `<img src="${escapeHtml(data.image_url)}" alt="Profile" style="width:150px; height:150px; border-radius:50%; object-fit:cover; margin-bottom:10px;">` : ""}
        <h4>${escapeHtml(currentUser.name)}</h4>
        <p>${escapeHtml(data.bio || "")}</p>
      `
    }

    let bioInput = document.getElementById("bio")
    if (bioInput) bioInput.value = data.bio || ""

  } catch (error) {
    console.error("Load profile error:", error)
  }
}

window.saveProfile = async function() {
  try {
    let bio = document.getElementById("bio")?.value.trim()
    let file = document.getElementById("imgFile")?.files[0]
    let currentUser = getCurrentUser()

    if (!currentUser) {
      alert("❗ مش مسجل دخول")
      return
    }

    let imageUrl = null

    if (file) {
      let path = "profiles/" + currentUser.id + "_" + Date.now() + "_" + file.name
      let { error: uploadError } = await supabase.storage.from("files").upload(path, file)
      if (uploadError) {
        alert("❌ خطأ في رفع الصورة: " + uploadError.message)
        return
      }
      let { data } = supabase.storage.from("files").getPublicUrl(path)
      imageUrl = data.publicUrl
    }

    // شيك إن في بروفايل موجود؟
    let { data: existing } = await supabase
      .from("teacher_profile")
      .select("id")
      .eq("teacher_id", currentUser.id)
      .single()

    let updateData = {}
    if (bio) updateData.bio = bio
    if (imageUrl) updateData.image_url = imageUrl

    if (existing) {
      // تحديث
      let { error } = await supabase
        .from("teacher_profile")
        .update(updateData)
        .eq("teacher_id", currentUser.id)
      if (error) {
        alert("❌ خطأ: " + error.message)
        return
      }
    } else {
      // إضافة جديد
      let { error } = await supabase
        .from("teacher_profile")
        .insert([{ teacher_id: currentUser.id, ...updateData }])
      if (error) {
        alert("❌ خطأ: " + error.message)
        return
      }
    }

    alert("✅ تم الحفظ")
    document.getElementById("imgFile").value = ""
    loadCurrentProfile()

  } catch (error) {
    console.error("Save profile error:", error)
    alert("❌ خطأ: " + error.message)
  }
}

// ================== Social Links ==================
window.loadCurrentSocial = async function() {
  try {
    let currentUser = getCurrentUser()
    if (!currentUser) return

    let { data } = await supabase
      .from("social_links")
      .select("*")
      .eq("teacher_id", currentUser.id)
      .single()

    if (data) {
      if (document.getElementById("facebook")) document.getElementById("facebook").value = data.facebook || ""
      if (document.getElementById("whatsapp")) document.getElementById("whatsapp").value = data.whatsapp || ""
      if (document.getElementById("youtube")) document.getElementById("youtube").value = data.youtube || ""
    }

  } catch (error) {
    console.error("Load social error:", error)
  }
}

window.saveSocial = async function() {
  try {
    let facebook = document.getElementById("facebook")?.value.trim()
    let whatsapp = document.getElementById("whatsapp")?.value.trim()
    let youtube = document.getElementById("youtube")?.value.trim()
    let currentUser = getCurrentUser()

    if (!currentUser) {
      alert("❗ مش مسجل دخول")
      return
    }

    let { data: existing } = await supabase
      .from("social_links")
      .select("id")
      .eq("teacher_id", currentUser.id)
      .single()

    if (existing) {
      let { error } = await supabase
        .from("social_links")
        .update({ facebook, whatsapp, youtube })
        .eq("teacher_id", currentUser.id)
      if (error) {
        alert("❌ خطأ: " + error.message)
        return
      }
    } else {
      let { error } = await supabase
        .from("social_links")
        .insert([{ teacher_id: currentUser.id, facebook, whatsapp, youtube }])
      if (error) {
        alert("❌ خطأ: " + error.message)
        return
      }
    }

    alert("✅ تم الحفظ")
    loadCurrentSocial()

  } catch (error) {
    console.error("Save social error:", error)
    alert("❌ خطأ: " + error.message)
  }
}

// ================== تحميل البيانات في صفحة الطالب ==================
window.loadStudentData = async function() {
  try {
    let currentUser = getCurrentUser()
    if (!currentUser) return

    window.studentTeacherId = currentUser.teacher_id
    let studentStage = currentUser.stage  // المرحلة الدراسية للطالب

    const [
      { data: videos },
      { data: pdfs },
      { data: pdfs2 },
      { data: notes }
    ] = await Promise.all([
      supabase.from("videos").select("*").eq("teacher_id", currentUser.teacher_id).eq("stage", studentStage),
      supabase.from("pdfs").select("*").eq("teacher_id", currentUser.teacher_id).eq("stage", studentStage),
      supabase.from("pdfs2").select("*").eq("teacher_id", currentUser.teacher_id).eq("stage", studentStage),
      supabase.from("notes").select("*").eq("teacher_id", currentUser.teacher_id).eq("stage", studentStage)
    ])

    // Videos
    let videoList = document.getElementById("videoList")
    if (videoList && videos) {
      videoList.innerHTML = ""
      if (videos.length > 0) {
        videos.forEach(v => {
          videoList.innerHTML += `<li><a href="${escapeHtml(v.url)}" target="_blank">🎥 الفيديو</a></li>`
        })
      } else {
        videoList.innerHTML = "<li>مفيش فيديوهات</li>"
      }
    }

    // Notes
    let noteList = document.getElementById("noteList")
    if (noteList && notes) {
      noteList.innerHTML = ""
      if (notes.length > 0) {
        notes.forEach(n => {
          noteList.innerHTML += `<li>${escapeHtml(n.content)}</li>`
        })
      } else {
        noteList.innerHTML = "<li>مفيش ملاحظات</li>"
      }
    }

    // PDFs الأول
    let pdfList = document.getElementById("pdfList")
    if (pdfList && pdfs) {
      pdfList.innerHTML = ""
      if (pdfs.length > 0) {
        pdfs.forEach(p => {
          pdfList.innerHTML += `<li><a href="${escapeHtml(p.file_url)}" target="_blank">📄 ${escapeHtml(p.file_name)}</a></li>`
        })
      } else {
        pdfList.innerHTML = "<li>مفيش ملفات</li>"
      }
    }

    // PDFs الثاني
    let pdfList2 = document.getElementById("pdfList2")
    if (pdfList2 && pdfs2) {
      pdfList2.innerHTML = ""
      if (pdfs2.length > 0) {
        pdfs2.forEach(p => {
          pdfList2.innerHTML += `<li><a href="${escapeHtml(p.file_url)}" target="_blank">📄 ${escapeHtml(p.file_name)}</a></li>`
        })
      } else {
        pdfList2.innerHTML = "<li>مفيش ملفات</li>"
      }
    }

    // تحميل البروفايل والتواصل
    await loadTeacherProfile(currentUser.teacher_id)

  } catch (error) {
    console.error("Load student data error:", error)
    alert("❌ خطأ في تحميل البيانات: " + error.message)
  }
}

window.loadTeachers = async function() {
  try {
    let select = document.getElementById("teacherSelect")
    if (!select) return

    let { data, error } = await supabase
      .from("users")
      .select("id, name")
      .eq("role", "teacher")

    if (error) throw error

    select.innerHTML = `<option value="">اختر المدرس</option>`

    if (!data || data.length === 0) {
      select.innerHTML = `<option>❌ مفيش مدرسين</option>`
      return
    }

    data.forEach(t => {
      select.innerHTML += `<option value="${t.id}">${escapeHtml(t.name)}</option>`
    })

  } catch (error) {
    console.error("Load teachers error:", error)
  }
}

window.loadStages = async function() {
  try {
    let select = document.getElementById("stageSelect")
    if (!select) return

    // المراحل المتاحة
    const stages = ["الأولى الابتدائي", "الثانية الابتدائي", "الثالثة الابتدائي",
                   "الأولى الإعدادي", "الثانية الإعدادي", "الثالثة الإعدادي",
                   "الأولى الثانوي", "الثانية الثانوي", "الثالثة الثانوي"]

    select.innerHTML = `<option value="">اختر المرحلة</option>`
    stages.forEach(stage => {
      select.innerHTML += `<option value="${stage}">${stage}</option>`
    })

  } catch (error) {
    console.error("Load stages error:", error)
  }
}

window.onRoleChange = function() {
  let role = document.getElementById("role")?.value
  let teacherRow = document.getElementById("teacherSelectRow")
  let stageRow = document.getElementById("stageSelectRow")

  if (teacherRow) teacherRow.style.display = role === "student" ? "block" : "none"
  if (stageRow) stageRow.style.display = role === "student" ? "block" : "none"
}

window.loadTeacherProfile = async function(teacherId) {
  try {
    let profileDiv = document.getElementById("teacherProfile")
    let socialDiv = document.getElementById("teacherSocial")

    // تحميل الاثنين بسرعة
    const [
      { data: profiles },
      { data: socials }
    ] = await Promise.all([
      supabase.from("teacher_profile").select("*").eq("teacher_id", teacherId),
      supabase.from("social_links").select("*").eq("teacher_id", teacherId)
    ])

    // PROFILE
    if (profileDiv && profiles && profiles.length > 0) {
      let p = profiles[0]

      profileDiv.innerHTML = `
        <div style="text-align:center;">
          ${p.image_url ? `<img src="${escapeHtml(p.image_url)}" style="width:120px; height:120px; border-radius:50%; object-fit:cover; margin-bottom:10px; border:3px solid #4facfe;" alt="Teacher">` : ""}
          <p style="font-size:16px; color:#444;">${escapeHtml(p.bio || "")}</p>
        </div>`
    }

    // SOCIAL
    if (socialDiv && socials && socials.length > 0) {
      let s = socials[0]

      let links = []
      if (s.facebook) links.push(`<a href="${escapeHtml(s.facebook)}" target="_blank" style="color:#1877f2; font-size:16px;">📘 فيسبوك</a>`)
      if (s.whatsapp) links.push(`<a href="${escapeHtml(s.whatsapp)}" target="_blank" style="color:#25d366; font-size:16px;">💬 واتساب</a>`)
      if (s.youtube) links.push(`<a href="${escapeHtml(s.youtube)}" target="_blank" style="color:#ff0000; font-size:16px;">▶️ يوتيوب</a>`)

      socialDiv.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:10px;">
          ${links.join("")}
        </div>`
    }

  } catch (error) {
    console.error("Load teacher profile error:", error)
  }
}

// ================== رفع حل الطالب ==================
// ================== رفع حل الطالب ==================
window.uploadSolution = async function() {
  try {
    let file = document.getElementById("solutionFile")?.files[0]
    let assignmentSelect = document.getElementById("assignmentSelect")
    let selectedIndex = assignmentSelect?.value
    let status = document.getElementById("uploadStatus")
    let currentUser = getCurrentUser()

    if (!file) {
      if (status) status.innerText = "❗ اختار ملف"
      return
    }

    if (!selectedIndex || selectedIndex === "") {
      if (status) status.innerText = "❗ اختر الواجب أولاً"
      return
    }

    if (!currentUser) {
      if (status) status.innerText = "❗ مش مسجل دخول"
      return
    }

    if (status) status.innerText = "⏳ جاري الرفع..."

    // الحصول على بيانات الواجب المختار
    let selectedAssignment = assignmentsList[parseInt(selectedIndex)]
    if (!selectedAssignment) {
      if (status) status.innerText = "❌ الواجب غير موجود"
      return
    }

    let safeName = file.name.replace(/\s+/g, "_")
    let path = "solutions/" + currentUser.id + "_" + Date.now() + "_" + safeName

    let { error: uploadError } = await supabase.storage.from("files").upload(path, file)
    if (uploadError) {
      if (status) status.innerText = "❌ خطأ في الرفع: " + uploadError.message
      return
    }

    let { data: urlData } = supabase.storage.from("files").getPublicUrl(path)

    // تحويل pdf_id إلى رقم صحيح إذا كان موجوداً
    let pdfIdValue = null
    if (selectedAssignment.id) {
      // محاولة تحويل المعرف إلى رقم
      const parsedId = parseInt(selectedAssignment.id)
      if (!isNaN(parsedId)) {
        pdfIdValue = parsedId
      }
    }

    // بيانات الإدراج - تأكد من تطابق أسماء الأعمدة مع قاعدة البيانات
    const solutionData = {
      student_id: currentUser.id,
      file_url: urlData.publicUrl,
      pdf_name: selectedAssignment.file_name || null
    }

    // إضافة pdf_id فقط إذا كان رقماً صالحاً
    if (pdfIdValue !== null) {
      solutionData.pdf_id = pdfIdValue
    }

    let { error: dbError } = await supabase.from("solutions").insert([solutionData])

    if (dbError) {
      console.error("Database error:", dbError)
      if (status) status.innerText = "❌ خطأ في الحفظ: " + dbError.message
      return
    }

    if (status) {
      status.innerText = "✅ تم رفع الحل بنجاح"
      status.style.color = "#25d366"
    }

    document.getElementById("solutionFile").value = ""
    document.getElementById("assignmentSelect").value = ""

    // إعادة تحميل الحلول
    const { data: newSolutions } = await supabase
      .from("solutions")
      .select("*")
      .eq("student_id", currentUser.id)
      .order("created_at", { ascending: false })

    if (typeof loadMySolutions === 'function') {
      loadMySolutions(newSolutions || [])
    }

    setTimeout(() => {
      if (status) status.innerText = ""
    }, 3000)

  } catch (error) {
    console.error("Upload solution error:", error)
    let status = document.getElementById("uploadStatus")
    if (status) status.innerText = "❌ خطأ: " + error.message
  }
}
// ================== حلول الطلاب للمدرس (حسب المرحلة) ==================
/**
 * تحميل وعرض حلول الطلاب حسب المرحلة المختارة
 */
window.loadStudentsSolutions = async function() {
    try {
        let container = document.getElementById("studentsSolutionsContainer");
        let stageFilter = document.getElementById("filterSolutionStage")?.value || "all";
        let currentUser = getCurrentUser();

        if (!container) return;
        if (!currentUser || currentUser.role !== "teacher") {
            if (container) container.innerHTML = "<p style='text-align:center; color:#ff4d4d;'>❌ هذه الصفحة مخصصة للمدرسين فقط</p>";
            return;
        }

        if (container) container.innerHTML = "<p style='text-align:center; color:#999;'>⏳ جاري تحميل الحلول...</p>";

        // 1. جلب جميع الطلاب التابعين لهذا المدرس
        let { data: students, error: studentsError } = await supabase
            .from("users")
            .select("id, name, email, stage")
            .eq("teacher_id", currentUser.id)
            .eq("role", "student");

        if (studentsError) {
            console.error("Error loading students:", studentsError);
            if (container) container.innerHTML = `<p style='text-align:center; color:#ff4d4d;'>❌ خطأ في تحميل الطلاب: ${escapeHtml(studentsError.message)}</p>`;
            return;
        }

        if (!students || students.length === 0) {
            if (container) container.innerHTML = "<p style='text-align:center; color:#999;'>📭 لا يوجد طلاب مسجلين لديك حتى الآن</p>";
            return;
        }

        // تصفية الطلاب حسب المرحلة إذا لم يكن الكل
        let filteredStudents = students;
        if (stageFilter !== "all") {
            filteredStudents = students.filter(s => s.stage === stageFilter);
        }

        if (filteredStudents.length === 0) {
            if (container) container.innerHTML = `<p style='text-align:center; color:#999;'>📭 لا يوجد طلاب في المرحلة: ${escapeHtml(stageFilter)}</p>`;
            return;
        }

        // 2. جلب حلول هؤلاء الطلاب
        let studentIds = filteredStudents.map(s => s.id);
        let { data: solutions, error: solutionsError } = await supabase
            .from("solutions")
            .select("*, users(name, email, stage)")
            .in("student_id", studentIds)
            .order("created_at", { ascending: false });

        if (solutionsError) {
            console.error("Error loading solutions:", solutionsError);
            if (container) container.innerHTML = `<p style='text-align:center; color:#ff4d4d;'>❌ خطأ في تحميل الحلول: ${escapeHtml(solutionsError.message)}</p>`;
            return;
        }

        if (!solutions || solutions.length === 0) {
            if (container) container.innerHTML = "<p style='text-align:center; color:#999;'>📭 لا توجد حلول مرفوعة بعد</p>";
            return;
        }

        // 3. عرض الإحصائيات والحلول
        const statsHtml = `
            <div style="
                background: rgba(102,126,234,0.1);
                padding: 15px;
                border-radius: 12px;
                margin-bottom: 20px;
                text-align: center;
                font-weight: 600;
                color: #667eea;
            ">
                📊 إجمالي الحلول: ${solutions.length} |
                👨‍🎓 عدد الطلاب: ${filteredStudents.length} |
                📚 المرحلة: ${stageFilter === "all" ? "جميع المراحل" : stageFilter}
            </div>
        `;

        let solutionsHtml = '<div style="display: flex; flex-direction: column; gap: 15px;">';

        for (const sol of solutions) {
            const studentName = sol.users?.name || "طالب";
            const studentEmail = sol.users?.email || "";
            const studentStage = sol.users?.stage || "غير محدد";
            const date = new Date(sol.created_at).toLocaleDateString('ar-EG', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            const time = new Date(sol.created_at).toLocaleTimeString('ar-EG', {
                hour: '2-digit',
                minute: '2-digit'
            });
            const pdfName = sol.pdf_name || "ملف الحل";

            solutionsHtml += `
                <div style="
                    background: linear-gradient(135deg, #f5f7ff 0%, #f0f4ff 100%);
                    padding: 20px;
                    border-radius: 15px;
                    border-right: 5px solid #667eea;
                    transition: all 0.3s ease;
                ">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
                        <div>
                            <h4 style="color: #667eea; margin-bottom: 8px;">
                                👨‍🎓 ${escapeHtml(studentName)}
                            </h4>
                            <p style="color: #666; font-size: 14px;">📧 ${escapeHtml(studentEmail)}</p>
                            <p style="color: #666; font-size: 14px;">📚 المرحلة: ${escapeHtml(studentStage)}</p>
                        </div>
                        <div style="text-align: left;">
                            <p style="color: #999; font-size: 13px;">📅 ${date}</p>
                            <p style="color: #999; font-size: 13px;">⏰ ${time}</p>
                        </div>
                    </div>
                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(102,126,234,0.2);">
                        <p style="margin-bottom: 10px;">
                            <strong>📄 الواجب:</strong> ${escapeHtml(pdfName)}
                        </p>
                        <a href="${escapeHtml(sol.file_url)}" target="_blank" style="
                            display: inline-block;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            color: white;
                            padding: 10px 20px;
                            border-radius: 10px;
                            text-decoration: none;
                            font-weight: 600;
                            transition: all 0.3s ease;
                        " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                            📥 تحميل الحل
                        </a>
                    </div>
                </div>
            `;
        }

        solutionsHtml += '</div>';
        if (container) container.innerHTML = statsHtml + solutionsHtml;

    } catch (error) {
        console.error("Load students solutions error:", error);
        let container = document.getElementById("studentsSolutionsContainer");
        if (container) {
            container.innerHTML = `<p style='text-align:center; color:#ff4d4d;'>❌ حدث خطأ: ${escapeHtml(error.message)}</p>`;
        }
    }
}

/**
 * تهيئة تبويب حلول الطلاب
 */
window.initStudentsSolutionsTab = function() {
    if (document.getElementById("studentsSolutionsContainer")) {
        window.loadStudentsSolutions();
    }
}
// ================== تحميل الحلول (للمدرس) ==================
window.loadSolutions = async function() {
  try {
    let container = document.getElementById("solutionsList")
    if (!container) return

    let { data, error } = await supabase
      .from("solutions")
      .select("*, users(name, email)")
      .order("id", { ascending: false })

    container.innerHTML = ""

    if (error || !data || data.length === 0) {
      container.innerHTML = "<p>📭 مفيش حلول لحد دلوقتي</p>"
      return
    }

    data.forEach(s => {
      let studentName = s.users?.name || "طالب"
      let studentEmail = s.users?.email || ""
      container.innerHTML += `
        <div class="card" style="margin:10px 0;">
          <p>👨‍🎓 ${escapeHtml(studentName)} - ${escapeHtml(studentEmail)}</p>
          <a href="${escapeHtml(s.file_url)}" target="_blank" style="color:#4facfe;">⬇️ تحميل الحل</a>
        </div>
      `
    })

  } catch (error) {
    console.error("Load solutions error:", error)
  }
}

// ================== Tabs ==================
window.openTab = function(id, btnEl) {
  document.querySelectorAll(".tab-content").forEach(t => {
    t.style.display = "none"
    t.classList.remove("active")

    // داخل دالة openTab، بعد باقي الشروط
    if (id === "studentsSolutions" && window.loadStudentsSolutions) {
        window.loadStudentsSolutions()
    }
  })
  let el = document.getElementById(id)
  if (el) {
    el.style.display = "block"
    el.classList.add("active")
  }
  if (btnEl) {
    document.querySelectorAll(".menu-btn").forEach(b => b.classList.remove("active"))
    btnEl.classList.add("active")
  }
  // إعادة تحميل السجل عند فتح التبويب
  if (id === "loginLogsTab" && window.loadLoginLogs) {
    window.loadLoginLogs()
  }
}

// ================== Teacher Profile Navigation ==================
window.goToTeacherProfile = function() {
  if (!window.studentTeacherId) {
    alert("❌ لم يتم تعيين معلم لك")
    return
  }
  localStorage.setItem("selectedTeacherId", window.studentTeacherId)
  window.location.href = `teacher-profile.html?id=${window.studentTeacherId}`
}

window.viewTeacherProfile = function(teacherId) {
  if (!teacherId) {
    alert("❌ خطأ: لم يتم تحديد معلم")
    return
  }
  localStorage.setItem("selectedTeacherId", teacherId)
  window.location.href = `teacher-profile.html?id=${teacherId}`
}

// ================== Teacher Stages ==================
window.loadTeacherStages = async function() {
  try {
    let currentUser = getCurrentUser()
    if (!currentUser || currentUser.role !== "teacher") return

    // جلب جميع الطلاب المسجلين مع هذا المدرس
    let { data: students } = await supabase
      .from("users")
      .select("stage")
      .eq("teacher_id", currentUser.id)
      .eq("role", "student")

    if (!students || students.length === 0) return

    // استخراج المراحل الفريدة
    let stages = [...new Set(students.map(s => s.stage).filter(s => s))]

    let stageNav = document.getElementById("stageNav")
    if (!stageNav) return

    stageNav.innerHTML = ""

    stages.forEach(stage => {
      let btn = document.createElement("button")
      btn.textContent = stage
      btn.className = "stage-btn"
      btn.onclick = () => filterStudentsByStage(stage)
      stageNav.appendChild(btn)
    })

  } catch (error) {
    console.error("Load teacher stages error:", error)
  }
}

window.filterStudentsByStage = async function(stage) {
  try {
    let currentUser = getCurrentUser()
    if (!currentUser) return

    let { data: students } = await supabase
      .from("users")
      .select("*")
      .eq("teacher_id", currentUser.id)
      .eq("stage", stage)
      .eq("role", "student")

    let container = document.getElementById("stageStudents")
    if (!container) return

    container.innerHTML = ""

    if (!students || students.length === 0) {
      container.innerHTML = "<p>❌ لا يوجد طلاب في هذه المرحلة</p>"
      return
    }

    students.forEach(student => {
      container.innerHTML += `
        <div class="student-card">
          <h4>👨‍🎓 ${escapeHtml(student.name)}</h4>
          <p>${escapeHtml(student.email)}</p>
          <p>📚 ${escapeHtml(stage)}</p>
        </div>
      `
    })

  } catch (error) {
    console.error("Filter students error:", error)
  }
}

// ================== Scroll ==================
window.scrollToTop = function() {
  window.scrollTo({ top: 0, behavior: "smooth" })
}

window.scrollToBottom = function() {
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
}

// ================== Logout ==================
window.logout = function() {
  localStorage.removeItem("currentUser")
  window.location.href = "index.html"
}

// ================== Init ==================
window.addEventListener("load", function() {
  // تأمين الصفحات
  protectPage()
// صفحة المدرس - تحميل حلول الطلاب
if (document.getElementById("studentsSolutionsContainer")) {
    window.loadStudentsSolutions()
}
  // صفحة الأدمن
  if (document.getElementById("users")) {
    window.openTab("addUserTab")
    window.loadUsers()
    window.loadStats()
    window.loadTeachers()
    window.loadStages()
    window.loadLoginLogs()
  }

  // صفحة الطالب
  if (document.getElementById("noteList")) {
    window.openTab("profile")
    window.loadStudentData()
  }

  // صفحة المدرس
  if (document.getElementById("solutionsList")) {
    window.openTab("profile")
    window.loadSolutions()
    window.loadCurrentProfile()
    window.loadCurrentSocial()
    window.loadTeacherContent()
    window.loadTeacherStages()
  }

  // صفحة قوائم تشغيل المدرس
  if (document.getElementById("playlistsList")) {
    window.loadMyPlaylists()
  }

  // الصفحة الرئيسية: كروت قوائم التشغيل
  if (document.getElementById("playlistsHomeGrid")) {
    window.loadAllPlaylistsHome()
  }

  // صفحة عرض قائمة التشغيل (للطالب)
  if (document.getElementById("playlistViewer")) {
    window.loadPlaylistViewer()
  }
})

window.addTeacherContent = async function() {
  try {
    let stage = document.getElementById("contentStageSelect")?.value.trim()
    let type = document.getElementById("contentTypeSelect")?.value
    let title = document.getElementById("contentTitle")?.value.trim()
    let content = document.getElementById("contentText")?.value.trim()
    let status = document.getElementById("contentStatus")

    // التحقق من الحقول
    if (!stage || !type || !title || !content) {
      if (status) {
        status.innerText = "❗ اكتب كل البيانات"
        status.style.color = "#ff4d4d"
      }
      return
    }

    // التحقق من أن المستخدم مدرس
    let currentUser = getCurrentUser()
    if (!currentUser || currentUser.role !== "teacher") {
      if (status) {
        status.innerText = "❌ أنت لست مدرس"
        status.style.color = "#ff4d4d"
      }
      return
    }

    if (status) {
      status.innerText = "⏳ جاري الإضافة..."
      status.style.color = "#4facfe"
    }

    // إدراج البيانات في قاعدة البيانات
    let { error } = await supabase.from("teacher_content").insert([
      {
        teacher_id: currentUser.id,
        stage: stage,
        type: type,
        title: title,
        content: content,
        url: type !== "note" ? content : null,
        created_at: new Date().toISOString()
      }
    ])

    if (error) {
      if (status) {
        status.innerText = "❌ خطأ: " + error.message
        status.style.color = "#ff4d4d"
      }
      console.error("Insert error:", error)
      return
    }

    // نجاح العملية
    if (status) {
      status.innerText = "✅ تمت الإضافة بنجاح"
      status.style.color = "#25d366"
    }

    // مسح الحقول
    document.getElementById("contentTitle").value = ""
    document.getElementById("contentText").value = ""
    document.getElementById("contentTypeSelect").value = ""

    // إعادة تحميل المحتوى
    if (window.loadContentByStage) {
      setTimeout(() => {
        window.loadContentByStage(stage)
      }, 500)
    }

  } catch (error) {
    console.error("Add teacher content error:", error)
    let status = document.getElementById("contentStatus")
    if (status) {
      status.innerText = "❌ خطأ: " + error.message
      status.style.color = "#ff4d4d"
    }
  }
}

/**
 * تحميل المحتوى حسب المرحلة الدراسية
 * @param {string} stage - المرحلة الدراسية المراد تحميل محتواها
 */
window.loadContentByStage = async function(stage) {
  try {
    let currentUser = getCurrentUser()
    if (!currentUser) return

    // جلب المحتوى من قاعدة البيانات
    let { data: contents, error } = await supabase
      .from("teacher_content")
      .select("*")
      .eq("teacher_id", currentUser.id)
      .eq("stage", stage)
      .order("created_at", { ascending: false })

    let contentList = document.getElementById("contentList")
    if (!contentList) return

    contentList.innerHTML = ""

    if (error || !contents || contents.length === 0) {
      contentList.innerHTML = `
        <div style="text-align:center; color:#999; padding:40px;">
          <p style="font-size:18px;">📭 لا يوجد محتوى في هذه المرحلة</p>
        </div>
      `
      return
    }

    // عرض المحتوى
    contents.forEach(content => {
      let icon = {
        "pdf": "📄",
        "video": "🎥",
        "note": "📝"
      }[content.type] || "📋"

      let typeText = {
        "pdf": "ملف",
        "video": "فيديو",
        "note": "ملاحظة"
      }[content.type] || "محتوى"

      let dateStr = new Date(content.created_at).toLocaleDateString("ar-EG")

      contentList.innerHTML += `
        <div style="
          background: linear-gradient(135deg, #f5f7ff 0%, #f0f4ff 100%);
          padding: 20px;
          margin: 15px 0;
          border-radius: 15px;
          border-left: 5px solid #667eea;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        ">
          <h4 style="color: #667eea; margin-bottom: 8px; font-size: 18px;">
            ${icon} ${escapeHtml(content.title || "بدون عنوان")}
          </h4>
          <p style="color: #666; margin: 5px 0; font-size: 14px;">نوع: ${typeText}</p>
          <p style="color: #666; margin: 5px 0; font-size: 14px;">التاريخ: ${dateStr}</p>

          ${content.url ? `
            <a href="${escapeHtml(content.url)}" target="_blank" style="
              color: #667eea;
              text-decoration: none;
              font-weight: 600;
              display: inline-block;
              margin-top: 10px;
            ">🔗 الرابط</a>
          ` : ''}

          ${content.content && content.type === "note" ? `
            <p style="
              margin-top: 10px;
              color: #333;
              font-size: 15px;
              line-height: 1.6;
            ">${escapeHtml(content.content)}</p>
          ` : ''}

          <button onclick="window.deleteContent('${content.id}')" style="
            width: auto;
            padding: 8px 12px;
            margin-top: 10px;
            background: linear-gradient(135deg, #ff6b6b 0%, #ff5252 100%);
            border: none;
            border-radius: 8px;
            color: white;
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
            transition: all 0.3s ease;
          " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
            🗑 حذف
          </button>
        </div>
      `
    })

  } catch (error) {
    console.error("Load content error:", error)
    let contentList = document.getElementById("contentList")
    if (contentList) {
      contentList.innerHTML = `<p style="color: red;">❌ حدث خطأ في تحميل المحتوى</p>`
    }
  }
}

/**
 * حذف محتوى
 * @param {string} id - معرّف المحتوى المراد حذفه
 */
window.deleteContent = async function(id) {
  if (!confirm("هل تأكد من حذف هذا المحتوى؟")) return

  try {
    let { error } = await supabase.from("teacher_content").delete().eq("id", id)

    if (error) {
      alert("❌ خطأ في الحذف: " + error.message)
      return
    }

    alert("✅ تم الحذف بنجاح")

    // إعادة تحميل المحتوى
    let stage = document.getElementById("contentStageSelect")?.value
    if (stage && window.loadContentByStage) {
      window.loadContentByStage(stage)
    }

  } catch (error) {
    console.error("Delete error:", error)
    alert("❌ خطأ: " + error.message)
  }
}

// ================== مثال استخدام الوظائف ==================
/*

// مثال 1: إضافة محتوى جديد
// HTML:
<select id="contentStageSelect">
  <option value="الأول">الأول</option>
  <option value="الثاني">الثاني</option>
</select>

<select id="contentTypeSelect">
  <option value="pdf">PDF</option>
  <option value="video">Video</option>
  <option value="note">Note</option>
</select>

<input type="text" id="contentTitle" placeholder="عنوان المحتوى">
<textarea id="contentText" placeholder="المحتوى أو الرابط"></textarea>
<div id="contentStatus"></div>

<button onclick="addTeacherContent()">إضافة</button>

// مثال 2: عرض المحتوى
<div id="contentList"></div>

<script>
  // عند اختيار مرحلة
  document.getElementById("contentStageSelect").addEventListener("change", function() {
    window.loadContentByStage(this.value)
  })
</script>

*/



console.log("✅ وظائف إدارة محتوى المدرس تم تحميلها بنجاح")

// تحديث الإحصائيات كل 30 ثانية
setInterval(() => {
  if (document.getElementById("totalUsers")) {
    window.loadStats()
  }
}, 30000)

console.log("✅ LMS Loaded Successfully")


// ================================================================
// ================== 🎬 PLAYLISTS SYSTEM ==========================
// ================================================================

// إنشاء قائمة تشغيل جديدة (المدرس)
window.createPlaylist = async function() {
  try {
    let name = document.getElementById("playlistName")?.value.trim()
    let price = document.getElementById("playlistPrice")?.value.trim()
    let currentUser = getCurrentUser()

    if (!name) return alert("❗ اكتب اسم القائمة")
    if (!price && price !== "0") return alert("❗ اكتب سعر القائمة (0 لو مجاني)")
    if (!currentUser || currentUser.role !== "teacher") return alert("❌ لازم تكون مدرس")

    let { error } = await supabase.from("playlists").insert([{
      teacher_id: currentUser.id,
      teacher_name: currentUser.name,
      name: name,
      price: parseFloat(price) || 0
    }])

    if (error) {
      console.error("Create playlist error:", error)
      return alert("❌ خطأ: " + error.message + "\n\nتأكد إن جدول playlists موجود في قاعدة البيانات.")
    }

    document.getElementById("playlistName").value = ""
    document.getElementById("playlistPrice").value = ""
    alert("✅ تم إنشاء قائمة التشغيل")
    loadMyPlaylists()
  } catch (e) {
    console.error(e)
    alert("❌ خطأ: " + e.message)
  }
}

// تحميل قوائم المدرس الحالي
window.loadMyPlaylists = async function() {
  let container = document.getElementById("playlistsList")
  if (!container) return
  let currentUser = getCurrentUser()
  if (!currentUser) return

  container.innerHTML = "<p style='text-align:center; color:#999;'>⏳ جاري التحميل...</p>"

  let { data: playlists, error } = await supabase
    .from("playlists")
    .select("*")
    .eq("teacher_id", currentUser.id)
    .order("id", { ascending: false })

  if (error) {
    container.innerHTML = `<div style="background:#fff3cd; border:2px solid #ffc107; padding:20px; border-radius:12px; color:#856404;">
      <h4>⚠️ تعذّر تحميل القوائم</h4>
      <p>${escapeHtml(error.message)}</p>
      <p style="margin-top:10px; font-size:13px;">شغّل ملف <code>setup-database.sql</code> لإنشاء الجداول المطلوبة.</p>
    </div>`
    return
  }

  if (!playlists || playlists.length === 0) {
    container.innerHTML = "<p style='text-align:center; color:#999;'>📭 لا توجد قوائم بعد. أنشئ أول قائمة من فوق.</p>"
    return
  }

  // تحميل الفيديوهات لكل قائمة
  let { data: allVideos } = await supabase
    .from("playlist_videos")
    .select("*")
    .in("playlist_id", playlists.map(p => p.id))
    .order("id", { ascending: true })

  container.innerHTML = ""
  playlists.forEach(p => {
    let vids = (allVideos || []).filter(v => v.playlist_id === p.id)
    let vidsHtml = vids.length === 0
      ? "<p style='color:#999; font-size:13px;'>(لا فيديوهات بعد)</p>"
      : vids.map(v => `
          <div class="video-item" style="background:white; padding:10px; margin:8px 0; border-radius:8px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <span>🎥 ${escapeHtml(v.title || "بدون عنوان")}</span>
            <button onclick="window.deletePlaylistVideo('${v.id}', '${p.id}')" style="background:#ff5252; color:white; border:none; padding:5px 12px; border-radius:6px; cursor:pointer;">🗑</button>
          </div>`).join("")

    container.innerHTML += `
      <div class="playlist-card" style="background:#f8f9fa; border-radius:15px; padding:20px; margin-bottom:20px; border-right:5px solid #667eea;">
        <h3 style="color:#667eea; margin-bottom:8px;">📺 ${escapeHtml(p.name)}</h3>
        <p style="color:#666; margin-bottom:15px;">💰 السعر: <strong>${p.price > 0 ? p.price + " جنيه" : "مجاني"}</strong></p>

        <div style="background:white; padding:15px; border-radius:10px; margin-bottom:15px;">
          <h4 style="margin-bottom:10px; color:#333;">➕ إضافة فيديو</h4>
          <input type="text" id="vt_${p.id}" placeholder="عنوان الفيديو" style="width:100%; padding:10px; margin-bottom:8px; border:2px solid #e0e0e0; border-radius:8px; font-family:'Cairo', sans-serif;">
          <input type="text" id="vu_${p.id}" placeholder="رابط YouTube" style="width:100%; padding:10px; margin-bottom:8px; border:2px solid #e0e0e0; border-radius:8px; font-family:'Cairo', sans-serif;">
          <button onclick="window.addPlaylistVideo('${p.id}')" style="background:linear-gradient(135deg,#667eea,#764ba2); color:white; border:none; padding:10px 20px; border-radius:8px; cursor:pointer; font-family:'Cairo', sans-serif;">➕ إضافة</button>
        </div>

        <h4 style="margin:10px 0; color:#333;">🎬 فيديوهات القائمة (${vids.length})</h4>
        ${vidsHtml}

        <button onclick="window.deletePlaylist('${p.id}')" style="background:#ff5252; color:white; border:none; padding:10px 20px; border-radius:8px; cursor:pointer; margin-top:15px; font-family:'Cairo', sans-serif;">🗑 حذف القائمة كاملة</button>
      </div>`
  })
}

// إضافة فيديو لقائمة
window.addPlaylistVideo = async function(playlistId) {
  let title = document.getElementById("vt_" + playlistId)?.value.trim()
  let url = document.getElementById("vu_" + playlistId)?.value.trim()
  if (!title || !url) return alert("❗ اكتب العنوان والرابط")

  let { error } = await supabase.from("playlist_videos").insert([{
    playlist_id: playlistId,
    title: title,
    url: convertToEmbed(url)
  }])

  if (error) return alert("❌ خطأ: " + error.message)
  alert("✅ تم إضافة الفيديو")
  loadMyPlaylists()
}

// حذف فيديو
window.deletePlaylistVideo = async function(videoId, playlistId) {
  if (!confirm("حذف هذا الفيديو؟")) return
  let { error } = await supabase.from("playlist_videos").delete().eq("id", videoId)
  if (error) return alert("❌ " + error.message)
  loadMyPlaylists()
}

// حذف قائمة كاملة
window.deletePlaylist = async function(id) {
  if (!confirm("⚠️ سيتم حذف القائمة وكل فيديوهاتها. متأكد؟")) return
  await supabase.from("playlist_videos").delete().eq("playlist_id", id)
  let { error } = await supabase.from("playlists").delete().eq("id", id)
  if (error) return alert("❌ " + error.message)
  alert("✅ تم الحذف")
  loadMyPlaylists()
}

// عرض كل القوائم في الصفحة الرئيسية (للجميع)
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

  // عدد الفيديوهات لكل قائمة
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

// فتح قائمة تشغيل (للطالب)
window.openPlaylist = function(playlistId) {
  window.location.href = `playlist-view.html?id=${playlistId}`
}



// ================== عرض قائمة تشغيل (للطالب) ==================
window.loadPlaylistViewer = async function() {
  let viewer = document.getElementById("playlistViewer")
  if (!viewer) return

  let urlParams = new URLSearchParams(window.location.search)
  let playlistId = urlParams.get("id")
  if (!playlistId) {
    viewer.innerHTML = "<p style='color:#ff4d4d; text-align:center;'>❌ لم يتم تحديد قائمة</p>"
    return
  }

  // تحميل بيانات القائمة + الفيديوهات
  let { data: playlist } = await supabase
    .from("playlists").select("*").eq("id", playlistId).single()

  let { data: videos } = await supabase
    .from("playlist_videos").select("*").eq("playlist_id", playlistId).order("id", { ascending: true })

  if (!playlist) {
    viewer.innerHTML = "<p style='color:#ff4d4d; text-align:center;'>❌ القائمة غير موجودة</p>"
    return
  }

  let currentUser = getCurrentUser()

  // تحقق من إن الطالب رفع حل (solution)
  let canPlay = false
  let lockReason = ""

  if (!currentUser) {
    lockReason = "🔐 يجب تسجيل الدخول كطالب لمشاهدة الفيديوهات"
  } else if (currentUser.role !== "student") {
    canPlay = true   // المدرس والأدمن يقدروا يتفرجوا
  } else {
    // الطالب: لازم يكون رفع solution على الأقل مرة
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

  // عرض الفيديوهات
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

// ================== تحميل المدرسين مع التقييمات والتعليقات ==================
window.loadTeachersWithRatings = async function() {
  const container = document.getElementById('teachersGrid')
  if (!container) return

  try {
    let { data: teachers, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'teacher')

    if (error || !teachers || teachers.length === 0) {
      container.innerHTML = '<p style="color:rgba(255,255,255,0.7); grid-column:1/-1; text-align:center;">📭 لا يوجد مدرسين</p>'
      return
    }

    // تحميل التعليقات للمدرسين
    let { data: allComments } = await supabase
      .from('teacher_comments')
      .select('*')

    container.innerHTML = ''
    for (const teacher of teachers) {
      const comments = (allComments || []).filter(c => c.teacher_id === teacher.id)
      const avgRating = comments.length > 0
        ? (comments.reduce((sum, c) => sum + c.rating, 0) / comments.length).toFixed(1)
        : 0

      // آخر تعليق
      const lastComment = comments.length > 0 ? comments[0] : null
      const commentPreview = lastComment
        ? `💬 "${escapeHtml(lastComment.comment.substring(0, 50))}..."`
        : '📝 لا توجد تعليقات بعد'

      const ratingStars = avgRating > 0 ? '⭐'.repeat(Math.round(avgRating)) : '📊'

      container.innerHTML += `
        <div class="teacher-card">
          <img src="${escapeHtml(teacher.image || 'images/default-teacher.jpg')}" alt="${escapeHtml(teacher.name)}" onerror="this.src='https://via.placeholder.com/100'">
          <h3>${escapeHtml(teacher.name || 'مدرس')}</h3>
          <p>${escapeHtml(teacher.bio || 'معلم متميز')}</p>

          <div class="teacher-rating">${ratingStars} ${avgRating || 'جديد'}</div>
          <div class="teacher-comments-preview">${commentPreview}</div>

          <div class="teacher-links" style="flex-grow: 1;">
            ${teacher.social?.facebook ? `<a href="${escapeHtml(teacher.social.facebook)}" target="_blank">📘 فيسبوك</a>` : ''}
            ${teacher.social?.whatsapp ? `<a href="${escapeHtml(teacher.social.whatsapp)}" target="_blank">📱 واتساب</a>` : ''}
            ${teacher.social?.youtube ? `<a href="${escapeHtml(teacher.social.youtube)}" target="_blank">▶ يوتيوب</a>` : ''}
          </div>

          <button class="teacher-profile-btn" onclick="window.location.href='teacher-profile.html?id=${teacher.id}'">👁️ زار البروفايل</button>
        </div>
      `
    }
  } catch (error) {
    console.error('Error loading teachers:', error)
    container.innerHTML = '<p style="color:#ff4d4d; grid-column:1/-1; text-align:center;">❌ خطأ في التحميل</p>'
  }
}