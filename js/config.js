/**
 * ================================================
 * ملف التكوين والثوابت
 * Configuration & Constants
 * ================================================
 */

// ================= Supabase Configuration =================

export const SUPABASE_CONFIG = {
  url: "https://dfxkuppxywldxsbyzfzo.supabase.co",
  key: "sb_publishable_B3xVoCtEJtpStm76kM5KDw_WZgPsJXN"
};

// ================= Application Constants =================

export const APP_CONFIG = {
  name: "منصة التعليم",
  version: "1.0.0",
  supportEmail: "support@platform.com"
};

// ================= Security Constants =================

export const SECURITY = {
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  maxLoginAttempts: 5,
  lockoutTime: 15 * 60 * 1000, // 15 minutes
  warningTime: 5 * 60 * 1000, // 5 minutes before logout
  passwordMinLength: 8
};

// ================= API Endpoints =================

export const API_ENDPOINTS = {
  users: '/users',
  courses: '/courses',
  lessons: '/lessons',
  assignments: '/assignments',
  submissions: '/submissions',
  grades: '/grades',
  messages: '/messages',
  announcements: '/announcements'
};

// ================= User Roles =================

export const USER_ROLES = {
  ADMIN: 'admin',
  TEACHER: 'teacher',
  STUDENT: 'student'
};

// ================= Educational Stages =================

export const EDUCATIONAL_STAGES = {
  PRIMARY: 'primary',
  MIDDLE: 'middle',
  SECONDARY: 'secondary',
  UNIVERSITY: 'university'
};

// ================= Colors Palette =================

export const COLORS = {
  primary: '#667eea',
  primaryDark: '#764ba2',
  success: '#25d366',
  warning: '#ffc107',
  danger: '#ff4d4d',
  info: '#4facfe'
};

// ================= File Upload Constants =================

export const UPLOAD_CONFIG = {
  maxFileSize: 50 * 1024 * 1024, // 50MB
  allowedImageTypes: ['image/jpeg', 'image/png'],
  allowedDocumentTypes: ['application/pdf'],
  allowedVideoTypes: ['video/mp4'],
  folders: {
    avatars: 'avatars',
    documents: 'documents',
    videos: 'videos',
    assignments: 'assignments'
  }
};

// ================= Notification Messages =================

export const MESSAGES = {
  success: {
    login: '✅ تم تسجيل الدخول بنجاح',
    logout: '✅ تم تسجيل الخروج بنجاح',
    register: '✅ تم التسجيل بنجاح',
    create: '✅ تم الإنشاء بنجاح',
    update: '✅ تم التحديث بنجاح',
    delete: '✅ تم الحذف بنجاح',
    upload: '✅ تم الرفع بنجاح'
  },
  error: {
    loginFailed: '❌ بيانات دخول خاطئة',
    invalidEmail: '❌ بريد إلكتروني غير صحيح',
    passwordMismatch: '❌ كلمات المرور غير متطابقة',
    weakPassword: '❌ كلمة المرور ضعيفة جداً',
    sessionExpired: '❌ انتهت الجلسة، يرجى تسجيل الدخول مجدداً',
    unauthorized: '❌ ليس لديك صلاحيات كافية',
    serverError: '❌ حدث خطأ في الخادم'
  },
  warning: {
    sessionWarning: '⏰ ستنتهي جلستك قريباً'
  }
};

// ================= Date Formats =================

export const DATE_FORMATS = {
  short: 'dd/MM/yyyy',
  long: 'dd MMMM yyyy',
  time: 'HH:mm:ss',
  full: 'dd MMMM yyyy HH:mm'
};

// ================= Status Badges =================

export const STATUS_COLORS = {
  pending: '#ffc107',
  approved: '#25d366',
  rejected: '#ff4d4d',
  draft: '#6c757d',
  published: '#4facfe'
};

// ================= Navigation Links =================

export const NAV_LINKS = {
  student: [
    { icon: '📊', label: 'لوحة التحكم', href: 'student-dashboard.html' },
    { icon: '📚', label: 'الكورسات', href: '#courses' },
    { icon: '✅', label: 'الواجبات', href: '#assignments' },
    { icon: '📊', label: 'الدرجات', href: '#grades' }
  ],
  teacher: [
    { icon: '📊', label: 'لوحة التحكم', href: 'teacher-dashboard.html' },
    { icon: '📚', label: 'الكورسات', href: '#courses' },
    { icon: '✅', label: 'الواجبات', href: '#assignments' },
    { icon: '👥', label: 'الطلاب', href: '#students' }
  ],
  admin: [
    { icon: '📊', label: 'لوحة التحكم', href: 'admin-dashboard.html' },
    { icon: '👥', label: 'المستخدمين', href: '#users' },
    { icon: '📚', label: 'الكورسات', href: '#courses' },
    { icon: '📋', label: 'السجلات', href: '#logs' }
  ]
};

// ================= Regular Expressions =================

export const REGEX = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
  phone: /^[0-9]{10,}$/,
  url: /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
  arabicText: /[\u0600-\u06FF]/
};

// ================= Local Storage Keys =================

export const STORAGE_KEYS = {
  currentUser: 'currentUser',
  sessionToken: 'sessionToken',
  loginTime: 'loginTime',
  theme: 'theme',
  rememberedEmail: 'rememberedEmail',
  preferences: 'preferences'
};

// ================= Cache Configuration =================

export const CACHE_CONFIG = {
  duration: 5 * 60 * 1000, // 5 minutes
  keys: {
    users: 'users_cache',
    courses: 'courses_cache',
    assignments: 'assignments_cache'
  }
};

export default {
  SUPABASE_CONFIG,
  APP_CONFIG,
  SECURITY,
  USER_ROLES,
  COLORS,
  MESSAGES
};
