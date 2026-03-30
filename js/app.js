// ================== إعداد Supabase ==================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = "https://dfxkuppxywldxsbyzfzo.supabase.co"
const supabaseKey = "sb_publishable_B3xVoCtEJtpStm76kM5KDw_WZgPsJXN"

const supabase = createClient(supabaseUrl, supabaseKey)

// ================== تسجيل دخول ==================
async function login() {
  let email = document.getElementById("email").value.trim();
  let pass = document.getElementById("password").value.trim();

  if (!email || !pass) return alert("❗ اكتب الايميل والباسورد")

  let { data, error } = await supabase
    .from("users").select("*")
    .eq("email", email).eq("password", pass).single()

  if (error || !data) return alert("❌ بيانات غلط")
  if (data.is_active === false) return alert("🚫 الحساب موقوف")

  localStorage.setItem("currentUser", JSON.stringify(data))

  if (data.role === "admin") location.href = "admin.html"
  else if (data.role === "teacher") location.href = "teacher.html"
  else if (data.role === "student") location.href = "student.html"
}

// ================== Admin - تحميل المدرسين في القائمة ==================
async function loadTeachersSelect() {
  let select = document.getElementById("teacherSelect")
  if (!select) return

  let { data: teachers } = await supabase.from("users")
    .select("id, name").eq("role", "teacher")

  select.innerHTML = `<option value="">-- اختر مدرس --</option>`
  if (teachers) teachers.forEach(t => {
    select.innerHTML += `<option value="${t.id}">${t.name}</option>`
  })
}

// إظهار/إخفاء قائمة المدرسين حسب الدور
function onRoleChange() {
  let role = document.getElementById("role").value
  let row = document.getElementById("teacherSelectRow")
  if (row) row.style.display = role === "student" ? "block" : "none"
}

// ================== Admin - إضافة مستخدم ==================
async function addUser() {
  let name = document.getElementById("name").value.trim();
  let email = document.getElementById("userEmail").value.trim();
  let pass = document.getElementById("userPass").value.trim();
  let role = document.getElementById("role").value;
  let teacherId = document.getElementById("teacherSelect")?.value || null;

  if (!name || !email || !pass) return alert("❗ اكتب كل البيانات")
  if (role === "student" && !teacherId) return alert("❗ اختار المدرس اللي هيضاف عليه الطالب")

  let { data: exists } = await supabase.from("users").select("id").eq("email", email)
  if (exists && exists.length > 0) return alert("⚠️ الايميل موجود بالفعل")

  let insertData = { name, email, password: pass, role, is_active: true }
  if (role === "student") insertData.teacher_id = teacherId

  let { error } = await supabase.from("users").insert([insertData])
  if (error) return alert("❌ حصل خطأ: " + error.message)

  alert("✅ تم إضافة المستخدم")
  document.getElementById("name").value = ""
  document.getElementById("userEmail").value = ""
  document.getElementById("userPass").value = ""
  let ts = document.getElementById("teacherSelect")
  if (ts) ts.value = ""

  loadUsers()
  loadStats()
}

function togglePass() {
  let input = document.getElementById("userPass");
  input.type = input.type === "password" ? "text" : "password";
}

// ================== Users ==================
async function loadUsers() { searchUsers() }

async function searchUsers() {
  let search = document.getElementById("search")?.value.toLowerCase() || "";
  let { data: users } = await supabase.from("users").select("*, teacher:teacher_id(name)")

  let container = document.getElementById("users")
  if (!container || !users) return
  container.innerHTML = ""

  users.forEach((u) => {
    if (u.role === "admin") return
    let match = (u.name && u.name.toLowerCase().includes(search)) || u.email.toLowerCase().includes(search)
    if (!match) return

    let teacherName = u.teacher?.name ? `<p style="color:#4facfe; font-size:13px;">👨‍🏫 ${u.teacher.name}</p>` : ""

    container.innerHTML += `
      <div class="user-card">
        <h4>${u.name || "بدون اسم"}</h4>
        <p>${u.email}</p>
        <p>👤 ${u.role === "teacher" ? "مدرس" : "طالب"}</p>
        ${u.role === "student" ? teacherName : ""}
        <p>${u.is_active ? "🟢 نشط" : "🔴 متوقف"}</p>
        <button onclick="window._toggleUser('${u.id}')">${u.is_active ? "⏸ إيقاف" : "▶️ تشغيل"}</button>
        <button onclick="window._deleteUser('${u.id}')" class="danger">🗑 حذف</button>
      </div>`
  })
}

