// create menu dropdown component for dashboard
(function() {
  const ICONS = {
    plus: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>',
    class: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>',
    subject: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
    student: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" y1="8" x2="19" y2="14"></line><line x1="22" y1="11" x2="16" y2="11"></line></svg>',
    lesson: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>'
  };

  const DEFAULT_ITEMS = [
    { icon: 'class', label: 'Lớp học mới', action: 'create-class' },
    { icon: 'subject', label: 'Môn học mới', action: 'create-subject' },
    { icon: 'student', label: 'Thêm sinh viên', action: 'create-student' },
    { icon: 'lesson', label: 'Tạo buổi học', action: 'create-lesson' }
  ];

  let styleInjected = false;
  function injectStyles() {
    if (styleInjected || typeof document === 'undefined') return;
    styleInjected = true;
    const style = document.createElement('style');
    style.id = 'crt-menu-styles';
    style.textContent = `
      .crt-stage {
        position: relative;
        display: inline-flex;
        align-items: center;
        height: 30px;
        user-select: none;
        z-index: 60;
      }
      .crt-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 30px;
        padding: 0 12px;
        background: linear-gradient(180deg, #2a4897 0%, #1e3674 100%);
        border: 1px solid rgba(75, 114, 219, 0.35);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.16), 0 2px 6px rgba(0, 0, 0, 0.35);
        border-radius: 8px;
        color: #ffffff;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        outline: none;
        box-sizing: border-box;
        transition: all 0.18s ease;
      }
      .crt-pill:hover {
        background: linear-gradient(180deg, #3254ae 0%, #223e85 100%);
        border-color: rgba(99, 140, 245, 0.45);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22), 0 3px 8px rgba(0, 0, 0, 0.45);
      }
      .crt-pill:active {
        transform: scale(0.97);
      }
      .crt-glyph {
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ffffff;
      }
      .crt-chevron {
        transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1);
        color: rgba(255, 255, 255, 0.7);
      }
      .crt-stage[data-open="true"] .crt-chevron {
        transform: rotate(180deg);
        color: #9dbcff;
      }
      .crt-stage[data-open="true"] .crt-pill {
        border-color: rgba(99, 140, 245, 0.5);
      }
      .crt-panel {
        position: absolute;
        top: calc(100% + 8px);
        right: 0;
        width: 200px;
        padding: 6px;
        box-sizing: border-box;
        border-radius: 14px;
        background: rgba(11, 15, 25, 0.96);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 16px 36px -6px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.08);
        z-index: 100;
        pointer-events: none;
        opacity: 0;
        transform: translateY(-6px) scale(0.96);
        transform-origin: top right;
        visibility: hidden;
        transition: opacity 0.18s cubic-bezier(0.22, 1, 0.36, 1),
                    transform 0.22s cubic-bezier(0.22, 1, 0.36, 1),
                    visibility 0.22s;
      }
      .crt-stage[data-open="true"] .crt-panel {
        pointer-events: auto;
        opacity: 1;
        visibility: visible;
        transform: translateY(0) scale(1);
      }
      .crt-menu {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .crt-item {
        margin: 0;
        padding: 0;
      }
      .crt-item-btn {
        width: 100%;
        height: 34px;
        display: flex;
        align-items: center;
        gap: 9px;
        padding: 0 10px;
        background: transparent;
        border: none;
        border-radius: 8px;
        color: #d1d5db;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .crt-item-btn:hover {
        background: rgba(42, 70, 144, 0.35);
        color: #ffffff;
        transform: translateX(2px);
      }
      .crt-item-btn svg {
        color: #9dbcff;
        flex-shrink: 0;
      }
    `;
    document.head.appendChild(style);
  }

  function createLiquidMenu(container, opts = {}) {
    injectStyles();

    const label = opts.label || 'Tạo mới';
    const items = opts.items || DEFAULT_ITEMS;
    const onSelect = opts.onSelect || (() => {});

    const stage = document.createElement('div');
    stage.className = 'crt-stage';

    const menuItemsHtml = items
      .map((it) => {
        const iconSvg = ICONS[it.icon] || ICONS.plus;
        return `
          <li class="crt-item">
            <button class="crt-item-btn" type="button" data-action="${it.action || ''}">
              ${iconSvg}
              <span>${it.label}</span>
            </button>
          </li>
        `;
      })
      .join('');

    stage.innerHTML = `
      <button class="crt-pill" type="button" aria-expanded="false">
        <span class="crt-glyph" aria-hidden="true">${ICONS.plus}</span>
        <span class="crt-say">${label}</span>
        <svg class="crt-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </button>
      <div class="crt-panel">
        <ul class="crt-menu">
          ${menuItemsHtml}
        </ul>
      </div>
    `;

    container.replaceChildren(stage);

    const pillBtn = stage.querySelector('.crt-pill');
    let isOpen = false;

    const openMenu = () => {
      stage.setAttribute('data-open', 'true');
      pillBtn.setAttribute('aria-expanded', 'true');
      isOpen = true;
    };

    const closeMenu = () => {
      stage.removeAttribute('data-open');
      pillBtn.setAttribute('aria-expanded', 'false');
      isOpen = false;
    };

    pillBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isOpen) {
        openMenu();
      } else {
        closeMenu();
      }
    });

    // click outside to close
    const handleOutsideClick = (e) => {
      if (!isOpen) return;
      if (stage.contains(e.target)) return;
      closeMenu();
    };
    document.addEventListener('pointerdown', handleOutsideClick);

    // item selection
    stage.querySelectorAll('.crt-item-btn').forEach((btn, index) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const action = btn.dataset.action;
        closeMenu();
        if (typeof onSelect === 'function') {
          onSelect(items[index], action);
        }
      });
    });

    return {
      open: openMenu,
      close: closeMenu,
      destroy() {
        document.removeEventListener('pointerdown', handleOutsideClick);
      }
    };
  }

  function autoInit() {
    const targets = document.querySelectorAll('[data-liquid-create], .liquid-create-btn');
    targets.forEach((el) => {
      if (el._liquidInited) return;
      el._liquidInited = true;
      const label = el.dataset.label || 'Tạo mới';
      createLiquidMenu(el, {
        label,
        onSelect: (item, action) => {
          const event = new CustomEvent('liquid-create-action', {
            detail: { item, action },
            bubbles: true
          });
          el.dispatchEvent(event);

          const openTargetModal = (modalId) => {
            if (window.dashboard && typeof window.dashboard.openModal === 'function') {
              window.dashboard.openModal(modalId);
            } else {
              const modal = document.getElementById(modalId);
              if (modal) modal.classList.add('active');
            }
          };

          if (action === 'create-class') {
            openTargetModal('modal-add-class');
          } else if (action === 'create-subject') {
            openTargetModal('modal-add-subject');
          } else if (action === 'create-student') {
            openTargetModal('modal-add-student');
          } else if (action === 'create-lesson') {
            openTargetModal('modal-add-lesson');
          }
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }

  window.createLiquidMenu = createLiquidMenu;
})();
