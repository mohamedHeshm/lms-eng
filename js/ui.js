/**
 * ================================================
 * نظام واجهة المستخدم المتقدم
 * Advanced UI System
 * ================================================
 */

class UISystem {
  constructor() {
    this.toastContainer = null;
    this.modals = {};
    this.currentTheme = this.getTheme();
    this.init();
  }

  /**
   * Initialize UI system
   */
  init() {
    this.createToastContainer();
    this.setupThemeToggle();
    this.setupDocumentListeners();
  }

  /**
   * Create toast container
   */
  createToastContainer() {
    this.toastContainer = document.createElement('div');
    this.toastContainer.id = 'toast-container';
    this.toastContainer.className = 'toast-container';
    document.body.appendChild(this.toastContainer);
  }

  /**
   * Show toast notification
   */
  toast(message, type = 'info', duration = 4000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span>${this.getToastIcon(type)}</span>
      <span>${message}</span>
    `;

    this.toastContainer.appendChild(toast);

    // Auto remove
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, duration);

    return toast;
  }

  /**
   * Get toast icon
   */
  getToastIcon(type) {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    return icons[type] || '📢';
  }

  /**
   * Show alert
   */
  alert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.innerHTML = `
      <div class="alert-icon">${this.getToastIcon(type)}</div>
      <div class="alert-content">
        <div class="alert-message">${message}</div>
      </div>
      <button class="alert-close" onclick="this.parentElement.remove();">✕</button>
    `;

    const targetElement = document.querySelector('.container') || document.body;
    targetElement.insertBefore(alertDiv, targetElement.firstChild);

    return alertDiv;
  }

  /**
   * Show modal dialog
   */
  showModal(options) {
    const {
      title = '',
      message = '',
      content = '',
      size = 'md',
      buttons = [],
      onClose = null,
      allowOutsideClick = true
    } = options;

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = `modal-${Date.now()}`;

    // Create modal
    const modal = document.createElement('div');
    modal.className = `modal modal-${size}`;

    // Modal header
    const header = document.createElement('div');
    header.className = 'modal-header';
    header.innerHTML = `
      <h2 class="modal-title">${title}</h2>
      <button class="modal-close">✕</button>
    `;

    // Modal body
    const body = document.createElement('div');
    body.className = 'modal-body';
    body.innerHTML = message || content;

    // Modal footer
    const footer = document.createElement('div');
    if (buttons.length > 0) {
      footer.className = 'modal-footer';
      buttons.forEach(btn => {
        const button = document.createElement('button');
        button.className = `btn ${btn.class || 'btn-primary'}`;
        button.textContent = btn.text;
        button.onclick = (e) => {
          e.preventDefault();
          if (btn.onClick) btn.onClick();
          this.closeModal(overlay.id);
        };
        footer.appendChild(button);
      });
    }

    modal.appendChild(header);
    modal.appendChild(body);
    if (buttons.length > 0) modal.appendChild(footer);
    overlay.appendChild(modal);

    // Event listeners
    const closeBtn = header.querySelector('.modal-close');
    closeBtn.onclick = () => this.closeModal(overlay.id);

    if (allowOutsideClick) {
      overlay.onclick = (e) => {
        if (e.target === overlay) this.closeModal(overlay.id);
      };
    }

    document.body.appendChild(overlay);

    this.modals[overlay.id] = {
      element: overlay,
      onClose
    };

    return overlay.id;
  }

  /**
   * Close modal
   */
  closeModal(modalId) {
    const modal = this.modals[modalId];
    if (!modal) return;

    modal.element.style.animation = 'fadeOut 0.3s ease forwards';
    setTimeout(() => {
      modal.element.remove();
      if (modal.onClose) modal.onClose();
      delete this.modals[modalId];
    }, 300);
  }

  /**
   * Show confirm dialog
   */
  async confirm(message, title = 'تأكيد') {
    return new Promise((resolve) => {
      this.showModal({
        title,
        message,
        buttons: [
          {
            text: 'تأكيد',
            class: 'btn-primary',
            onClick: () => resolve(true)
          },
          {
            text: 'إلغاء',
            class: 'btn-ghost',
            onClick: () => resolve(false)
          }
        ]
      });
    });
  }

  /**
   * Show loading overlay
   */
  showLoading(message = 'جاري التحميل...') {
    const overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.className = 'modal-overlay';
    overlay.style.background = 'rgba(0, 0, 0, 0.7)';
    overlay.innerHTML = `
      <div style="text-align: center; color: white;">
        <div class="spinner" style="margin: 20px auto;"></div>
        <p>${message}</p>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  /**
   * Hide loading overlay
   */
  hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.style.animation = 'fadeOut 0.3s ease forwards';
      setTimeout(() => overlay.remove(), 300);
    }
  }

  /**
   * Create skeleton loader
   */
  createSkeleton(count = 1, height = '100px') {
    const container = document.createElement('div');
    for (let i = 0; i < count; i++) {
      const skeleton = document.createElement('div');
      skeleton.className = 'skeleton';
      skeleton.style.height = height;
      skeleton.style.marginBottom = '10px';
      skeleton.style.borderRadius = '8px';
      container.appendChild(skeleton);
    }
    return container;
  }

  /**
   * Setup theme toggle
   */
  setupThemeToggle() {
    const toggle = document.getElementById('themeToggle');
    if (toggle) {
      toggle.addEventListener('click', () => this.toggleTheme());
    }

    // Apply saved theme
    this.applyTheme(this.currentTheme);
  }

  /**
   * Toggle theme
   */
  toggleTheme() {
    this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', this.currentTheme);
    this.applyTheme(this.currentTheme);
  }

  /**
   * Apply theme
   */
  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  /**
   * Get theme
   */
  getTheme() {
    return localStorage.getItem('theme') || 'light';
  }

  /**
   * Setup document listeners
   */
  setupDocumentListeners() {
    // Close dropdowns on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.dropdown')) {
        document.querySelectorAll('.dropdown.active').forEach(d => {
          d.classList.remove('active');
        });
      }
    });

    // Handle escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        // Close all modals
        Object.keys(this.modals).forEach(id => this.closeModal(id));
      }
    });
  }

  /**
   * Toggle dropdown
   */
  toggleDropdown(element) {
    const dropdown = element.closest('.dropdown');
    dropdown?.classList.toggle('active');
  }

  /**
   * Create table
   */
  createTable(columns, data, options = {}) {
    const {
      onAction = null,
      paginate = true,
      itemsPerPage = 10,
      searchable = true,
      sortable = true
    } = options;

    const container = document.createElement('div');

    // Search bar
    if (searchable) {
      const searchDiv = document.createElement('div');
      searchDiv.className = 'search-box';
      searchDiv.style.marginBottom = '20px';
      searchDiv.innerHTML = `
        <input type="text" class="table-search" placeholder="🔍 ابحث...">
        <span class="search-icon">🔍</span>
      `;
      container.appendChild(searchDiv);
    }

    // Table
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';

    // Header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.style.borderBottom = '2px solid var(--border-color)';

    columns.forEach(col => {
      const th = document.createElement('th');
      th.style.cssText = `
        padding: 12px;
        text-align: right;
        font-weight: 600;
        color: var(--text-primary);
        cursor: ${sortable ? 'pointer' : 'default'};
      `;
      th.textContent = col.label;
      if (sortable) {
        th.style.userSelect = 'none';
      }
      headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');
    data.forEach((row, index) => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--border-color)';
      tr.style.transition = 'background 0.3s ease';

      tr.onmouseover = () => {
        tr.style.background = 'rgba(102, 126, 234, 0.05)';
      };
      tr.onmouseout = () => {
        tr.style.background = 'transparent';
      };

      columns.forEach(col => {
        const td = document.createElement('td');
        td.style.cssText = `
          padding: 12px;
          text-align: right;
          color: var(--text-secondary);
        `;
        
        if (col.render) {
          td.innerHTML = col.render(row[col.key], row, index);
        } else if (col.type === 'action' && onAction) {
          const actions = document.createElement('div');
          actions.style.display = 'flex';
          actions.style.gap = '8px';

          col.actions?.forEach(action => {
            const btn = document.createElement('button');
            btn.className = `btn btn-small ${action.class || 'btn-primary'}`;
            btn.textContent = action.label;
            btn.onclick = () => onAction(action.key, row, index);
            actions.appendChild(btn);
          });

          td.appendChild(actions);
        } else {
          td.textContent = row[col.key] || '-';
        }

        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    container.appendChild(table);

    return container;
  }

  /**
   * Create form
   */
  createForm(fields, options = {}) {
    const {
      onSubmit = null,
      submitText = 'إرسال',
      cancelText = 'إلغاء',
      onCancel = null,
      layout = 'vertical' // or 'horizontal'
    } = options;

    const form = document.createElement('form');
    form.style.display = 'flex';
    form.style.flexDirection = layout === 'vertical' ? 'column' : 'row';
    form.style.gap = '20px';

    const formData = {};
    const fieldElements = {};

    fields.forEach(field => {
      const group = document.createElement('div');
      group.className = `form-group${field.required ? ' required' : ''}`;

      if (field.label) {
        const label = document.createElement('label');
        label.htmlFor = field.name;
        label.textContent = field.label;
        group.appendChild(label);
      }

      let input;
      if (field.type === 'textarea') {
        input = document.createElement('textarea');
      } else if (field.type === 'select') {
        input = document.createElement('select');
        field.options?.forEach(opt => {
          const option = document.createElement('option');
          option.value = opt.value;
          option.textContent = opt.label;
          input.appendChild(option);
        });
      } else {
        input = document.createElement('input');
        input.type = field.type || 'text';
      }

      input.name = field.name;
      input.id = field.name;
      input.placeholder = field.placeholder || '';
      if (field.required) input.required = true;

      input.addEventListener('change', (e) => {
        formData[field.name] = e.target.value;
      });

      group.appendChild(input);
      form.appendChild(group);
      fieldElements[field.name] = input;
    });

    // Buttons
    const buttonGroup = document.createElement('div');
    buttonGroup.style.display = 'flex';
    buttonGroup.style.gap = '10px';
    buttonGroup.style.justifyContent = 'flex-end';

    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'btn btn-primary';
    submitBtn.textContent = submitText;

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-ghost';
    cancelBtn.textContent = cancelText;
    cancelBtn.onclick = () => onCancel?.();

    buttonGroup.appendChild(cancelBtn);
    buttonGroup.appendChild(submitBtn);
    form.appendChild(buttonGroup);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (onSubmit) onSubmit(formData);
    });

    return { form, formData, fieldElements };
  }

  /**
   * Show progress
   */
  showProgress(message = '', initialValue = 0) {
    const container = document.createElement('div');
    container.className = 'card';
    container.innerHTML = `
      <div style="margin-bottom: 20px;">
        <p>${message}</p>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${initialValue}%"></div>
        </div>
        <div class="progress-text"><span class="progress-value">${initialValue}</span>%</div>
      </div>
    `;

    return {
      element: container,
      update: (value) => {
        const fill = container.querySelector('.progress-fill');
        const text = container.querySelector('.progress-value');
        fill.style.width = value + '%';
        text.textContent = value;
      },
      remove: () => container.remove()
    };
  }

  /**
   * Animate counter
   */
  animateCounter(element, target, duration = 1000) {
    const start = parseInt(element.textContent) || 0;
    const increment = (target - start) / (duration / 16);
    let current = start;

    const animate = () => {
      current += increment;
      if ((increment > 0 && current >= target) || (increment < 0 && current <= target)) {
        element.textContent = target;
      } else {
        element.textContent = Math.floor(current);
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * Create chart placeholder
   */
  createChart(type, data, options = {}) {
    const container = document.createElement('div');
    container.className = 'card';
    container.style.height = '300px';
    container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100%;">
        <p style="color: var(--text-tertiary);">📊 الرسم البياني قريبًا</p>
      </div>
    `;
    return container;
  }

  /**
   * Create avatar
   */
  createAvatar(name, imageUrl = null, size = 'md') {
    const sizeMap = {
      sm: '32px',
      md: '48px',
      lg: '64px',
      xl: '80px'
    };

    const avatar = document.createElement('div');
    avatar.className = 'user-avatar';
    avatar.style.width = sizeMap[size];
    avatar.style.height = sizeMap[size];
    avatar.style.fontSize = `${parseInt(sizeMap[size]) / 2}px`;

    if (imageUrl) {
      const img = document.createElement('img');
      img.src = imageUrl;
      img.style.width = '100%';
      img.style.height = '100%';
      avatar.appendChild(img);
    } else {
      const initials = name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase();
      avatar.textContent = initials;
    }

    return avatar;
  }
}

// Create singleton instance
export const UI = new UISystem();
export default UI;
