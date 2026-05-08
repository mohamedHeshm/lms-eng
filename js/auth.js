/**
 * ================================================
 * نظام المصادقة والأمان المحسّن
 * Security & Authentication System
 * ================================================
 */

// ================= Supabase Setup =================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = "https://dfxkuppxywldxsbyzfzo.supabase.co"
const supabaseKey = "sb_publishable_B3xVoCtEJtpStm76kM5KDw_WZgPsJXN"

export const supabase = createClient(supabaseUrl, supabaseKey)

// ================= Session Management =================

class SessionManager {
  constructor() {
    this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
    this.warningTime = 5 * 60 * 1000; // 5 minutes before timeout
    this.sessionTimer = null;
    this.warningTimer = null;
    this.isWarningShown = false;
    this.activityListeners = [];
  }

  /**
   * Start session management
   */
  startSession(user) {
    this.currentUser = user;
    this.lastActivity = Date.now();
    this.setupActivityListeners();
    this.resetSessionTimer();
  }

  /**
   * Setup activity listeners to reset timer on user activity
   */
  setupActivityListeners() {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, () => this.onUserActivity(), { passive: true });
    });
  }

  /**
   * Handle user activity
   */
  onUserActivity() {
    const now = Date.now();
    if (now - this.lastActivity > 60000) { // Only reset if more than 1 minute passed
      this.lastActivity = now;
      this.resetSessionTimer();
      this.isWarningShown = false;
    }
  }

  /**
   * Reset session timer
   */
  resetSessionTimer() {
    clearTimeout(this.sessionTimer);
    clearTimeout(this.warningTimer);

    // Show warning before timeout
    this.warningTimer = setTimeout(() => {
      if (!this.isWarningShown) {
        this.showSessionWarning();
        this.isWarningShown = true;
      }
    }, this.sessionTimeout - this.warningTime);

    // Auto logout on timeout
    this.sessionTimer = setTimeout(() => {
      this.endSession('timeout');
    }, this.sessionTimeout);
  }

  /**
   * Show session warning modal
   */
  showSessionWarning() {
    UI.showModal({
      title: '⏰ انتبه: جلستك ستنتهي قريباً',
      message: 'سيتم تسجيل خروجك تلقائياً خلال 5 دقائق بسبب عدم النشاط.',
      buttons: [
        {
          text: 'مواصلة',
          class: 'btn-primary',
          onClick: () => {
            this.resetSessionTimer();
            this.isWarningShown = false;
          }
        },
        {
          text: 'تسجيل خروج',
          class: 'btn-danger',
          onClick: () => {
            this.endSession('manual');
          }
        }
      ]
    });
  }

  /**
   * End session
   */
  async endSession(reason = 'logout') {
    clearTimeout(this.sessionTimer);
    clearTimeout(this.warningTimer);
    
    // Log logout event
    await AuthService.logActivity('logout', {
      reason,
      sessionDuration: Date.now() - this.loginTime
    });

    // Clear session
    this.clearSession();
  }

  /**
   * Clear session data
   */
  clearSession() {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('loginTime');
    sessionStorage.clear();
  }

  /**
   * Extend session (renew token)
   */
  async extendSession() {
    const user = this.currentUser;
    if (!user) return false;

    try {
      // Generate new token
      const newToken = this.generateToken(user);
      localStorage.setItem('sessionToken', newToken);
      this.resetSessionTimer();
      return true;
    } catch (error) {
      console.error('Error extending session:', error);
      return false;
    }
  }

  /**
   * Generate JWT-like token
   */
  generateToken(user) {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({
      sub: user.id,
      email: user.email,
      role: user.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.sessionTimeout / 1000
    }));
    const signature = btoa('signature_placeholder');
    return `${header}.${payload}.${signature}`;
  }
}

// ================= Authentication Service =================

class AuthService {
  static sessionManager = new SessionManager();
  static loginAttempts = {}; // Track failed login attempts
  static maxLoginAttempts = 5;
  static lockoutTime = 15 * 60 * 1000; // 15 minutes