async function deleteUser(id) {
  if (!confirm("هل متأكد من حذف المستخدم؟")) return
  let { error } = await supabase.from("users").delete().eq("id", id)
  if (error) return alert("❌ خطأ في الحذف: " + error.message)
  loadUsers(); loadStats()
}

async function toggleUser(id) {
  let { data } = await supabase.from("users").select("is_active").eq("id", id).single()
  if (!data) return
  await supabase.from("users").update({ is_active: !data.is_active }).eq("id", id)
  loadUsers()
}

// ================== Stats ==================
async function loadStats() {
  let { data: users } = await supabase.from("users").select("role")
  if (!users) return
  let el = (id) => document.getElementById(id)
  if (el("totalUsers")) el("totalUsers").innerText = users.length
  if (el("teachersCount")) el("teachersCount").innerText = users.filter(u => u.role === "teacher").length
  if (el("studentsCount")) el("studentsCount").innerText = users.filter(u => u.role === "student").length
}

// ================== Notes ==================
async function addNote() {
  let noteInput = document.getElementById("noteInput")
  let note = noteInput.value.trim()
  let currentUser = JSON.parse(localStorage.getItem("currentUser"))
  if (!note) return alert("❗ اكتب الملاحظة")
  if (!currentUser) return alert("❗ مش مسجل دخول")

  let { error } = await supabase.from("notes").insert([{ teacher_id: currentUser.id, content: note }])
  if (error) return alert("❌ خطأ: " + error.message)
  noteInput.value = ""
  alert("✅ تم النشر")
  loadTeacherContent()
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
  let input = document.getElementById("videoInput")
  let url = input.value.trim()
  let currentUser = JSON.parse(localStorage.getItem("currentUser"))
  if (!url) return alert("❗ حط رابط الفيديو")
  if (!currentUser) return alert("❗ مش مسجل دخول")

  let { error } = await supabase.from("videos").insert([{ teacher_id: currentUser.id, url: convertToEmbed(url) }])
  if (error) return alert("❌ خطأ: " + error.message)
  input.value = ""
  alert("✅ تم نشر الفيديو")
  loadTeacherContent()
}

// ================== PDF الأول ==================
async function uploadPDF() {
  let file = document.getElementById("pdfFile").files[0]
  let status = document.getElementById("status")
  let currentUser = JSON.parse(localStorage.getItem("currentUser"))
  if (!file) return (status.innerText = "❗ اختار ملف PDF")
  if (!currentUser) return (status.innerText = "❗ مش مسجل دخول")
  status.innerText = "⏳ جاري الرفع..."

  let path = "pdfs/" + currentUser.id + "_" + Date.now() + "_" + file.name.replace(/\s+/g, "_")
  let { error: uploadError } = await supabase.storage.from("files").upload(path, file, { upsert: true })
  if (uploadError) return (status.innerText = "❌ " + uploadError.message)

  let { data: urlData } = supabase.storage.from("files").getPublicUrl(path)
  let { error: dbError } = await supabase.from("pdfs").insert([
    { teacher_id: currentUser.id, file_url: urlData.publicUrl, file_name: file.name }
  ])
  if (dbError) return (status.innerText = "❌ " + dbError.message)

  status.innerText = "✅ تم النشر بنجاح"
  document.getElementById("pdfFile").value = ""
  loadTeacherContent()
}

