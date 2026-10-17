// liquid morphing create menu component
(function() {
  const ICONS = {
    plus: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>',
    document: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>',
    table: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"></path></svg>',
    grid: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>',
    folder: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"></path></svg>',
    class: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>',
    subject: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>',
    student: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" y1="8" x2="19" y2="14"></line><line x1="22" y1="11" x2="16" y2="11"></line></svg>',
    lesson: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>'
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
    style.id = 'crt-liquid-styles';
    style.textContent = `
      .crt-stage {
        position: relative;
        display: inline-flex;
        align-items: flex-start;
        justify-content: flex-start;
        height: 30px;
        user-select: none;
        z-index: 50;
      }
      .crt-blobs {
        position: absolute;
        top: 0;
        left: 0;
        pointer-events: none;
        z-index: 1;
      }
      .crt-body {
        width: var(--pill-w, 92px);
        height: 30px;
        background: linear-gradient(180deg, #3253a6 0%, #1f366e 100%);
        border: none;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 4px 14px -2px rgba(42, 70, 144, 0.45);
        border-radius: var(--crt-shut-r, 8px);
        transform-origin: top left;
        will-change: width, height, border-radius;
        transition: transform 0.12s cubic-bezier(0.16, 1, 0.3, 1),
                    background 0.2s ease,
                    box-shadow 0.2s ease;
      }
      .crt-stage[data-sink="true"] .crt-body {
        transform: scale(0.96);
      }
      .crt-stage[data-open="true"] {
        z-index: 90;
      }
      .crt-stage[data-open="true"] .crt-body {
        background: rgba(10, 14, 25, 0.95);
        backdrop-filter: blur(24px);
        border: none;
        box-shadow: 0 18px 42px -8px rgba(0, 0, 0, 0.85), 0 0 22px rgba(42, 70, 144, 0.35);
      }
      .crt-pill {
        position: relative;
        z-index: 2;
        height: 30px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 0 11px;
        background: transparent;
        border: none;
        color: #ffffff;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        outline: none;
        opacity: 1;
        transform: translateY(0) scale(1);
        transition: opacity 0.14s ease 0.08s, transform 0.14s ease 0.08s;
      }
      .crt-pill:hover {
        color: #ffffff;
      }
      .crt-stage[data-open="true"] .crt-pill {
        opacity: 0;
        pointer-events: none;
        transform: translateY(-4px) scale(0.95);
        transition: opacity 0.08s ease, transform 0.08s ease;
      }
      .crt-glyph {
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ffffff;
        transition: transform 0.2s ease;
      }
      .crt-stage:hover .crt-glyph {
        transform: rotate(90deg);
      }
      .crt-stage[data-open="true"] .crt-glyph {
        transform: rotate(45deg);
      }
      .crt-say {
        display: inline-block;
        white-space: nowrap;
        overflow: hidden;
        color: #ffffff;
        font-weight: 500;
        letter-spacing: -0.01em;
      }
      .crt-panel {
        position: absolute;
        top: 0;
        left: 0;
        width: 206px;
        height: 160px;
        padding: 6px;
        box-sizing: border-box;
        z-index: 3;
        pointer-events: none;
        opacity: 0;
        overflow: hidden;
        transform: scale(0.96);
        transition: opacity 0.1s ease-out, transform 0.12s ease-out;
      }
      .crt-stage[data-open="true"] .crt-panel {
        pointer-events: auto;
        opacity: 1;
        transform: scale(1);
        transition: opacity 0.14s ease 0.04s, transform 0.18s cubic-bezier(0.16, 1, 0.3, 1) 0.02s;
      }
      .crt-menu {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
        height: 100%;
        justify-content: center;
      }
      .crt-item {
        transform: translateY(4px);
        opacity: 0;
        transition: opacity 0.1s ease-out, transform 0.1s ease-out;
      }
      .crt-stage[data-open="true"] .crt-item {
        transform: translateY(0);
        opacity: 1;
        transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1),
                    opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .crt-stage[data-open="true"] .crt-item:nth-child(1) { transition-delay: 26ms; }
      .crt-stage[data-open="true"] .crt-item:nth-child(2) { transition-delay: 48ms; }
      .crt-stage[data-open="true"] .crt-item:nth-child(3) { transition-delay: 70ms; }
      .crt-stage[data-open="true"] .crt-item:nth-child(4) { transition-delay: 92ms; }
      .crt-item-btn {
        width: 100%;
        height: 34px;
        display: flex;
        align-items: center;
        gap: 9px;
        padding: 0 10px;
        background: transparent;
        border: none;
        border-radius: var(--crt-row-r, 8px);
        color: #d1d5db;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .crt-item-btn:hover {
        background: rgba(157, 188, 255, 0.12);
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

    const panelR = 16;
    const shutR = 8;
    const rowR = 8;

    const stage = document.createElement('div');
    stage.className = 'crt-stage';
    stage.style.setProperty('--crt-r', `${panelR}px`);
    stage.style.setProperty('--crt-shut-r', `${shutR}px`);
    stage.style.setProperty('--crt-row-r', `${rowR}px`);

    const menuItemsHtml = items
      .map((it) => {
        const iconSvg = ICONS[it.icon] || it.iconHtml || ICONS.plus;
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
      <div class="crt-blobs" aria-hidden="true">
        <div class="crt-body"></div>
      </div>
      <button class="crt-pill" type="button" aria-expanded="false">
        <span class="crt-glyph" aria-hidden="true">${ICONS.plus}</span>
        <span class="crt-say"><span>${label}</span></span>
      </button>
      <div class="crt-panel">
        <ul class="crt-menu">
          ${menuItemsHtml}
        </ul>
      </div>
    `;

    container.replaceChildren(stage);

    const sayEl = stage.querySelector('.crt-say span');
    const pillBtn = stage.querySelector('.crt-pill');
    const panelEl = stage.querySelector('.crt-panel');
    const bodyEl = stage.querySelector('.crt-body');

    // spring physics state corresponding to framer motion liquid still
    const spring = {
      w: { current: 92, target: 92, vel: 0 },
      h: { current: 30, target: 30, vel: 0 },
      r: { current: 8, target: 8, vel: 0 }
    };
    let raf = 0;
    let prevNow = 0;

    const stepAxis = (axis, dt) => {
      const substeps = 4;
      const sdt = dt / substeps;
      for (let s = 0; s < substeps; s++) {
        const force = -420 * (axis.current - axis.target);
        const damping = -30 * axis.vel;
        const accel = (force + damping) / 0.5;
        axis.vel += accel * sdt;
        axis.current += axis.vel * sdt;
      }
      if (Math.abs(axis.current - axis.target) < 0.05 && Math.abs(axis.vel) < 0.05) {
        axis.current = axis.target;
        axis.vel = 0;
      }
    };

    const tickSpring = (now) => {
      const dt = prevNow ? Math.min(0.05, (now - prevNow) / 1000) : 1 / 60;
      prevNow = now;

      stepAxis(spring.w, dt);
      stepAxis(spring.h, dt);
      stepAxis(spring.r, dt);

      bodyEl.style.width = `${spring.w.current.toFixed(2)}px`;
      bodyEl.style.height = `${spring.h.current.toFixed(2)}px`;
      bodyEl.style.borderRadius = `${spring.r.current.toFixed(2)}px`;

      const settled =
        spring.w.current === spring.w.target &&
        spring.h.current === spring.h.target &&
        spring.r.current === spring.r.target &&
        spring.w.vel === 0 &&
        spring.h.vel === 0 &&
        spring.r.vel === 0;

      if (!settled) {
        raf = requestAnimationFrame(tickSpring);
      } else {
        raf = 0;
        prevNow = 0;
      }
    };

    const animateSpringTo = (targetW, targetH, targetR) => {
      spring.w.target = targetW;
      spring.h.target = targetH;
      spring.r.target = targetR;
      if (!raf) {
        prevNow = performance.now();
        raf = requestAnimationFrame(tickSpring);
      }
    };

    let isOpen = false;
    let sinkTimeout = 0;
    let computedPillW = 92;

    const updatePillWidth = () => {
      const sayW = (sayEl?.offsetWidth || 48) + 1;
      computedPillW = 14 + 6 + sayW + 24;
      stage.style.setProperty('--pill-w', `${computedPillW}px`);
      if (!isOpen) {
        spring.w.current = computedPillW;
        spring.w.target = computedPillW;
        bodyEl.style.width = `${computedPillW}px`;
      }
    };

    updatePillWidth();
    if (document.fonts?.ready) {
      document.fonts.ready.then(updatePillWidth).catch(() => {});
    }

    const openMenu = () => {
      stage.setAttribute('data-sink', 'true');
      clearTimeout(sinkTimeout);
      sinkTimeout = setTimeout(() => {
        stage.removeAttribute('data-sink');
        stage.setAttribute('data-open', 'true');
        pillBtn.setAttribute('aria-expanded', 'true');
        isOpen = true;
        animateSpringTo(206, 160, 16);
      }, 60);
    };

    const closeMenu = () => {
      clearTimeout(sinkTimeout);
      stage.removeAttribute('data-sink');
      stage.removeAttribute('data-open');
      pillBtn.setAttribute('aria-expanded', 'false');
      isOpen = false;
      animateSpringTo(computedPillW, 30, 8);
    };

    pillBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isOpen) {
        openMenu();
      } else {
        closeMenu();
      }
    });

    // hit test click outside
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
        if (raf) cancelAnimationFrame(raf);
        clearTimeout(sinkTimeout);
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
