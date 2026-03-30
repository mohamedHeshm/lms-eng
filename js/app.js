// ================== إعداد Supabase ==================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = "https://dfxkuppxywldxsbyzfzo.supabase.co"
const supabaseKey = "sb_publishable_B3xVoCtEJtpStm76kM5KDw_WZgPsJXN"

const supabase = createClient(supabaseUrl, supabaseKey)

// ================== تسجيل دخول ==================
window.login = async function () {
  let email = document.getElementById("email").value.trim();
  let pass = document.getElementById("password").value.trim();

  let { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .eq("password", pass)
    .single()

  if (!data) return alert("❌ بيانات غلط")
  if (data.is_active === false) return alert("🚫 الحساب موقوف")

  localStorage.setItem("currentUser", JSON.stringify(data))

  if (data.role === "admin") location.href = "admin.html"
  if (data.role === "teacher") location.href = "teacher.html"
  if (data.role === "student") location.href = "student.html"
}

// ================== Admin ==================
async function addUser() {
  let name = document.getElementById("name").value.trim();
  let email = document.getElementById("userEmail").value.trim();
  let pass = document.getElementById("userPass").value.trim();
  let role = document.getElementById("role").value;

  if (!name || !email || !pass) return alert("❗ اكتب كل البيانات")

  let { data: exists } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)

  if (exists.length > 0) return alert("⚠️ الايميل موجود")

  await supabase.from("users").insert([
    { name, email, password: pass, role, is_active: true }
  ])

  alert("✅ تم إضافة المستخدم")

  loadUsers()
  loadStats()
}

function togglePass() {
  let input = document.getElementById("userPass");
  input.type = input.type === "password" ? "text" : "password";
}

// ================== Users ==================
async function loadUsers() {
  searchUsers()
}