// ================== PDF الثاني ==================
async function uploadPDF2() {
  let file = document.getElementById("pdf2File").files[0]
  let status = document.getElementById("status2")
  let currentUser = JSON.parse(localStorage.getItem("currentUser"))
  if (!file) return (status.innerText = "❗ اختار ملف PDF")
  if (!currentUser) return (status.innerText = "❗ مش مسجل دخول")
  status.innerText = "⏳ جاري الرفع..."

  let path = "pdfs2/" + currentUser.id + "_" + Date.now() + "_" + file.name.replace(/\s+/g, "_")
  let { error: uploadError } = await supabase.storage.from("files").upload(path, file, { upsert: true })
  if (uploadError) return (status.innerText = "❌ " + uploadError.message)

  let { data: urlData } = supabase.storage.from("files").getPublicUrl(path)
  let { error: dbError } = await supabase.from("pdfs2").insert([
    { teacher_id: currentUser.id, file_url: urlData.publicUrl, file_name: file.name }
  ])
  if (dbError) return (status.innerText = "❌ " + dbError.message)

  status.innerText = "✅ تم النشر بنجاح"
  document.getElementById("pdf2File").value = ""
  loadTeacherContent()
}

// ================== تحميل محتوى المدرس ==================
async function loadTeacherContent() {
  let currentUser = JSON.parse(localStorage.getItem("currentUser"))
  if (!currentUser) return

  // PDF الأول
  let pdfListTeacher = document.getElementById("pdfListTeacher")
  if (pdfListTeacher) {
    let { data: pdfs } = await supabase.from("pdfs")
      .select("*").eq("teacher_id", currentUser.id).order("id", { ascending: false })
    pdfListTeacher.innerHTML = pdfs?.length > 0 ? "" : "<p style='color:#aaa;'>مفيش ملفات</p>"
    pdfs?.forEach(p => {
      pdfListTeacher.innerHTML += `
        <div style="display:flex;align-items:center;gap:10px;margin:8px 0;padding:10px;background:#f5f7ff;border-radius:10px;">
          <a href="${p.file_url}" target="_blank" style="flex:1;color:#4facfe;">📄 ${p.file_name || "ملف"}</a>
          <button onclick="window._deletePDF('${p.id}')" style="width:auto;padding:5px 12px;background:#ff4d4d;">🗑</button>
        </div>`
    })
  }

  // PDF الثاني
  let pdf2ListTeacher = document.getElementById("pdf2ListTeacher")
  if (pdf2ListTeacher) {
    let { data: pdfs2 } = await supabase.from("pdfs2")
      .select("*").eq("teacher_id", currentUser.id).order("id", { ascending: false })
    pdf2ListTeacher.innerHTML = pdfs2?.length > 0 ? "" : "<p style='color:#aaa;'>مفيش ملفات</p>"
    pdfs2?.forEach(p => {
      pdf2ListTeacher.innerHTML += `
        <div style="display:flex;align-items:center;gap:10px;margin:8px 0;padding:10px;background:#f5f7ff;border-radius:10px;">
          <a href="${p.file_url}" target="_blank" style="flex:1;color:#4facfe;">📄 ${p.file_name || "ملف"}</a>
          <button onclick="window._deletePDF2('${p.id}')" style="width:auto;padding:5px 12px;background:#ff4d4d;">🗑</button>
        </div>`
    })
  }

  // Videos
  let videoListTeacher = document.getElementById("videoListTeacher")
  if (videoListTeacher) {
    let { data: videos } = await supabase.from("videos")
      .select("*").eq("teacher_id", currentUser.id).order("id", { ascending: false })
    videoListTeacher.innerHTML = videos?.length > 0 ? "" : "<p style='color:#aaa;'>مفيش فيديوهات</p>"
    videos?.forEach(v => {
      videoListTeacher.innerHTML += `
        <div style="margin:10px 0;">
          <iframe width="100%" height="200" src="${v.url}" allowfullscreen style="border-radius:10px;border:none;"></iframe>
          <button onclick="window._deleteVideo('${v.id}')" style="margin-top:5px;padding:5px 12px;width:auto;background:#ff4d4d;">🗑 حذف</button>
        </div>`
    })
  }

  // Notes
  let noteListTeacher = document.getElementById("noteListTeacher")
  if (noteListTeacher) {
    let { data: notes } = await supabase.from("notes")
      .select("*").eq("teacher_id", currentUser.id).order("id", { ascending: false })
    noteListTeacher.innerHTML = notes?.length > 0 ? "" : "<p style='color:#aaa;'>مفيش ملاحظات</p>"
    notes?.forEach(n => {
      noteListTeacher.innerHTML += `
        <div style="display:flex;align-items:center;gap:10px;margin:8px 0;padding:10px;background:#f5f7ff;border-radius:10px;">
          <p style="flex:1;margin:0;">📝 ${n.content}</p>
          <button onclick="window._deleteNote('${n.id}')" style="width:auto;padding:5px 12px;background:#ff4d4d;">🗑</button>
        </div>`
    })
  }
}

