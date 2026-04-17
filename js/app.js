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