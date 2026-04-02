// ================== إعداد Supabase ==================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = "https://dfxkuppxywldxsbyzfzo.supabase.co"
const supabaseKey = "sb_publishable_B3xVoCtEJtpStm76kM5KDw_WZgPsJXN"

const supabase = createClient(supabaseUrl, supabaseKey)

// ================== Helper Functions ==================
function escapeHtml(text) {
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

// ================== تسجيل دخول ==================
async function login() {
  try {
    let email = document.getElementById("email")?.value.trim()
    let pass = document.getElementById("password")?.value.trim()

    if (!email || !pass) return alert("❗ اكتب الايميل والباسورد")

    let { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .eq("password", pass)
      .single()

    if (error || !data) return alert("❌ بيانات غلط")
    if (data.is_active === false) return alert("🚫 الحساب موقوف")

    localStorage.setItem("currentUser", JSON.stringify(data))

    if (data.role === "admin") location.href = "admin.html"
    else if (data.role === "teacher") location.href = "teacher.html"
    else if (data.role === "student") location.href = "student.html"

  } catch (error) {
    console.error("Login error:", error)
    alert("❌ حصل خطأ في تسجيل الدخول")
  }
}

// ================== Admin - إضافة مستخدم ==================
async function addUser() {
  try {
    let name = document.getElementById("name")?.value.trim()
    let email = document.getElementById("userEmail")?.value.trim()
    let pass = document.getElementById("userPass")?.value.trim()
    let role = document.getElementById("role")?.value
    let teacherId = document.getElementById("teacherSelect")?.value

    if (!name || !email || !pass) return alert("❗ اكتب كل البيانات")

    // شيك البريد موجود؟
    let { data: exists } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)

    if (exists && exists.length > 0) return alert("⚠️ الايميل موجود بالفعل")

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

    if (error) return alert("❌ حصل خطأ: " + error.message)

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

function togglePass() {
  let input = document.getElementById("userPass")
  if (input) input.type = input.type === "password" ? "text" : "password"
}

// ================== Users ==================
async function loadUsers() {
  try {
    searchUsers()
  } catch (error) {
    console.error("Error loading users:", error)
  }
}

async function searchUsers() {
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

          <button onclick="window._toggleUser('${u.id}')">
            ${u.is_active ? "⏸ إيقاف" : "▶️ تشغيل"}
          </button>

          <button onclick="window._deleteUser('${u.id}')" class="danger">🗑 حذف</button>
        </div>
      `
    })

  } catch (error) {
    console.error("Search error:", error)
  }
}

async function deleteUser(id) {
  try {
    if (!confirm("هل متأكد من حذف المستخدم؟")) return

    let currentUser = getCurrentUser()
    if (id === currentUser.id) {
      return alert("❌ لا تقدر تحذف حسابك")
    }

    let { error } = await supabase.from("users").delete().eq("id", id)
    if (error) return alert("❌ خطأ في الحذف: " + error.message)

    loadUsers()
    loadStats()

  } catch (error) {
    console.error("Delete error:", error)
    alert("❌ خطأ: " + error.message)
  }
}

async function toggleUser(id) {
  try {
    let { data } = await supabase.from("users").select("is_active").eq("id", id).single()
    if (!data) return

    await supabase.from("users")
      .update({ is_active: !data.is_active })
      .eq("id", id)

    loadUsers()

  } catch (error) {
    console.error("Toggle error:", error)
  }
}

// ================== Stats ==================
async function loadStats() {
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

// ================== Notes ==================
async function addNote() {
  try {
    let noteInput = document.getElementById("noteInput")
    let note = noteInput?.value.trim()
    let currentUser = getCurrentUser()

    if (!note) return alert("❗ اكتب الملاحظة")
    if (!currentUser) return alert("❗ مش مسجل دخول")

    let { error } = await supabase.from("notes").insert([
      { teacher_id: currentUser.id, content: note }
    ])

    if (error) return alert("❌ خطأ: " + error.message)

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

async function addVideo() {
  try {
    let input = document.getElementById("videoInput")
    let url = input?.value.trim()
    let currentUser = getCurrentUser()

    if (!url) return alert("❗ حط رابط الفيديو")
    if (!currentUser) return alert("❗ مش مسجل دخول")

    let { error } = await supabase.from("videos").insert([
      { teacher_id: currentUser.id, url: convertToEmbed(url) }
    ])

    if (error) return alert("❌ خطأ: " + error.message)

    input.value = ""
    alert("✅ تم نشر الفيديو")
    loadTeacherContent()

  } catch (error) {
    console.error("Add video error:", error)
    alert("❌ خطأ: " + error.message)
  }
}

// ================== PDF ==================
async function uploadPDF() {
  try {
    let file = document.getElementById("pdfFile")?.files[0]
    let status = document.getElementById("status")
    let currentUser = getCurrentUser()

    if (!file) return (status.innerText = "❗ اختار ملف PDF")
    if (!currentUser) return (status.innerText = "❗ مش مسجل دخول")

    status.innerText = "⏳ جاري الرفع..."

    let safeName = file.name.replace(/\s+/g, "_")
    let path = "pdfs/" + currentUser.id + "_" + Date.now() + "_" + safeName

    let { data: uploadData, error: uploadError } = await supabase.storage
      .from("files")
      .upload(path, file, { upsert: true })

    if (uploadError) return (status.innerText = "❌ خطأ في الرفع: " + uploadError.message)

    let { data: urlData } = supabase.storage.from("files").getPublicUrl(path)
    let publicUrl = urlData.publicUrl

    let { error: dbError } = await supabase.from("pdfs").insert([
      { teacher_id: currentUser.id, file_url: publicUrl, file_name: file.name }
    ])

    if (dbError) return (status.innerText = "❌ خطأ في الحفظ: " + dbError.message)

    status.innerText = "✅ تم النشر بنجاح"
    document.getElementById("pdfFile").value = ""
    loadTeacherContent()

  } catch (error) {
    console.error("Upload PDF error:", error)
    let status = document.getElementById("status")
    status.innerText = "❌ خطأ: " + error.message
  }
}

async function uploadPDF2() {
  try {
    let file = document.getElementById("pdf2File")?.files[0]
    let status = document.getElementById("status2")
    let currentUser = getCurrentUser()

    if (!file) return (status.innerText = "❗ اختار ملف PDF")
    if (file.type !== "application/pdf") return (status.innerText = "❌ لازم PDF")
    if (!currentUser) return (status.innerText = "❗ مش مسجل دخول")

    status.innerText = "⏳ جاري الرفع..."

    let path = "pdfs2/" + currentUser.id + "_" + Date.now() + "_" + file.name

    let { error } = await supabase.storage.from("files").upload(path, file, { upsert: true })
    if (error) return (status.innerText = "❌ " + error.message)

    let { data } = supabase.storage.from("files").getPublicUrl(path)

    let { error: dbError } = await supabase.from("pdfs2").insert([
      { teacher_id: currentUser.id, file_url: data.publicUrl, file_name: file.name }
    ])

    if (dbError) return (status.innerText = "❌ خطأ: " + dbError.message)

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
async function loadTeacherContent() {
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
              <button onclick="window._deletePDF('${p.id}')" style="width:auto; padding:5px 12px; background:#ff4d4d; color:white; border:none; border-radius:6px; cursor:pointer;">🗑 حذف</button>
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
              <button onclick="window._deletePDF2('${p.id}')" style="width:auto; padding:5px 12px; background:#ff4d4d; color:white; border:none; border-radius:6px; cursor:pointer;">🗑 حذف</button>
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
              <button onclick="window._deleteVideo('${v.id}')" style="margin-top:5px; padding:5px 12px; width:auto; background:#ff4d4d; color:white; border:none; border-radius:6px; cursor:pointer;">🗑 حذف</button>
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
              <button onclick="window._deleteNote('${n.id}')" style="width:auto; padding:5px 12px; background:#ff4d4d; color:white; border:none; border-radius:6px; cursor:pointer;">🗑 حذف</button>
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

async function deletePDF(id) {
  try {
    if (!confirm("تحذف الملف؟")) return

    let currentUser = getCurrentUser()
    if (!currentUser) return alert("❌ مش مسجل دخول")

    // شيك الملكية
    let { data: pdf } = await supabase.from("pdfs").select("teacher_id").eq("id", id).single()
    if (pdf?.teacher_id !== currentUser.id) return alert("❌ ما عندك صلاحية")

    await supabase.from("pdfs").delete().eq("id", id)
    loadTeacherContent()

  } catch (error) {
    console.error("Delete PDF error:", error)
    alert("❌ خطأ: " + error.message)
  }
}

async function deletePDF2(id) {
  try {
    if (!confirm("تحذف الملف؟")) return

    let currentUser = getCurrentUser()
    if (!currentUser) return alert("❌ مش مسجل دخول")

    let { data: pdf } = await supabase.from("pdfs2").select("teacher_id").eq("id", id).single()
    if (pdf?.teacher_id !== currentUser.id) return alert("❌ ما عندك صلاحية")

    await supabase.from("pdfs2").delete().eq("id", id)
    loadTeacherContent()

  } catch (error) {
    console.error("Delete PDF2 error:", error)
    alert("❌ خطأ: " + error.message)
  }
}

async function deleteVideo(id) {
  try {
    if (!confirm("تحذف الفيديو؟")) return

    let currentUser = getCurrentUser()
    if (!currentUser) return alert("❌ مش مسجل دخول")

    let { data: video } = await supabase.from("videos").select("teacher_id").eq("id", id).single()
    if (video?.teacher_id !== currentUser.id) return alert("❌ ما عندك صلاحية")

    await supabase.from("videos").delete().eq("id", id)
    loadTeacherContent()

  } catch (error) {
    console.error("Delete video error:", error)
  }
}

async function deleteNote(id) {
  try {
    if (!confirm("تحذف الملاحظة؟")) return

    let currentUser = getCurrentUser()
    if (!currentUser) return alert("❌ مش مسجل دخول")

    let { data: note } = await supabase.from("notes").select("teacher_id").eq("id", id).single()
    if (note?.teacher_id !== currentUser.id) return alert("❌ ما عندك صلاحية")

    await supabase.from("notes").delete().eq("id", id)
    loadTeacherContent()

  } catch (error) {
    console.error("Delete note error:", error)
  }
}

// ================== Profile ==================
async function saveProfile() {
  try {
    let bio = document.getElementById("bio")?.value.trim()
    let file = document.getElementById("imgFile")?.files[0]
    let currentUser = getCurrentUser()

    if (!currentUser) return alert("❗ مش مسجل دخول")

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
        if (status) status.innerText = "❌ خطأ في رفع الصورة: " + uploadError.message
        return alert("❌ خطأ في رفع الصورة: " + uploadError.message)
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
      return alert("❌ خطأ في الحفظ: " + dbError.message)
    }

    if (status) status.innerText = "✅ تم حفظ البروفايل"
    else alert("✅ تم حفظ البروفايل")

    loadCurrentProfile()

  } catch (error) {
    console.error("Save profile error:", error)
    alert("❌ خطأ: " + error.message)
  }
}

async function loadCurrentProfile() {
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
async function saveSocial() {
  try {
    let currentUser = getCurrentUser()
    if (!currentUser) return alert("❗ مش مسجل دخول")

    let { error } = await supabase.from("social_links").upsert([
      {
        teacher_id: currentUser.id,
        facebook: document.getElementById("facebook")?.value.trim(),
        whatsapp: document.getElementById("whatsapp")?.value.trim(),
        youtube: document.getElementById("youtube")?.value.trim()
      }
    ])

    if (error) return alert("❌ خطأ: " + error.message)
    alert("✅ تم حفظ الروابط")

  } catch (error) {
    console.error("Save social error:", error)
    alert("❌ خطأ: " + error.message)
  }
}

async function loadCurrentSocial() {
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
async function loadStudentData() {
  try {
    let currentUser = getCurrentUser()
    if (!currentUser) return

    let { data: user } = await supabase
      .from("users")
      .select("teacher_id")
      .eq("id", currentUser.id)
      .single()

    if (!user?.teacher_id) return alert("❌ مش موجود معلم متربوط بك")

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
          videoContainer.innerHTML += `<iframe src="${escapeHtml(v.url)}" width="100%" height="200" style="border-radius:10px; margin:10px 0;"></iframe>`
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

async function loadTeachers() {
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

function onRoleChange() {
  let role = document.getElementById("role")?.value
  let row = document.getElementById("teacherSelectRow")
  if (row) row.style.display = role === "student" ? "block" : "none"
}

async function loadTeacherProfile(teacherId) {
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
async function uploadSolution() {
  try {
    let file = document.getElementById("solutionFile")?.files[0]
    let status = document.getElementById("uploadStatus")
    let currentUser = getCurrentUser()

    if (!file) return (status.innerText = "❗ اختار ملف")
    if (!currentUser) return (status.innerText = "❗ مش مسجل دخول")

    status.innerText = "⏳ جاري الرفع..."

    let safeName = file.name.replace(/\s+/g, "_")
    let path = "solutions/" + currentUser.id + "_" + Date.now() + "_" + safeName

    let { error: uploadError } = await supabase.storage.from("files").upload(path, file)
    if (uploadError) return (status.innerText = "❌ خطأ في الرفع: " + uploadError.message)

    let { data: urlData } = supabase.storage.from("files").getPublicUrl(path)

    let { error: dbError } = await supabase.from("solutions").insert([
      { student_id: currentUser.id, file_url: urlData.publicUrl }
    ])

    if (dbError) return (status.innerText = "❌ خطأ في الحفظ: " + dbError.message)

    status.innerText = "✅ تم رفع الحل بنجاح"
    document.getElementById("solutionFile").value = ""

  } catch (error) {
    console.error("Upload solution error:", error)
    let status = document.getElementById("uploadStatus")
    status.innerText = "❌ خطأ: " + error.message
  }
}

// ================== تحميل الحلول (للمدرس) ==================
async function loadSolutions() {
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
function openTab(id) {
  document.querySelectorAll(".tab-content").forEach(t => t.style.display = "none")
  let el = document.getElementById(id)
  if (el) el.style.display = "block"
}

// ================== Scroll ==================
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" })
}

function scrollToBottom() {
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
}

// ================== Logout ==================
function logout() {
  localStorage.removeItem("currentUser")
  location.href = "index.html"
}

// ================== Export to Window ==================
window.login = login
window.addUser = addUser
window.togglePass = togglePass
window.searchUsers = searchUsers
window.loadUsers = loadUsers
window.loadStats = loadStats
window.addNote = addNote
window.addVideo = addVideo
window.uploadPDF = uploadPDF
window.uploadPDF2 = uploadPDF2
window.saveProfile = saveProfile
window.saveSocial = saveSocial
window.uploadSolution = uploadSolution
window.loadSolutions = loadSolutions
window.loadTeacherContent = loadTeacherContent
window.loadStudentData = loadStudentData
window.loadTeachers = loadTeachers
window.onRoleChange = onRoleChange
window.openTab = openTab
window.scrollToTop = scrollToTop
window.scrollToBottom = scrollToBottom
window.logout = logout
window.loadCurrentProfile = loadCurrentProfile
window.loadCurrentSocial = loadCurrentSocial

// دوال داخلية
window._deleteUser = deleteUser
window._toggleUser = toggleUser
window._deletePDF = deletePDF
window._deletePDF2 = deletePDF2
window._deleteVideo = deleteVideo
window._deleteNote = deleteNote

// ================== Init ==================
window.addEventListener("load", function() {
  // صفحة الأدمن
  if (document.getElementById("users")) {
    openTab("addUserTab")
    loadUsers()
    loadStats()
    loadTeachers()
  }

  // صفحة الطالب
  if (document.getElementById("noteList")) {
    openTab("profile")
    loadStudentData()
  }

  // صفحة المدرس
  if (document.getElementById("solutionsList")) {
    openTab("profile")
    loadSolutions()
    loadCurrentProfile()
    loadCurrentSocial()
    loadTeacherContent()
  }
})
window.goToTeacherProfile = function() {
  const teacherId = localStorage.getItem("selectedTeacherId")

  if (!teacherId) {
    alert("❌ ناسف هناك تحديث")
    return
  }

  window.location.href = `teacher-profile.html?id=${teacherId}`
}

console.log("✅ LMS Loaded Successfully")