async function deletePDF(id) {
  if (!confirm("تحذف الملف؟")) return
  await supabase.from("pdfs").delete().eq("id", id)
  loadTeacherContent()
}
async function deletePDF2(id) {
  if (!confirm("تحذف الملف؟")) return
  await supabase.from("pdfs2").delete().eq("id", id)
  loadTeacherContent()
}
async function deleteVideo(id) {
  if (!confirm("تحذف الفيديو؟")) return
  await supabase.from("videos").delete().eq("id", id)
  loadTeacherContent()
}
async function deleteNote(id) {
  if (!confirm("تحذف الملاحظة؟")) return
  await supabase.from("notes").delete().eq("id", id)
  loadTeacherContent()
}

// ================== Profile ==================
async function saveProfile() {
  let bio = document.getElementById("bio").value.trim()
  let file = document.getElementById("imgFile").files[0]
  let currentUser = JSON.parse(localStorage.getItem("currentUser"))
  if (!currentUser) return alert("❗ مش مسجل دخول")

  let status = document.getElementById("profileStatus")
  if (status) status.innerText = "⏳ جاري الحفظ..."

  let image_url = null
  if (file) {
    let path = "profile/" + currentUser.id + "_" + file.name.replace(/\s+/g, "_")
    let { error: uploadError } = await supabase.storage.from("files").upload(path, file, { upsert: true })
    if (uploadError) return (status ? status.innerText = "❌ " + uploadError.message : alert("❌ " + uploadError.message))
    let { data: urlData } = supabase.storage.from("files").getPublicUrl(path)
    image_url = urlData.publicUrl
  }

  let { data: existing } = await supabase.from("teacher_profile")
    .select("*").eq("teacher_id", currentUser.id).single()

  let updateData = { teacher_id: currentUser.id, bio }
  if (image_url) updateData.image_url = image_url
  else if (existing?.image_url) updateData.image_url = existing.image_url

  let { error: dbError } = await supabase.from("teacher_profile").upsert([updateData])
  if (dbError) return (status ? status.innerText = "❌ " + dbError.message : alert("❌ " + dbError.message))

  if (status) status.innerText = "✅ تم حفظ البروفايل"
  loadCurrentProfile()
}

async function loadCurrentProfile() {
  let currentUser = JSON.parse(localStorage.getItem("currentUser"))
  if (!currentUser) return
  let { data } = await supabase.from("teacher_profile").select("*").eq("teacher_id", currentUser.id).single()
  if (!data) return
  let bioInput = document.getElementById("bio")
  if (bioInput) bioInput.value = data.bio || ""
  let previewDiv = document.getElementById("profilePreview")
  if (previewDiv && data.image_url)
    previewDiv.innerHTML = `<img src="${data.image_url}" style="width:100px;height:100px;border-radius:50%;object-fit:cover;border:3px solid #4facfe;margin-bottom:10px;">`
}

// ================== Social ==================
async function saveSocial() {
  let currentUser = JSON.parse(localStorage.getItem("currentUser"))
  if (!currentUser) return alert("❗ مش مسجل دخول")
  let { error } = await supabase.from("social_links").upsert([{
    teacher_id: currentUser.id,
    facebook: document.getElementById("facebook").value.trim(),
    whatsapp: document.getElementById("whatsapp").value.trim(),
    youtube: document.getElementById("youtube").value.trim()
  }])
  if (error) return alert("❌ خطأ: " + error.message)
  alert("✅ تم حفظ الروابط")
}

