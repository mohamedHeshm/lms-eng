/**
 * ================================================
 * نظام إدارة البيانات والخدمات
 * Data Management & Services System
 * ================================================
 */

import { supabase } from './auth.js';
import AuthService from './auth.js';
import { UI } from './ui.js';

// ================= Data Service =================

class DataService {
  static cache = new Map();
  static cacheTimeout = 5 * 60 * 1000; // 5 minutes

  /**
   * Get from cache
   */
  static getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  /**
   * Set cache
   */
  static setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Clear cache
   */
  static clearCache(key = null) {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get users with filters
   */
  static async getUsers(filters = {}) {
    try {
      let query = supabase.from('users').select('*');

      if (filters.role) query = query.eq('role', filters.role);
      if (filters.stage) query = query.eq('stage', filters.stage);
      if (filters.teacher_id) query = query.eq('teacher_id', filters.teacher_id);
      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching users:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get user by ID
   */
  static async getUserById(id) {
    try {
      const cacheKey = `user_${id}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) return { success: true, data: cached };

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      this.setCache(cacheKey, data);
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching user:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update user
   */
  static async updateUser(id, updates) {
    try {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Clear cache
      this.clearCache(`user_${id}`);
      this.clearCache('all_users');

      // Log activity
      await AuthService.logActivity('user_update', {
        targetUser: id,
        changes: Object.keys(updates)
      });

      return { success: true, data };
    } catch (error) {
      console.error('Error updating user:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete user
   */
  static async deleteUser(id) {
    try {
      // First, ask for confirmation
      const confirmed = await UI.confirm('هل أنت متأكد من حذف هذا المستخدم؟');
      if (!confirmed) return { success: false };

      const { error } = await supabase
        .from('users')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      // Clear cache
      this.clearCache(`user_${id}`);
      this.clearCache('all_users');

      // Log activity
      await AuthService.logActivity('user_delete', { targetUser: id });

      UI.toast('تم حذف المستخدم بنجاح', 'success');
      return { success: true };
    } catch (error) {
      console.error('Error deleting user:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get courses
   */
  static async getCourses(filters = {}) {
    try {
      let query = supabase.from('courses').select('*, teacher:teacher_id(name)');

      if (filters.teacher_id) query = query.eq('teacher_id', filters.teacher_id);
      if (filters.search) query = query.ilike('title', `%${filters.search}%`);

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching courses:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get course by ID
   */
  static async getCourseById(id) {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select(`
          *,
          teacher:teacher_id(name, avatar),
          lessons(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching course:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create course
   */
  static async createCourse(courseData) {
    try {
      const user = AuthService.getCurrentUser();
      if (!user) throw new Error('يجب تسجيل الدخول أولاً');

      const { data, error } = await supabase
        .from('courses')
        .insert([{
          ...courseData,
          teacher_id: user.id,
          created_at: new Date()
        }])
        .select()
        .single();

      if (error) throw error;

      this.clearCache('all_courses');
      UI.toast('تم إنشاء الكورس بنجاح', 'success');
      return { success: true, data };
    } catch (error) {
      console.error('Error creating course:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update course
   */
  static async updateCourse(id, updates) {
    try {
      const { data, error } = await supabase
        .from('courses')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      this.clearCache(`course_${id}`);
      this.clearCache('all_courses');
      UI.toast('تم تحديث الكورس بنجاح', 'success');
      return { success: true, data };
    } catch (error) {
      console.error('Error updating course:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete course
   */
  static async deleteCourse(id) {
    try {
      const confirmed = await UI.confirm('هل أنت متأكد من حذف هذا الكورس؟');
      if (!confirmed) return { success: false };

      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', id);

      if (error) throw error;

      this.clearCache(`course_${id}`);
      this.clearCache('all_courses');
      UI.toast('تم حذف الكورس بنجاح', 'success');
      return { success: true };
    } catch (error) {
      console.error('Error deleting course:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get lessons
   */
  static async getLessons(courseId) {
    try {
      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('course_id', courseId)
        .order('order', { ascending: true });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching lessons:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get lesson by ID
   */
  static async getLessonById(id) {
    try {
      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching lesson:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get assignments
   */
  static async getAssignments(filters = {}) {
    try {
      let query = supabase.from('assignments').select('*, course(*), submissions(*)');

      if (filters.course_id) query = query.eq('course_id', filters.course_id);
      if (filters.teacher_id) query = query.eq('teacher_id', filters.teacher_id);
      if (filters.student_id) {
        // Get assignments for student's courses
        const studentCourses = await supabase
          .from('course_enrollments')
          .select('course_id')
          .eq('student_id', filters.student_id);

        if (studentCourses.data) {
          query = query.in('course_id', studentCourses.data.map(e => e.course_id));
        }
      }

      const { data, error } = await query.order('due_date', { ascending: true });
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching assignments:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Submit assignment
   */
  static async submitAssignment(assignmentId, submissionData) {
    try {
      const user = AuthService.getCurrentUser();
      if (!user) throw new Error('يجب تسجيل الدخول أولاً');

      const { data, error } = await supabase
        .from('submissions')
        .insert([{
          assignment_id: assignmentId,
          student_id: user.id,
          ...submissionData,
          submitted_at: new Date()
        }])
        .select()
        .single();

      if (error) throw error;

      UI.toast('تم تسليم الواجب بنجاح', 'success');
      return { success: true, data };
    } catch (error) {
      console.error('Error submitting assignment:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get grades
   */
  static async getGrades(studentId = null) {
    try {
      const user = AuthService.getCurrentUser();
      const targetStudent = studentId || user.id;

      const { data, error } = await supabase
        .from('grades')
        .select('*, assignment(*), submission(*)')
        .eq('student_id', targetStudent)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching grades:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get announcements
   */
  static async getAnnouncements(filters = {}) {
    try {
      let query = supabase.from('announcements').select('*, creator:creator_id(name)');

      if (filters.course_id) query = query.eq('course_id', filters.course_id);
      if (filters.teacher_id) query = query.eq('creator_id', filters.teacher_id);

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching announcements:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create announcement
   */
  static async createAnnouncement(announcementData) {
    try {
      const user = AuthService.getCurrentUser();
      const { data, error } = await supabase
        .from('announcements')
        .insert([{
          ...announcementData,
          creator_id: user.id,
          created_at: new Date()
        }])
        .select()
        .single();

      if (error) throw error;
      UI.toast('تم إنشاء الإعلان بنجاح', 'success');
      return { success: true, data };
    } catch (error) {
      console.error('Error creating announcement:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get statistics
   */
  static async getStatistics(type = 'dashboard') {
    try {
      const user = AuthService.getCurrentUser();

      if (type === 'admin') {
        const [usersCount, teachersCount, studentsCount] = await Promise.all([
          supabase.from('users').select('*', { count: 'exact', head: true }),
          supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'teacher'),
          supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'student')
        ]);

        return {
          success: true,
          data: {
            totalUsers: usersCount.count,
            totalTeachers: teachersCount.count,
            totalStudents: studentsCount.count
          }
        };
      }

      if (type === 'teacher') {
        const [coursesCount, studentsCount] = await Promise.all([
          supabase.from('courses').select('*', { count: 'exact', head: true }).eq('teacher_id', user.id),
          supabase.from('course_enrollments').select('*', { count: 'exact' }).in(
            'course_id',
            (await supabase.from('courses').select('id').eq('teacher_id', user.id)).data?.map(c => c.id) || []
          )
        ]);

        return {
          success: true,
          data: {
            totalCourses: coursesCount.count,
            totalStudents: studentsCount.data?.length || 0
          }
        };
      }

      return { success: true, data: {} };
    } catch (error) {
      console.error('Error fetching statistics:', error);
      return { success: false, error: error.message };
    }
  }
}

// ================= Notification Service =================

class NotificationService {
  static notifications = [];
  static listeners = [];

  /**
   * Subscribe to notifications
   */
  static subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  /**
   * Send notification
   */
  static notify(message, type = 'info', data = {}) {
    const notification = {
      id: Date.now(),
      message,
      type,
      data,
      timestamp: new Date(),
      read: false
    };

    this.notifications.push(notification);

    // Show toast
    UI.toast(message, type);

    // Notify listeners
    this.listeners.forEach(listener => listener(notification));

    // Keep only last 50
    if (this.notifications.length > 50) {
      this.notifications.shift();
    }

    return notification;
  }

  /**
   * Mark as read
   */
  static markAsRead(id) {
    const notif = this.notifications.find(n => n.id === id);
    if (notif) notif.read = true;
  }

  /**
   * Get unread count
   */
  static getUnreadCount() {
    return this.notifications.filter(n => !n.read).length;
  }
}

// ================= Upload Service =================

class UploadService {
  static maxFileSize = 50 * 1024 * 1024; // 50MB
  static allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', 'video/mp4'];

  /**
   * Validate file
   */
  static validateFile(file) {
    if (file.size > this.maxFileSize) {
      throw new Error('حجم الملف كبير جداً');
    }

    if (!this.allowedTypes.includes(file.type)) {
      throw new Error('نوع الملف غير مدعوم');
    }

    return true;
  }

  /**
   * Upload file
   */
  static async uploadFile(file, folder = 'uploads') {
    try {
      this.validateFile(file);

      const fileName = `${Date.now()}_${file.name}`;
      const { data, error } = await supabase.storage
        .from(folder)
        .upload(fileName, file);

      if (error) throw error;

      const { data: publicUrl } = supabase.storage
        .from(folder)
        .getPublicUrl(data.path);

      return {
        success: true,
        url: publicUrl.publicUrl,
        path: data.path
      };
    } catch (error) {
      console.error('Upload error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Upload multiple files
   */
  static async uploadMultiple(files, folder = 'uploads') {
    const results = [];
    for (const file of files) {
      const result = await this.uploadFile(file, folder);
      results.push(result);
    }
    return results;
  }
}

export { DataService, NotificationService, UploadService };
export default DataService;
