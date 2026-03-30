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
}

// ================== 🔥 تحميل المدرسين ==================
async function loadTeachers() {
  let select = document.getElementById("teacherSelect")
  if (!select) return

  let { data } = await supabase
    .from("users")
    .select("id, name")
    .eq("role", "teacher")

  select.innerHTML = `<option value="">-- اختر المدرس --</option>`

  data.forEach(t => {
    select.innerHTML += `<option value="${t.id}">${t.name}</option>`
  })
}

// ================== 🔥 إظهار اختيار المدرس ==================
function onRoleChange() {
  let role = document.getElementById("role").value
  let row = document.getElementById("teacherSelectRow")
  if (row) row.style.display = role === "student" ? "block" : "none"
}

// ================== 🔥 إضافة مستخدم ==================
async function addUser() {
  let name = document.getElementById("name").value.trim();
  let email = document.getElementById("userEmail").value.trim();
  let pass = document.getElementById("userPass").value.trim();
  let role = document.getElementById("role").value;
  let teacher_id = document.getElementById("teacherSelect")?.value || null;

  if (!name || !email || !pass) return alert("❗ اكتب كل البيانات")

  let { data: exists } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)

  if (exists && exists.length > 0) return alert("⚠️ الايميل موجود بالفعل")

  let { error } = await supabase.from("users").insert([
    { name, email, password: pass, role, teacher_id, is_active: true }
  ])

  if (error) return alert("❌ حصل خطأ: " + error.message)

  alert("✅ تم إضافة المستخدم")
  loadUsers()
  loadStats()
}

// ================== Users ==================
async function loadUsers() {
  searchUsers()
}

async function searchUsers() {
  let search = document.getElementById("search")?.value.toLowerCase() || "";
  let { data: users } = await supabase.from("users").select("*")

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
        <h4>${u.name || "بدون اسم"}</h4>
        <p>${u.email}</p>
        <p>👤 ${u.role === "teacher" ? "مدرس" : "طالب"}</p>
        <p>${u.is_active ? "🟢 نشط" : "🔴 متوقف"}</p>
        <button onclick="window._toggleUser('${u.id}')">
          ${u.is_active ? "⏸ إيقاف" : "▶️ تشغيل"}
        </button>
        <button onclick="window._deleteUser('${u.id}')" class="danger">🗑 حذف</button>
      </div>
    `
  })
}

async function deleteUser(id) {
  if (!confirm("هل متأكد من حذف المستخدم؟")) return
  await supabase.from("users").delete().eq("id", id)
  loadUsers()
}

async function toggleUser(id) {
  let { data } = await supabase.from("users").select("is_active").eq("id", id).single()
  if (!data) return

  await supabase.from("users")
    .update({ is_active: !data.is_active })
    .eq("id", id)

  loadUsers()
}

// ================== Stats ==================
async function loadStats() {
  let { data: users } = await supabase.from("users").select("role")
  if (!users) return

  document.getElementById("totalUsers").innerText = users.length
  document.getElementById("teachersCount").innerText = users.filter(u => u.role === "teacher").length
  document.getElementById("studentsCount").innerText = users.filter(u => u.role === "student").length
}

// ================== PDF ==================
async function uploadPDF() {
  let file = document.getElementById("pdfFile").files[0]
  let status = document.getElementById("status")
  let currentUser = JSON.parse(localStorage.getItem("currentUser"))

  if (!file) return (status.innerText = "❗ اختار ملف PDF")
  if (file.type !== "application/pdf") return (status.innerText = "❌ لازم PDF")
  if (!currentUser) return

  status.innerText = "⏳ جاري الرفع..."

  let path = "pdfs/" + currentUser.id + "_" + Date.now()

  let { error } = await supabase.storage.from("files").upload(path, file, { upsert: true })
  if (error) return (status.innerText = error.message)

  let { data } = supabase.storage.from("files").getPublicUrl(path)

  await supabase.from("pdfs").insert([
    { teacher_id: currentUser.id, file_url: data.publicUrl, file_name: file.name }
  ])

  status.innerText = "✅ تم"
}

// ================== 🔥 تحميل بيانات الطالب ==================
async function loadStudentData() {
  let currentUser = JSON.parse(localStorage.getItem("currentUser"))

  let { data: user } = await supabase
    .from("users")
    .select("teacher_id")
    .eq("id", currentUser.id)
    .single()

  let teacherId = user.teacher_id

  // PDFs
  let { data: pdfs } = await supabase.from("pdfs")
    .select("*")
    .eq("teacher_id", teacherId)

  let pdfList = document.getElementById("pdfList")
  if (pdfList && pdfs) {
    pdfList.innerHTML = ""
    pdfs.forEach(p => {
      pdfList.innerHTML += `<li><a href="${p.file_url}" target="_blank">📄 ${p.file_name}</a></li>`
    })
  }

  // Videos
  let { data: videos } = await supabase.from("videos")
    .select("*")
    .eq("teacher_id", teacherId)

  let videoContainer = document.getElementById("videoContainer")
  if (videoContainer && videos) {
    videoContainer.innerHTML = ""
    videos.forEach(v => {
      videoContainer.innerHTML += `<iframe src="${v.url}" width="100%" height="200"></iframe>`
    })
  }

  // Notes
  let { data: notes } = await supabase.from("notes")
    .select("*")
    .eq("teacher_id", teacherId)

  let noteList = document.getElementById("noteList")
  if (noteList && notes) {
    noteList.innerHTML = ""
    notes.forEach(n => {
      noteList.innerHTML += `<li>📝 ${n.content}</li>`
    })
  }
}

// ================== Tabs ==================
function openTab(id) {
  document.querySelectorAll(".tab-content").forEach(t => t.style.display = "none")
  document.getElementById(id).style.display = "block"
}

// ================== Logout ==================
function logout() {
  localStorage.removeItem("currentUser")
  location.href = "index.html"
}

// ================== Bind ==================
window.login = login
window.addUser = addUser
window.onRoleChange = onRoleChange
window.openTab = openTab
window.logout = logout
window.loadUsers = loadUsers
window.searchUsers = searchUsers
window.loadStats = loadStats

window._deleteUser = deleteUser
window._toggleUser = toggleUser

// ================== Init ==================
window.onload = function () {
  if (document.getElementById("users")) {
    openTab("addUserTab")
    loadUsers()
    loadStats()
    loadTeachers()
  }

  if (document.getElementById("noteList")) {
    openTab("profile")
    loadStudentData()
  }
}

console.log("🔥 جاهز")