async function loadCurrentSocial() {
  let currentUser = JSON.parse(localStorage.getItem("currentUser"))
  if (!currentUser) return
  let { data } = await supabase.from("social_links").select("*").eq("teacher_id", currentUser.id).single()
  if (!data) return
  let fb = document.getElementById("facebook")
  let wa = document.getElementById("whatsapp")
  let yt = document.getElementById("youtube")
  if (fb) fb.value = data.facebook || ""
  if (wa) wa.value = data.whatsapp || ""
  if (yt) yt.value = data.youtube || ""
}

// ================== Student - تحميل البيانات حسب المدرس ==================
async function loadStudentData() {
  let currentUser = JSON.parse(localStorage.getItem("currentUser"))
  if (!currentUser) return

  let teacherId = currentUser.teacher_id
  if (!teacherId) return console.warn("الطالب مش مربوط بمدرس")

  // ملاحظات
  let noteList = document.getElementById("noteList")
  if (noteList) {
    let { data: notes } = await supabase.from("notes")
      .select("*").eq("teacher_id", teacherId).order("id", { ascending: false })
    noteList.innerHTML = ""
    notes?.forEach(n => {
      noteList.innerHTML += `<li style="margin:8px 0;padding:10px;background:#f5f7ff;border-radius:8px;">📝 ${n.content}</li>`
    })
  }

  // فيديوهات
  let videoContainer = document.getElementById("videoContainer")
  if (videoContainer) {
    let { data: videos } = await supabase.from("videos")
      .select("*").eq("teacher_id", teacherId).order("id", { ascending: false })
    videoContainer.innerHTML = ""
    videos?.forEach(v => {
      videoContainer.innerHTML += `
        <div style="margin:10px 0;">
          <iframe width="100%" height="220" src="${v.url}" allowfullscreen style="border-radius:10px;border:none;"></iframe>
        </div>`
    })
  }

  // PDF الأول
  let pdfList = document.getElementById("pdfList")
  if (pdfList) {
    let { data: pdfs } = await supabase.from("pdfs")
      .select("*").eq("teacher_id", teacherId).order("id", { ascending: false })
    pdfList.innerHTML = ""
    pdfs?.forEach((p, i) => {
      pdfList.innerHTML += `<li style="margin:8px 0;"><a href="${p.file_url}" target="_blank" style="color:#4facfe;">📄 ${p.file_name || "ملف " + (i+1)}</a></li>`
    })
  }

  // PDF الثاني
  let pdf2List = document.getElementById("pdf2List")
  if (pdf2List) {
    let { data: pdfs2 } = await supabase.from("pdfs2")
      .select("*").eq("teacher_id", teacherId).order("id", { ascending: false })
    pdf2List.innerHTML = ""
    pdfs2?.forEach((p, i) => {
      pdf2List.innerHTML += `<li style="margin:8px 0;"><a href="${p.file_url}" target="_blank" style="color:#4facfe;">📄 ${p.file_name || "ملف " + (i+1)}</a></li>`
    })
  }

  await loadTeacherProfile(teacherId)
}