async function searchUsers() {
  let search = document.getElementById("search")?.value.toLowerCase() || "";
  let { data: users } = await supabase.from("users").select("*")

  let container = document.getElementById("users")
  if (!container) return

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
        <p>👤 ${u.role}</p>
        <p>${u.is_active ? "🟢 نشط" : "🔴 متوقف"}</p>

        <button onclick="toggleUser('${u.id}')">
          ${u.is_active ? "إيقاف" : "تشغيل"}
        </button>

        <button onclick="deleteUser('${u.id}')" class="danger">حذف</button>
      </div>
    `
  })
}

async function deleteUser(id) {
  await supabase.from("users").delete().eq("id", id)
  loadUsers()
  loadStats()
}

async function toggleUser(id) {
  let { data } = await supabase.from("users").select("*").eq("id", id).single()

  await supabase.from("users")
    .update({ is_active: !data.is_active })
    .eq("id", id)

  loadUsers()
}

// ================== Stats ==================
async function loadStats() {
  let { data: users } = await supabase.from("users").select("*")

  document.getElementById("totalUsers").innerText = users.length
  document.getElementById("teachersCount").innerText =
    users.filter(u => u.role === "teacher").length
  document.getElementById("studentsCount").innerText =
    users.filter(u => u.role === "student").length
}

// ================== Notes ==================
async function addNote() {
  let note = document.getElementById("noteInput").value
  let currentUser = JSON.parse(localStorage.getItem("currentUser"))

  if (!note) return alert("اكتب الملاحظة")

  await supabase.from("notes").insert([
    { teacher_id: currentUser.id, content: note }
  ])

  alert("✅ تم النشر")
}

// ================== Video ==================
function convertToEmbed(url) {
  if (url.includes("watch?v=")) return url.replace("watch?v=", "embed/")
  if (url.includes("youtu.be/")) return url.replace("youtu.be/", "youtube.com/embed/")
  return url
}

async function addVideo() {
  let input = document.getElementById("videoInput").value
  let currentUser = JSON.parse(localStorage.getItem("currentUser"))

  if (!input) return alert("حط رابط الفيديو")

  await supabase.from("videos").insert([
    { teacher_id: currentUser.id, url: convertToEmbed(input) }
  ])

  alert("✅ تم نشر الفيديو")
}

// ================== PDF ==================
async function uploadPDF() {
  let file = document.getElementById("pdfFile").files[0]
  let status = document.getElementById("status")
  let currentUser = JSON.parse(localStorage.getItem("currentUser"))

  if (!file) return status.innerText = "❗ اختار ملف"

  let path = "pdfs/" + Date.now() + file.name

  let { data, error } = await supabase.storage
    .from("files")
    .upload(path, file)

  let url = supabase.storage.from("files").getPublicUrl(path).data.publicUrl

  await supabase.from("pdfs").insert([
    { teacher_id: currentUser.id, file_url: url }
  ])

  status.innerText = "✅ تم النشر"
}

// ================== Profile ==================
async function saveProfile() {
  let bio = document.getElementById("bio").value
  let file = document.getElementById("imgFile").files[0]
  let currentUser = JSON.parse(localStorage.getItem("currentUser"))

  let path = "profile/" + Date.now() + file.name

  await supabase.storage.from("files").upload(path, file)

  let url = supabase.storage.from("files").getPublicUrl(path).data.publicUrl

  await supabase.from("teacher_profile").upsert([
    { teacher_id: currentUser.id, bio, image_url: url }
  ])

  alert("✅ تم حفظ البروفايل")
}

// ================== Social ==================
async function saveSocial() {
  let currentUser = JSON.parse(localStorage.getItem("currentUser"))

  await supabase.from("social_links").upsert([
    {
      teacher_id: currentUser.id,
      facebook: document.getElementById("facebook").value,
      whatsapp: document.getElementById("whatsapp").value,
      youtube: document.getElementById("youtube").value
    }
  ])

  alert("✅ تم حفظ الروابط")
}

// ================== Student ==================
async function loadStudentData() {
  let noteList = document.getElementById("noteList")
  let videoDiv = document.querySelector("#videos .card div")
  let pdfList = document.getElementById("pdfList")

  let { data: notes } = await supabase.from("notes").select("*")
  let { data: videos } = await supabase.from("videos").select("*")
  let { data: pdfs } = await supabase.from("pdfs").select("*")

  noteList.innerHTML = ""
  notes.reverse().forEach(n => {
    noteList.innerHTML += `<li>📝 ${n.content}</li>`
  })

  videoDiv.innerHTML = ""
  videos.forEach(v => {
    videoDiv.innerHTML += `<iframe width="300" height="200" src="${v.url}" allowfullscreen></iframe>`
  })

  pdfList.innerHTML = ""
  pdfs.forEach(p => {
    pdfList.innerHTML += `<li><a href="${p.file_url}" target="_blank">📄 تحميل</a></li>`
  })
}

// ================== Upload Solution ==================
async function uploadSolution() {
  let file = document.getElementById("solutionFile").files[0]
  let status = document.getElementById("uploadStatus")
  let currentUser = JSON.parse(localStorage.getItem("currentUser"))

  let path = "solutions/" + Date.now() + file.name

  await supabase.storage.from("files").upload(path, file)

  let url = supabase.storage.from("files").getPublicUrl(path).data.publicUrl

  await supabase.from("solutions").insert([
    { student_id: currentUser.id, file_url: url }
  ])

  status.innerText = "✅ تم رفع الحل"
}

// ================== Load Solutions ==================
async function loadSolutions() {
  let container = document.getElementById("solutionsList")
  let { data } = await supabase.from("solutions").select("*")

  container.innerHTML = ""

  data.reverse().forEach(s => {
    container.innerHTML += `
      <div class="card">
        <a href="${s.file_url}" target="_blank">⬇️ تحميل الحل</a>
      </div>
    `
  })
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

// ================== Init ==================
window.onload = function () {
  if (document.getElementById("users")) {
    loadUsers()
    loadStats()
  }

  if (document.getElementById("noteList")) {
    loadStudentData()
  }

  if (document.getElementById("solutionsList")) {
    loadSolutions()
  }
}
console.log("🔥 Supabase Connected:", supabase)
async function testConnection() {
  let { data, error } = await supabase.from("users").select("*")

  console.log("DATA:", data)
  console.log("ERROR:", error)
}

testConnection()