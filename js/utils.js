/**
 * ================================================
 * ملف الدوال المساعدة والأدوات
 * Helper Functions & Utilities
 * ================================================
 */

import { DATE_FORMATS, REGEX } from './config.js';

// ================= Date & Time Helpers =================

export class DateUtils {
  /**
   * Format date to locale string
   */
  static format(date, format = 'short') {
    if (!date) return '';
    const d = new Date(date);
    const day = d.getDate();
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    const hours = d.getHours();
    const minutes = d.getMinutes();

    if (format === 'short') {
      return `${day}/${month}/${year}`;
    }
    if (format === 'time') {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
    if (format === 'full') {
      return `${day}/${month}/${year} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
    return d.toLocaleString('ar-EG');
  }

  /**
   * Get days until date
   */
  static daysUntil(date) {
    const now = new Date();
    const target = new Date(date);
    const diff = target - now;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Get time ago string
   */
  static timeAgo(date) {
    const now = new Date();
    const past = new Date(date);
    const diff = now - past;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `قبل ${days} يوم`;
    if (hours > 0) return `قبل ${hours} ساعة`;
    if (minutes > 0) return `قبل ${minutes} دقيقة`;
    return 'الآن';
  }

  /**
   * Is date today
   */
  static isToday(date) {
    const today = new Date();
    const d = new Date(date);
    return d.toDateString() === today.toDateString();
  }
}

// ================= String Helpers =================

export class StringUtils {
  /**
   * Capitalize first letter
   */
  static capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Truncate string
   */
  static truncate(str, length = 50) {
    if (!str) return '';
    if (str.length <= length) return str;
    return str.substring(0, length) + '...';
  }

  /**
   * Generate slug
   */
  static slug(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Get initials
   */
  static initials(name) {
    if (!name) return '?';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase();
  }

  /**
   * Count words
   */
  static countWords(str) {
    if (!str) return 0;
    return str.trim().split(/\s+/).length;
  }

  /**
   * Generate random string
   */
  static random(length = 10) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

// ================= Validation Helpers =================

export class ValidationUtils {
  /**
   * Validate email
   */
  static isValidEmail(email) {
    return REGEX.email.test(email);
  }

  /**
   * Validate password strength
   */
  static isStrongPassword(password) {
    return password && password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password);
  }

  /**
   * Validate phone
   */
  static isValidPhone(phone) {
    return REGEX.phone.test(phone.replace(/\D/g, ''));
  }

  /**
   * Validate URL
   */
  static isValidUrl(url) {
    return REGEX.url.test(url);
  }

  /**
   * Validate Arabic text
   */
  static isArabic(text) {
    return REGEX.arabicText.test(text);
  }

  /**
   * Validate required fields
   */
  static validateRequired(fields) {
    const errors = {};
    Object.entries(fields).forEach(([key, value]) => {
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        errors[key] = 'هذا الحقل مطلوب';
      }
    });
    return errors;
  }
}

// ================= Math Helpers =================

export class MathUtils {
  /**
   * Calculate percentage
   */
  static percentage(part, total) {
    if (total === 0) return 0;
    return Math.round((part / total) * 100);
  }

  /**
   * Calculate average
   */
  static average(numbers) {
    if (numbers.length === 0) return 0;
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }

  /**
   * Round to decimal places
   */
  static round(number, decimals = 2) {
    return Math.round(number * Math.pow(10, decimals)) / Math.pow(10, decimals);
  }

  /**
   * Generate random number
   */
  static randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Clamp number
   */
  static clamp(number, min, max) {
    return Math.max(min, Math.min(max, number));
  }
}

// ================= Array Helpers =================

export class ArrayUtils {
  /**
   * Remove duplicates
   */
  static unique(array) {
    return [...new Set(array)];
  }

  /**
   * Group by property
   */
  static groupBy(array, property) {
    return array.reduce((groups, item) => {
      const key = item[property];
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
      return groups;
    }, {});
  }

  /**
   * Sort by property
   */
  static sortBy(array, property, ascending = true) {
    return [...array].sort((a, b) => {
      const aVal = a[property];
      const bVal = b[property];
      if (ascending) {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });
  }

  /**
   * Chunk array
   */
  static chunk(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Find differences
   */
  static difference(arr1, arr2) {
    return arr1.filter(item => !arr2.includes(item));
  }

  /**
   * Flatten array
   */
  static flatten(array) {
    return array.reduce((flat, item) => {
      return flat.concat(Array.isArray(item) ? this.flatten(item) : item);
    }, []);
  }
}

// ================= Object Helpers =================

export class ObjectUtils {
  /**
   * Deep clone
   */
  static deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Merge objects
   */
  static merge(target, source) {
    return Object.assign({}, target, source);
  }

  /**
   * Pick properties
   */
  static pick(obj, keys) {
    const result = {};
    keys.forEach(key => {
      if (key in obj) result[key] = obj[key];
    });
    return result;
  }

  /**
   * Omit properties
   */
  static omit(obj, keys) {
    const result = {};
    Object.keys(obj).forEach(key => {
      if (!keys.includes(key)) result[key] = obj[key];
    });
    return result;
  }

  /**
   * Get nested property
   */
  static get(obj, path) {
    return path.split('.').reduce((current, prop) => current?.[prop], obj);
  }
}

// ================= Storage Helpers =================

export class StorageUtils {
  /**
   * Set item
   */
  static set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('Storage error:', e);
      return false;
    }
  }

  /**
   * Get item
   */
  static get(key) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (e) {
      console.error('Storage error:', e);
      return null;
    }
  }

  /**
   * Remove item
   */
  static remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.error('Storage error:', e);
      return false;
    }
  }

  /**
   * Clear all
   */
  static clear() {
    try {
      localStorage.clear();
      return true;
    } catch (e) {
      console.error('Storage error:', e);
      return false;
    }
  }
}

// ================= DOM Helpers =================

export class DOMUtils {
  /**
   * Query selector
   */
  static $(selector) {
    return document.querySelector(selector);
  }

  /**
   * Query selector all
   */
  static $$(selector) {
    return document.querySelectorAll(selector);
  }

  /**
   * Create element
   */
  static createElement(tag, classes = '', html = '') {
    const el = document.createElement(tag);
    if (classes) el.className = classes;
    if (html) el.innerHTML = html;
    return el;
  }

  /**
   * Add event listener
   */
  static on(element, event, handler) {
    if (element) element.addEventListener(event, handler);
  }

  /**
   * Remove event listener
   */
  static off(element, event, handler) {
    if (element) element.removeEventListener(event, handler);
  }

  /**
   * Toggle class
   */
  static toggleClass(element, className) {
    if (element) element.classList.toggle(className);
  }

  /**
   * Add class
   */
  static addClass(element, className) {
    if (element) element.classList.add(className);
  }

  /**
   * Remove class
   */
  static removeClass(element, className) {
    if (element) element.classList.remove(className);
  }

  /**
   * Has class
   */
  static hasClass(element, className) {
    return element && element.classList.contains(className);
  }
}

export default {
  DateUtils,
  StringUtils,
  ValidationUtils,
  MathUtils,
  ArrayUtils,
  ObjectUtils,
  StorageUtils,
  DOMUtils
};