async function loadTeacherProfile(teacherId) {
  let profileDiv = document.getElementById("teacherProfile")
  let socialDiv = document.getElementById("teacherSocial")

  let { data: profiles } = await supabase.from("teacher_profile").select("*").eq("teacher_id", teacherId)
  let { data: socials } = await supabase.from("social_links").select("*").eq("teacher_id", teacherId)

  if (profileDiv && profiles?.length > 0) {
    let p = profiles[0]
    profileDiv.innerHTML = `
      <div style="text-align:center;">
        <img src="${p.image_url}" style="width:120px;height:120px;border-radius:50%;object-fit:cover;margin-bottom:10px;border:3px solid #4facfe;">
        <p style="font-size:16px;color:#444;">${p.bio || ""}</p>
      </div>`
  }

  if (socialDiv && socials?.length > 0) {
    let s = socials[0]
    socialDiv.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${s.facebook ? `<a href="${s.facebook}" target="_blank" style="color:#1877f2;font-size:16px;">📘 فيسبوك</a>` : ""}
        ${s.whatsapp ? `<a href="${s.whatsapp}" target="_blank" style="color:#25d366;font-size:16px;">💬 واتساب</a>` : ""}
        ${s.youtube ? `<a href="${s.youtube}" target="_blank" style="color:#ff0000;font-size:16px;">▶️ يوتيوب</a>` : ""}
      </div>`
  }
}

// ================== رفع حل الطالب ==================
async function uploadSolution() {
  let file = document.getElementById("solutionFile").files[0]
  let status = document.getElementById("uploadStatus")
  let currentUser = JSON.parse(localStorage.getItem("currentUser"))
  if (!file) return (status.innerText = "❗ اختار ملف")
  if (!currentUser) return (status.innerText = "❗ مش مسجل دخول")
  status.innerText = "⏳ جاري الرفع..."

  let path = "solutions/" + Date.now() + "_" + file.name.replace(/\s+/g, "_")
  let { error: uploadError } = await supabase.storage.from("files").upload(path, file, { upsert: true })
  if (uploadError) return (status.innerText = "❌ " + uploadError.message)

  let { data: urlData } = supabase.storage.from("files").getPublicUrl(path)
  let { error: dbError } = await supabase.from("solutions").insert([
    { student_id: currentUser.id, file_url: urlData.publicUrl }
  ])
  if (dbError) return (status.innerText = "❌ " + dbError.message)

  status.innerText = "✅ تم رفع الحل بنجاح"
  document.getElementById("solutionFile").value = ""
}

// ================== تحميل الحلول للمدرس (بتاعته بس) ==================
async function loadSolutions() {
  let container = document.getElementById("solutionsList")
  if (!container) return

  let currentUser = JSON.parse(localStorage.getItem("currentUser"))
  if (!currentUser) return

  let { data: myStudents } = await supabase.from("users")
    .select("id, name, email").eq("teacher_id", currentUser.id)

  if (!myStudents || myStudents.length === 0) {
    container.innerHTML = "<p>📭 مفيش طلاب مضافين عليك</p>"
    return
  }

  let studentIds = myStudents.map(s => s.id)
  let { data, error } = await supabase.from("solutions")
    .select("*, users(name, email)")
    .in("student_id", studentIds)
    .order("id", { ascending: false })

  container.innerHTML = ""
  if (error || !data || data.length === 0) {
    container.innerHTML = "<p>📭 مفيش حلول لحد دلوقتي</p>"
    return
  }

  data.forEach(s => {
    container.innerHTML += `
      <div class="card" style="margin:10px 0;">
        <p>👨‍🎓 ${s.users?.name || "طالب"} - ${s.users?.email || ""}</p>
        <a href="${s.file_url}" target="_blank" style="color:#4facfe;">⬇️ تحميل الحل</a>
      </div>`
  })
}

// ================== Tabs ==================
function openTab(id) {
  document.querySelectorAll(".tab-content").forEach(t => t.style.display = "none")
  let el = document.getElementById(id)
  if (el) el.style.display = "block"
}

function scrollToTop() { window.scrollTo({ top: 0, behavior: "smooth" }) }
function scrollToBottom() { window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }) }

function logout() {
  localStorage.removeItem("currentUser")
  location.href = "index.html"
}

// ================== Window exports ==================
window.login = login
window.addUser = addUser
window.togglePass = togglePass
window.onRoleChange = onRoleChange
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
window.openTab = openTab
window.scrollToTop = scrollToTop
window.scrollToBottom = scrollToBottom
window.logout = logout
window._deleteUser = deleteUser
window._toggleUser = toggleUser
window._deletePDF = deletePDF
window._deletePDF2 = deletePDF2
window._deleteVideo = deleteVideo
window._deleteNote = deleteNote

// ================== Init ==================
window.onload = function () {
  if (document.getElementById("users")) {
    openTab("addUserTab")
    loadUsers()
    loadStats()
    loadTeachersSelect()
  }
  if (document.getElementById("noteList") || document.getElementById("pdfList")) {
    openTab("profile")
    loadStudentData()
  }
  if (document.getElementById("solutionsList")) {
    openTab("profile")
    loadSolutions()
    loadCurrentProfile()
    loadCurrentSocial()
    loadTeacherContent()
  }
}

console.log("🔥 Supabase Connected:", supabase)