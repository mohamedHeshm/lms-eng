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

    // حفظ سجل الدخول
    await supabase.from("login_logs").insert([
      {
        user_id: data.id,
        user_name: data.name,
        user_email: data.email,
        user_role: data.role,
        login_time: new Date().toISOString()
      }
    ])

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
  try {
    let { data: logs, error } = await supabase
      .from("login_logs")
      .select("*")
      .order("login_time", { ascending: false })

    if (error) {
      console.error("Login logs error:", error)
      return
    }

    allLoginLogs = logs || []
    displayLoginLogs('all')

  } catch (error) {
    console.error("Load login logs error:", error)
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
window.uploadSolution = async function() {
  try {
    let file = document.getElementById("solutionFile")?.files[0]
    let status = document.getElementById("uploadStatus")
    let currentUser = getCurrentUser()

    if (!file) {
      status.innerText = "❗ اختار ملف"
      return
    }
    if (!currentUser) {
      status.innerText = "❗ مش مسجل دخول"
      return
    }

    status.innerText = "⏳ جاري الرفع..."

    let safeName = file.name.replace(/\s+/g, "_")
    let path = "solutions/" + currentUser.id + "_" + Date.now() + "_" + safeName

    let { error: uploadError } = await supabase.storage.from("files").upload(path, file)
    if (uploadError) {
      status.innerText = "❌ خطأ في الرفع: " + uploadError.message
      return
    }

    let { data: urlData } = supabase.storage.from("files").getPublicUrl(path)

    let { error: dbError } = await supabase.from("solutions").insert([
      { student_id: currentUser.id, file_url: urlData.publicUrl }
    ])

    if (dbError) {
      status.innerText = "❌ خطأ في الحفظ: " + dbError.message
      return
    }

    status.innerText = "✅ تم رفع الحل بنجاح"
    document.getElementById("solutionFile").value = ""

  } catch (error) {
    console.error("Upload solution error:", error)
    let status = document.getElementById("uploadStatus")
    status.innerText = "❌ خطأ: " + error.message
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
window.openTab = function(id) {
  document.querySelectorAll(".tab-content").forEach(t => {
    t.style.display = "none"
    t.classList.remove("active")
  })
  let el = document.getElementById(id)
  if (el) {
    el.style.display = "block"
    el.classList.add("active")
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

    // حفظ سجل الدخول
    await supabase.from("login_logs").insert([
      {
        user_id: data.id,
        user_name: data.name,
        user_email: data.email,
        user_role: data.role,
        login_time: new Date().toISOString()
      }
    ])

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

// ================== تسجيل الخروج ==================
window.logout = function() {
  if (confirm("هل متأكد من تسجيل الخروج؟")) {
    localStorage.removeItem("currentUser")
    window.location.href = "index.html"
  }
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

    if (!role) {
      alert("❌ يجب اختيار الدور")
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
    document.getElementById("role").value = ""
    document.getElementById("stageSelect").value = ""
    document.getElementById("teacherSelect").value = ""

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
  try {
    let { data: logs, error } = await supabase
      .from("login_logs")
      .select("*")
      .order("login_time", { ascending: false })

    if (error) {
      console.error("Login logs error:", error)
      return
    }

    allLoginLogs = logs || []
    displayLoginLogs('all')

  } catch (error) {
    console.error("Load login logs error:", error)
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

// ================== Tab Navigation ==================
window.openTab = function(tabName) {
  let tabs = document.querySelectorAll(".tab-content")
  tabs.forEach(tab => tab.classList.remove("active"))

  let selectedTab = document.getElementById(tabName)
  if (selectedTab) selectedTab.classList.add("active")
}

// ================== Scroll Functions ==================
window.scrollToTop = function() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

window.scrollToBottom = function() {
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
}

// ================== تغيير الباسورد ==================
window.goToChangePassword = function() {
  window.location.href = 'change-password.html'
}

// ================== Teachers List ==================
window.loadTeachers = async function() {
  try {
    let { data: teachers } = await supabase
      .from("users")
      .select("id, name")
      .eq("role", "teacher")

    let select = document.getElementById("teacherSelect")
    if (!select) return

    select.innerHTML = '<option value="">اختر المدرس</option>'
    teachers?.forEach(t => {
      select.innerHTML += `<option value="${t.id}">${escapeHtml(t.name)}</option>`
    })
  } catch (error) {
    console.error("Load teachers error:", error)
  }
}

// ================== Stages List ==================
window.loadStages = async function() {
  try {
    const stages = [
      'الأولى الابتدائي',
      'الثانية الابتدائي',
      'الثالثة الابتدائي',
      'الأولى الإعدادي',
      'الثانية الإعدادي',
      'الثالثة الإعدادي',
      'الأولى الثانوي',
      'الثانية الثانوي',
      'الثالثة الثانوي'
    ]

    let select = document.getElementById("stageSelect")
    if (!select) return

    select.innerHTML = '<option value="">اختر المرحلة الدراسية</option>'
    stages.forEach(stage => {
      select.innerHTML += `<option value="${stage}">${stage}</option>`
    })
  } catch (error) {
    console.error("Load stages error:", error)
  }
}

// ================== Teacher Functions ==================

// تحميل المراحل الدراسية للمدرس
window.loadTeacherStages = async function() {
  try {
    const stages = [
      'الأولى الابتدائي',
      'الثانية الابتدائي',
      'الثالثة الابتدائي',
      'الأولى الإعدادي',
      'الثانية الإعدادي',
      'الثالثة الإعدادي',
      'الأولى الثانوي',
      'الثانية الثانوي',
      'الثالثة الثانوي'
    ]

    let stageNav = document.getElementById("stageNav")
    if (!stageNav) return

    stageNav.innerHTML = ""
    stages.forEach(stage => {
      stageNav.innerHTML += `
        <button class="stage-btn" onclick="window.loadContentByStage('${stage}')" style="margin-bottom: 8px;">
          📚 ${stage}
        </button>
      `
    })
  } catch (error) {
    console.error("Load stages error:", error)
  }
}

// ================== Student - عرض المحتوى حسب المرحلة ==================
window.loadStudentData = async function() {
  try {
    let currentUser = getCurrentUser()
    if (!currentUser) {
      console.log("لا يوجد مستخدم")
      return
    }

    console.log("بيانات المستخدم:", currentUser)
    console.log("مرحلة الطالب:", currentUser.stage)

    // جلب جميع المحتوى الخاص بمرحلة الطالب فقط
    let { data: notes, error: notesError } = await supabase
      .from("notes")
      .select("*")
      .eq("stage", currentUser.stage)
      .order("created_at", { ascending: false })

    let { data: videos, error: videosError } = await supabase
      .from("videos")
      .select("*")
      .eq("stage", currentUser.stage)
      .order("created_at", { ascending: false })

    let { data: pdfs, error: pdfsError } = await supabase
      .from("pdfs")
      .select("*")
      .eq("stage", currentUser.stage)
      .order("created_at", { ascending: false })

    let { data: pdfs2, error: pdfs2Error } = await supabase
      .from("pdfs2")
      .select("*")
      .eq("stage", currentUser.stage)
      .order("created_at", { ascending: false })

    // عرض الملاحظات
    let noteList = document.getElementById("noteList")
    if (noteList) {
      noteList.innerHTML = ""
      if (notes && notes.length > 0) {
        notes.forEach(note => {
          let date = new Date(note.created_at).toLocaleDateString('ar-EG')
          noteList.innerHTML += `
            <div style="
              background: linear-gradient(135deg, #f5f7ff 0%, #f0f4ff 100%);
              padding: 20px;
              margin: 15px 0;
              border-radius: 15px;
              border-left: 5px solid #667eea;
              transition: all 0.3s ease;
            ">
              <h4 style="color: #667eea; margin-bottom: 8px;">📝 ملاحظة</h4>
              <p style="color: #333; margin: 10px 0; line-height: 1.6;">${escapeHtml(note.content)}</p>
              <p style="color: #999; font-size: 12px;">📅 ${date}</p>
            </div>
          `
        })
      } else {
        noteList.innerHTML = "<p style='text-align:center; color:#999;'>📭 لا توجد ملاحظات</p>"
      }
    }

    // عرض الفيديوهات
    let videoList = document.getElementById("videoList")
    if (videoList) {
      videoList.innerHTML = ""
      if (videos && videos.length > 0) {
        videos.forEach(video => {
          let date = new Date(video.created_at).toLocaleDateString('ar-EG')
          videoList.innerHTML += `
            <div style="
              background: linear-gradient(135deg, #f5f7ff 0%, #f0f4ff 100%);
              padding: 20px;
              margin: 15px 0;
              border-radius: 15px;
              border-left: 5px solid #667eea;
            ">
              <h4 style="color: #667eea; margin-bottom: 8px;">🎥 فيديو</h4>
              <iframe width="100%" height="300" src="${video.url}" title="فيديو" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
              <p style="color: #999; font-size: 12px; margin-top: 10px;">📅 ${date}</p>
            </div>
          `
        })
      } else {
        videoList.innerHTML = "<p style='text-align:center; color:#999;'>📭 لا توجد فيديوهات</p>"
      }
    }

    // عرض الواجبات (PDFs)
    let pdfList = document.getElementById("pdfList")
    if (pdfList) {
      pdfList.innerHTML = ""
      if (pdfs && pdfs.length > 0) {
        pdfs.forEach(pdf => {
          let date = new Date(pdf.created_at).toLocaleDateString('ar-EG')
          pdfList.innerHTML += `
            <div style="
              background: linear-gradient(135deg, #f5f7ff 0%, #f0f4ff 100%);
              padding: 20px;
              margin: 15px 0;
              border-radius: 15px;
              border-left: 5px solid #667eea;
            ">
              <h4 style="color: #667eea; margin-bottom: 8px;">📄 ${escapeHtml(pdf.file_name)}</h4>
              <a href="${pdf.file_url}" target="_blank" style="
                display: inline-block;
                margin: 10px 0;
                padding: 10px 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border-radius: 8px;
                text-decoration: none;
                font-weight: 600;
              ">📥 تحميل</a>
              <p style="color: #999; font-size: 12px; margin-top: 10px;">📅 ${date}</p>
            </div>
          `
        })
      } else {
        pdfList.innerHTML = "<p style='text-align:center; color:#999;'>📭 لا توجد واجبات</p>"
      }
    }

    // عرض المذكرات (PDFs2)
    let pdf2List = document.getElementById("pdf2List")
    if (pdf2List) {
      pdf2List.innerHTML = ""
      if (pdfs2 && pdfs2.length > 0) {
        pdfs2.forEach(pdf => {
          let date = new Date(pdf.created_at).toLocaleDateString('ar-EG')
          pdf2List.innerHTML += `
            <div style="
              background: linear-gradient(135deg, #f5f7ff 0%, #f0f4ff 100%);
              padding: 20px;
              margin: 15px 0;
              border-radius: 15px;
              border-left: 5px solid #667eea;
            ">
              <h4 style="color: #667eea; margin-bottom: 8px;">📚 ${escapeHtml(pdf.file_name)}</h4>
              <a href="${pdf.file_url}" target="_blank" style="
                display: inline-block;
                margin: 10px 0;
                padding: 10px 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border-radius: 8px;
                text-decoration: none;
                font-weight: 600;
              ">📥 تحميل</a>
              <p style="color: #999; font-size: 12px; margin-top: 10px;">📅 ${date}</p>
            </div>
          `
        })
      } else {
        pdf2List.innerHTML = "<p style='text-align:center; color:#999;'>📭 لا توجد مذكرات</p>"
      }
    }

  } catch (error) {
    console.error("Load student data error:", error)
  }
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

  } catch (error) {
    console.error("Upload PDF error:", error)
    let status = document.getElementById("status")
    if (status) status.innerText = "❌ خطأ: " + error.message
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
      status.innerText = "❌ " + dbError.message
      return
    }

    status.innerText = "✅ تم النشر بنجاح"
    document.getElementById("pdf2File").value = ""
    stageSelect.value = ""

  } catch (error) {
    console.error("Upload PDF2 error:", error)
    let status = document.getElementById("status2")
    if (status) status.innerText = "❌ " + error.message
  }
}

// ================== Initialization ==================
document.addEventListener("DOMContentLoaded", function() {
  protectPage()

  // صفحة الأدمن
  if (document.getElementById("totalUsers")) {
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
    window.loadTeacherStages()
  }
})

console.log("✅ LMS Loaded Successfully - Fixed Version")
console.log("✅ LMS Loaded Successfully")
