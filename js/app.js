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
  const protectedPages = ['student.html', 'teacher.html', 'admin.html', 'teacher-profile.html', 'dashboard-home.html']

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
    if (currentPage === 'student.html' && currentUser.role !== 'student') {
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

    if (!name || !email || !pass) {
      alert("❗ اكتب كل البيانات")
      return
    }

    if (!email.includes('@')) {
      alert("❌ الايميل غير صحيح")
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

      container.innerHTML += `
        <div class="user-card">
          <h4>${escapeHtml(u.name || "بدون اسم")}</h4>
          <p>${escapeHtml(u.email)}</p>
          <p>👤 ${u.role === "teacher" ? "مدرس" : "طالب"}</p>
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

// ================== تغيير الباسورد ==================
window.goToChangePassword = function() {
  window.location.href = 'change-password.html'
}

// ================== Notes ==================
window.addNote = async function() {
  try {
    let noteInput = document.getElementById("noteInput")
    let note = noteInput?.value.trim()
    let currentUser = getCurrentUser()

    if (!note) {
      alert("❗ اكتب الملاحظة")
      return
    }
    if (!currentUser) {
      alert("❗ مش مسجل دخول")
      return
    }

    let { error } = await supabase.from("notes").insert([
      { teacher_id: currentUser.id, content: note }
    ])

    if (error) {
      alert("❌ خطأ: " + error.message)
      return
    }

    noteInput.value = ""
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
    let currentUser = getCurrentUser()

    if (!url) {
      alert("❗ حط رابط الفيديو")
      return
    }
    if (!currentUser) {
      alert("❗ مش مسجل دخول")
      return
    }

    let { error } = await supabase.from("videos").insert([
      { teacher_id: currentUser.id, url: convertToEmbed(url) }
    ])

    if (error) {
      alert("❌ خطأ: " + error.message)
      return
    }

    input.value = ""
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
    let currentUser = getCurrentUser()

    if (!file) {
      status.innerText = "❗ اختار ملف PDF"
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
      { teacher_id: currentUser.id, file_url: publicUrl, file_name: file.name }
    ])

    if (dbError) {
      status.innerText = "❌ خطأ في الحفظ: " + dbError.message
      return
    }

    status.innerText = "✅ تم النشر بنجاح"
    document.getElementById("pdfFile").value = ""
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
    let currentUser = getCurrentUser()

    if (!file) {
      status.innerText = "❗ اختار ملف PDF"
      return
    }
    if (file.type !== "application/pdf") {
      status.innerText = "❌ لازم PDF"
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
      { teacher_id: currentUser.id, file_url: data.publicUrl, file_name: file.name }
    ])

    if (dbError) {
      status.innerText = "❌ خطأ: " + dbError.message
      return
    }

    status.innerText = "✅ تم"
    document.getElementById("pdf2File").value = ""
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

    // استخدم Promise.all لتحميل سريع
    const [
      { data: pdfs },
      { data: pdfs2 },
      { data: videos },
      { data: notes }
    ] = await Promise.all([
      supabase.from("pdfs").select("*").eq("teacher_id", currentUser.id).order("id", { ascending: false }),
      supabase.from("pdfs2").select("*").eq("teacher_id", currentUser.id).order("id", { ascending: false }),
      supabase.from("videos").select("*").eq("teacher_id", currentUser.id).order("id", { ascending: false }),
      supabase.from("notes").select("*").eq("teacher_id", currentUser.id).order("id", { ascending: false })
    ])

    // PDFs الأول
    let pdfListTeacher = document.getElementById("pdfListTeacher")
    if (pdfListTeacher) {
      pdfListTeacher.innerHTML = ""
      if (pdfs && pdfs.length > 0) {
        pdfs.forEach(p => {
          pdfListTeacher.innerHTML += `
            <div style="display:flex; align-items:center; gap:10px; margin:8px 0; padding:10px; background:#f5f7ff; border-radius:10px;">
              <a href="${escapeHtml(p.file_url)}" target="_blank" style="flex:1; color:#4facfe;">📄 ${escapeHtml(p.file_name || "ملف PDF")}</a>
              <button onclick="window.deletePDF('${p.id}')" class="danger" style="width:auto; padding:5px 12px;">🗑 حذف</button>
            </div>`
        })
      } else {
        pdfListTeacher.innerHTML = "<p style='color:#aaa;'>مفيش ملفات لحد دلوقتي</p>"
      }
    }

    // PDFs الثاني
    let pdfListTeacher2 = document.getElementById("pdfListTeacher2")
    if (pdfListTeacher2) {
      pdfListTeacher2.innerHTML = ""
      if (pdfs2 && pdfs2.length > 0) {
        pdfs2.forEach(p => {
          pdfListTeacher2.innerHTML += `
            <div style="display:flex; align-items:center; gap:10px; margin:8px 0; padding:10px; background:#f5f7ff; border-radius:10px;">
              <a href="${escapeHtml(p.file_url)}" target="_blank" style="flex:1; color:#4facfe;">📄 ${escapeHtml(p.file_name || "ملف PDF")}</a>
              <button onclick="window.deletePDF2('${p.id}')" class="danger" style="width:auto; padding:5px 12px;">🗑 حذف</button>
            </div>`
        })
      } else {
        pdfListTeacher2.innerHTML = "<p style='color:#aaa;'>مفيش ملفات لحد دلوقتي</p>"
      }
    }

    // Videos
    let videoListTeacher = document.getElementById("videoListTeacher")
    if (videoListTeacher) {
      videoListTeacher.innerHTML = ""
      if (videos && videos.length > 0) {
        videos.forEach(v => {
          videoListTeacher.innerHTML += `
            <div style="margin:10px 0;">
              <iframe width="100%" height="200" src="${escapeHtml(v.url)}" allowfullscreen style="border-radius:10px; border:none;"></iframe>
              <button onclick="window.deleteVideo('${v.id}')" class="danger" style="margin-top:5px; padding:5px 12px; width:auto;">🗑 حذف</button>
            </div>`
        })
      } else {
        videoListTeacher.innerHTML = "<p style='color:#aaa;'>مفيش فيديوهات لحد دلوقتي</p>"
      }
    }

    // Notes
    let noteListTeacher = document.getElementById("noteListTeacher")
    if (noteListTeacher) {
      noteListTeacher.innerHTML = ""
      if (notes && notes.length > 0) {
        notes.forEach(n => {
          noteListTeacher.innerHTML += `
            <div style="display:flex; align-items:center; gap:10px; margin:8px 0; padding:10px; background:#f5f7ff; border-radius:10px;">
              <p style="flex:1; margin:0;">📝 ${escapeHtml(n.content)}</p>
              <button onclick="window.deleteNote('${n.id}')" class="danger" style="width:auto; padding:5px 12px;">🗑 حذف</button>
            </div>`
        })
      } else {
        noteListTeacher.innerHTML = "<p style='color:#aaa;'>مفيش ملاحظات لحد دلوقتي</p>"
      }
    }

  } catch (error) {
    console.error("Load teacher content error:", error)
  }
}

window.deletePDF = async function(id) {
  try {
    if (!confirm("تحذف الملف؟")) return

    let currentUser = getCurrentUser()
    if (!currentUser) {
      alert("❌ مش مسجل دخول")
      return
    }

    // شيك الملكية
    let { data: pdf } = await supabase.from("pdfs").select("teacher_id").eq("id", id).single()
    if (pdf?.teacher_id !== currentUser.id) {
      alert("❌ ما عندك صلاحية")
      return
    }

    await supabase.from("pdfs").delete().eq("id", id)
    alert("✅ تم الحذف")
    loadTeacherContent()

  } catch (error) {
    console.error("Delete PDF error:", error)
    alert("❌ خطأ: " + error.message)
  }
}

window.deletePDF2 = async function(id) {
  try {
    if (!confirm("تحذف الملف؟")) return

    let currentUser = getCurrentUser()
    if (!currentUser) {
      alert("❌ مش مسجل دخول")
      return
    }

    let { data: pdf } = await supabase.from("pdfs2").select("teacher_id").eq("id", id).single()
    if (pdf?.teacher_id !== currentUser.id) {
      alert("❌ ما عندك صلاحية")
      return
    }

    await supabase.from("pdfs2").delete().eq("id", id)
    alert("✅ تم الحذف")
    loadTeacherContent()

  } catch (error) {
    console.error("Delete PDF2 error:", error)
    alert("❌ خطأ: " + error.message)
  }
}

window.deleteVideo = async function(id) {
  try {
    if (!confirm("تحذف الفيديو؟")) return

    let currentUser = getCurrentUser()
    if (!currentUser) {
      alert("❌ مش مسجل دخول")
      return
    }

    let { data: video } = await supabase.from("videos").select("teacher_id").eq("id", id).single()
    if (video?.teacher_id !== currentUser.id) {
      alert("❌ ما عندك صلاحية")
      return
    }

    await supabase.from("videos").delete().eq("id", id)
    alert("✅ تم الحذف")
    loadTeacherContent()

  } catch (error) {
    console.error("Delete video error:", error)
    alert("❌ خطأ: " + error.message)
  }
}

window.deleteNote = async function(id) {
  try {
    if (!confirm("تحذف الملاحظة؟")) return

    let currentUser = getCurrentUser()
    if (!currentUser) {
      alert("❌ مش مسجل دخول")
      return
    }

    let { data: note } = await supabase.from("notes").select("teacher_id").eq("id", id).single()
    if (note?.teacher_id !== currentUser.id) {
      alert("❌ ما عندك صلاحية")
      return
    }

    await supabase.from("notes").delete().eq("id", id)
    alert("✅ تم الحذف")
    loadTeacherContent()

  } catch (error) {
    console.error("Delete note error:", error)
    alert("❌ خطأ: " + error.message)
  }
}

// ================== Profile ==================
window.saveProfile = async function() {
  try {
    let bio = document.getElementById("bio")?.value.trim()
    let file = document.getElementById("imgFile")?.files[0]
    let currentUser = getCurrentUser()

    if (!currentUser) {
      alert("❗ مش مسجل دخول")
      return
    }

    let status = document.getElementById("profileStatus")
    if (status) status.innerText = "⏳ جاري الحفظ..."

    let image_url = null

    if (file) {
      let safeName = file.name.replace(/\s+/g, "_")
      let path = "profile/" + currentUser.id + "_" + safeName

      let { error: uploadError } = await supabase.storage
        .from("files")
        .upload(path, file, { upsert: true })

      if (uploadError) {
        if (status) status.innerText = "❌ خطأ في رفع الصورة"
        alert("❌ خطأ في رفع الصورة: " + uploadError.message)
        return
      }

      let { data: urlData } = supabase.storage.from("files").getPublicUrl(path)
      image_url = urlData.publicUrl
    }

    let { data: existing } = await supabase.from("teacher_profile")
      .select("*")
      .eq("teacher_id", currentUser.id)
      .single()

    let updateData = { teacher_id: currentUser.id, bio }
    if (image_url) updateData.image_url = image_url
    else if (existing?.image_url) updateData.image_url = existing.image_url

    let { error: dbError } = await supabase.from("teacher_profile").upsert([updateData])

    if (dbError) {
      if (status) status.innerText = "❌ خطأ في الحفظ"
      alert("❌ خطأ في الحفظ: " + dbError.message)
      return
    }

    if (status) status.innerText = "✅ تم حفظ البروفايل"
    else alert("✅ تم حفظ البروفايل")

    loadCurrentProfile()

  } catch (error) {
    console.error("Save profile error:", error)
    alert("❌ خطأ: " + error.message)
  }
}

window.loadCurrentProfile = async function() {
  try {
    let currentUser = getCurrentUser()
    if (!currentUser) return

    let { data } = await supabase.from("teacher_profile")
      .select("*")
      .eq("teacher_id", currentUser.id)
      .single()

    if (!data) return

    let bioInput = document.getElementById("bio")
    if (bioInput) bioInput.value = data.bio || ""

    let previewDiv = document.getElementById("profilePreview")
    if (previewDiv && data.image_url) {
      previewDiv.innerHTML = `<img src="${escapeHtml(data.image_url)}" style="width:100px; height:100px; border-radius:50%; object-fit:cover; border:3px solid #4facfe; margin-top:10px;" alt="Profile">`
    }

  } catch (error) {
    console.error("Load profile error:", error)
  }
}

// ================== Social ==================
window.saveSocial = async function() {
  try {
    let currentUser = getCurrentUser()
    if (!currentUser) {
      alert("❗ مش مسجل دخول")
      return
    }

    let { error } = await supabase.from("social_links").upsert([
      {
        teacher_id: currentUser.id,
        facebook: document.getElementById("facebook")?.value.trim(),
        whatsapp: document.getElementById("whatsapp")?.value.trim(),
        youtube: document.getElementById("youtube")?.value.trim()
      }
    ])

    if (error) {
      alert("❌ خطأ: " + error.message)
      return
    }
    alert("✅ تم حفظ الروابط")

  } catch (error) {
    console.error("Save social error:", error)
    alert("❌ خطأ: " + error.message)
  }
}

window.loadCurrentSocial = async function() {
  try {
    let currentUser = getCurrentUser()
    if (!currentUser) return

    let { data } = await supabase.from("social_links")
      .select("*")
      .eq("teacher_id", currentUser.id)
      .single()

    if (!data) return

    let fb = document.getElementById("facebook")
    let wa = document.getElementById("whatsapp")
    let yt = document.getElementById("youtube")

    if (fb) fb.value = data.facebook || ""
    if (wa) wa.value = data.whatsapp || ""
    if (yt) yt.value = data.youtube || ""

  } catch (error) {
    console.error("Load social error:", error)
  }
}

// ================== Student - تحميل البيانات ==================
window.loadStudentData = async function() {
  try {
    let currentUser = getCurrentUser()
    if (!currentUser) return

    let { data: user } = await supabase
      .from("users")
      .select("teacher_id")
      .eq("id", currentUser.id)
      .single()

    if (!user?.teacher_id) {
      alert("❌ لم يتم تعيين معلم لك")
      return
    }

    // احفظ معرف المدرس في global variable
    window.studentTeacherId = user.teacher_id

    let teacherId = user.teacher_id

    // تحميل جميع البيانات بشكل سريع
    const [
      { data: notes },
      { data: videos },
      { data: pdfs },
      { data: pdfs2 }
    ] = await Promise.all([
      supabase.from("notes").select("*").eq("teacher_id", teacherId),
      supabase.from("videos").select("*").eq("teacher_id", teacherId),
      supabase.from("pdfs").select("*").eq("teacher_id", teacherId),
      supabase.from("pdfs2").select("*").eq("teacher_id", teacherId)
    ])

    // Notes
    let noteList = document.getElementById("noteList")
    if (noteList && notes) {
      noteList.innerHTML = ""
      if (notes.length > 0) {
        notes.forEach(n => {
          noteList.innerHTML += `<li>📝 ${escapeHtml(n.content)}</li>`
        })
      } else {
        noteList.innerHTML = "<li>مفيش ملاحظات</li>"
      }
    }

    // Videos
    let videoContainer = document.getElementById("videoContainer")
    if (videoContainer && videos) {
      videoContainer.innerHTML = ""
      if (videos.length > 0) {
        videos.forEach(v => {
          videoContainer.innerHTML += `<iframe src="${escapeHtml(v.url)}" width="100%" height="200" style="border-radius:10px; margin:10px 0; border:none;"></iframe>`
        })
      } else {
        videoContainer.innerHTML = "<p>مفيش فيديوهات</p>"
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
    await loadTeacherProfile(teacherId)

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

window.onRoleChange = function() {
  let role = document.getElementById("role")?.value
  let row = document.getElementById("teacherSelectRow")
  if (row) row.style.display = role === "student" ? "block" : "none"
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
  }
})
// تحديث الإحصائيات كل 30 ثانية
setInterval(() => {
  if (document.getElementById("totalUsers")) {
    window.loadStats()
  }
}, 30000)

console.log("✅ LMS Loaded Successfully")