  /**
   * Register new user
   */
  static async register(userData) {
    try {
      // Validate input
      this.validateUserData(userData);

      // Check if user already exists
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('email', userData.email)
        .single();

      if (existing) {
        throw new Error('هذا البريد الإلكتروني مسجل بالفعل');
      }

      // Hash password (in production, use bcrypt on server)
      const hashedPassword = await this.hashPassword(userData.password);

      // Create user
      const { data: newUser, error } = await supabase
        .from('users')
        .insert([{
          name: userData.name,
          email: userData.email,
          password_hash: hashedPassword,
          role: userData.role,
          stage: userData.stage,
          teacher_id: userData.teacher_id,
          created_at: new Date(),
          is_active: true,
          is_verified: false
        }])
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await this.logActivity('register', {
        email: userData.email,
        role: userData.role
      });

      return { success: true, user: newUser };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Login with rate limiting and security checks
   */
  static async login(email, password) {
    try {
      // Check if account is locked
      if (this.isAccountLocked(email)) {
        throw new Error('الحساب مقفل مؤقتاً. حاول لاحقاً.');
      }

      // Validate input
      if (!email || !password) {
        throw new Error('البريد الإلكتروني وكلمة المرور مطلوبان');
      }

      // Get user
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error || !user) {
        this.recordFailedLogin(email);
        throw new Error('بيانات دخول غير صحيحة');
      }

      // Check if account is active
      if (!user.is_active) {
        throw new Error('هذا الحساب معطل');
      }

      // Verify password
      const passwordMatch = await this.verifyPassword(password, user.password_hash);
      if (!passwordMatch) {
        this.recordFailedLogin(email);
        throw new Error('بيانات دخول غير صحيحة');
      }

      // Clear failed attempts
      delete this.loginAttempts[email];

      // Create session
      const token = this.sessionManager.generateToken(user);
      const loginTime = Date.now();

      // Store session data
      localStorage.setItem('currentUser', JSON.stringify({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        stage: user.stage,
        teacher_id: user.teacher_id
      }));
      localStorage.setItem('sessionToken', token);
      localStorage.setItem('loginTime', loginTime.toString());

      // Start session management
      this.sessionManager.startSession(user);
      this.sessionManager.loginTime = loginTime;

      // Log activity
      await this.logActivity('login', {
        email,
        role: user.role,
        ipAddress: await this.getClientIP()
      });

      return { success: true, user };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Logout
   */
  static async logout() {
    try {
      const user = this.getCurrentUser();
      
      if (user) {
        await this.logActivity('logout', {
          email: user.email,
          sessionDuration: Date.now() - (parseInt(localStorage.getItem('loginTime')) || Date.now())
        });
      }

      this.sessionManager.endSession('manual');
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      this.sessionManager.clearSession();
      return { success: false };
    }
  }

  /**
   * Change password
   */
  static async changePassword(oldPassword, newPassword, confirmPassword) {
    try {
      const user = this.getCurrentUser();
      if (!user) throw new Error('يجب تسجيل الدخول أولاً');

      if (newPassword !== confirmPassword) {
        throw new Error('كلمات المرور غير متطابقة');
      }

      if (newPassword.length < 8) {
        throw new Error('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
      }

      // Get user with password
      const { data: userData } = await supabase
        .from('users')
        .select('password_hash')
        .eq('id', user.id)
        .single();

      // Verify old password
      const oldPasswordMatch = await this.verifyPassword(oldPassword, userData.password_hash);
      if (!oldPasswordMatch) {
        throw new Error('كلمة المرور الحالية غير صحيحة');
      }

      // Hash new password
      const hashedPassword = await this.hashPassword(newPassword);

      // Update password
      const { error } = await supabase
        .from('users')
        .update({ password_hash: hashedPassword })
        .eq('id', user.id);

      if (error) throw error;

      // Log activity
      await this.logActivity('password_change', { email: user.email });

      return { success: true };
    } catch (error) {
      console.error('Change password error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Reset password (forgot password)
   */
  static async resetPassword(email) {
    try {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (!user) {
        // Don't reveal if email exists or not (security)
        return { success: true, message: 'إذا كان البريد موجود، ستتلقى رابط إعادة تعيين' };
      }

      // Generate reset token
      const resetToken = this.generateResetToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Store reset token
      const { error } = await supabase
        .from('password_resets')
        .insert([{
          user_id: user.id,
          token: resetToken,
          expires_at: expiresAt
        }]);

      if (error) throw error;

      // In production, send email with reset link
      // await sendPasswordResetEmail(email, resetToken);

      // Log activity
      await this.logActivity('password_reset_request', { email });

      return { success: true, message: 'تم إرسال رابط إعادة تعيين إلى بريدك الإلكتروني' };
    } catch (error) {
      console.error('Reset password error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get current user
   */
  static getCurrentUser() {
    try {
      const userJson = localStorage.getItem('currentUser');
      return userJson ? JSON.parse(userJson) : null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  /**
   * Validate session token
   */
  static validateToken(token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false;

      const payload = JSON.parse(atob(parts[1]));
      const now = Math.floor(Date.now() / 1000);

      return payload.exp > now;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if user is authenticated
   */
  static isAuthenticated() {
    const user = this.getCurrentUser();
    const token = localStorage.getItem('sessionToken');
    return user && token && this.validateToken(token);
  }

  /**
   * Check user role
   */
  static hasRole(requiredRole) {
    const user = this.getCurrentUser();
    if (!user) return false;

    if (Array.isArray(requiredRole)) {
      return requiredRole.includes(user.role);
    }
    return user.role === requiredRole;
  }

  // ================= Security Helpers =================

  /**
   * Hash password (simplified - use bcrypt in production)
   */
  static async hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Verify password
   */
  static async verifyPassword(password, hash) {
    const passwordHash = await this.hashPassword(password);
    return passwordHash === hash;
  }

  /**
   * Generate reset token
   */
  static generateResetToken() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Validate user data
   */
  static validateUserData(data) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      throw new Error('البريد الإلكتروني غير صحيح');
    }

    if (data.password && data.password.length < 8) {
      throw new Error('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
    }

    if (!data.name || data.name.trim().length < 2) {
      throw new Error('الاسم يجب أن يكون حرفين على الأقل');
    }
  }

  /**
   * Record failed login attempt
   */
  static recordFailedLogin(email) {
    if (!this.loginAttempts[email]) {
      this.loginAttempts[email] = {
        attempts: 0,
        firstAttempt: Date.now()
      };
    }

    this.loginAttempts[email].attempts++;
    this.loginAttempts[email].lastAttempt = Date.now();

    // Log failed attempt
    this.logActivity('failed_login', { email });
  }

  /**
   * Check if account is locked
   */
  static isAccountLocked(email) {
    const attempt = this.loginAttempts[email];
    if (!attempt) return false;

    if (attempt.attempts >= this.maxLoginAttempts) {
      const timeSinceFirstAttempt = Date.now() - attempt.firstAttempt;
      if (timeSinceFirstAttempt < this.lockoutTime) {
        return true;
      } else {
        // Reset attempts after lockout time
        delete this.loginAttempts[email];
        return false;
      }
    }

    return false;
  }

  /**
   * Get client IP (in production, get from server)
   */
  static async getClientIP() {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return 'unknown';
    }
  }

  /**
   * Log activity for audit trail
   */
  static async logActivity(action, details = {}) {
    try {
      const user = this.getCurrentUser();
      
      await supabase.from('activity_logs').insert([{
        user_id: user?.id,
        action,
        details,
        ip_address: details.ipAddress || 'unknown',
        user_agent: navigator.userAgent,
        created_at: new Date()
      }]);
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }

  /**
   * Sanitize user input (XSS prevention)
   */
  static sanitizeInput(input) {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
  }

  /**
   * Validate and sanitize form data
   */
  static validateFormData(data, schema) {
    const errors = {};

    for (const [field, rules] of Object.entries(schema)) {
      if (!data[field]) {
        if (rules.required) {
          errors[field] = `${rules.label} مطلوب`;
        }
      } else {
        // Validate type
        if (rules.type && typeof data[field] !== rules.type) {
          errors[field] = `${rules.label} نوع غير صحيح`;
        }

        // Validate min length
        if (rules.minLength && data[field].length < rules.minLength) {
          errors[field] = `${rules.label} يجب أن يكون ${rules.minLength} أحرف على الأقل`;
        }

        // Custom validation
        if (rules.validate && !rules.validate(data[field])) {
          errors[field] = rules.errorMessage || `${rules.label} غير صحيح`;
        }
      }
    }

    return errors;
  }
}

// Export for use in other modules
export default AuthService;
export { SessionManager }
