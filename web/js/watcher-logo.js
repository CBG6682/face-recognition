// interactive eye tracker logo
(function() {
  const stillness = () =>
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const R = 50;
  const GAP = 0.19;
  const TILT = 64;

  const STYLES = {
    Slant: { w: 9, h: 15, r: 4.5 },
    Dots: { w: 11, h: 11, r: 5.5 },
    Squares: { w: 12, h: 12, r: 3.5 }
  };

  const SHAPES = {
    Ball: 'M50 0 A50 50 0 1 1 49.99 0 Z',
    Circle: 'M50 7 A43 43 0 1 1 49.99 7 Z',
    Cube: 'M30 6 H70 A24 24 0 0 1 94 30 V70 A24 24 0 0 1 70 94 H30 A24 24 0 0 1 6 70 V30 A24 24 0 0 1 30 6 Z',
    Pill: 'M34 17 H66 A33 33 0 0 1 66 83 H34 A33 33 0 0 1 34 17 Z',
    Hexagon: 'M59.53 8.50 L81.18 21.00 Q90.70 26.50 90.70 37.50 L90.70 62.50 Q90.70 73.50 81.18 79.00 L59.53 91.50 Q50.00 97.00 40.47 91.50 L18.82 79.00 Q9.30 73.50 9.30 62.50 L9.30 37.50 Q9.30 26.50 18.82 21.00 L40.47 8.50 Q50.00 3.00 59.53 8.50 Z',
    'Hex flat': 'M91.50 59.53 L79.00 81.18 Q73.50 90.70 62.50 90.70 L37.50 90.70 Q26.50 90.70 21.00 81.18 L8.50 59.53 Q3.00 50.00 8.50 40.47 L21.00 18.82 Q26.50 9.30 37.50 9.30 L62.50 9.30 Q73.50 9.30 79.00 18.82 L91.50 40.47 Q97.00 50.00 91.50 59.53 Z'
  };

  const LINES = [
    'Hey, I see you.',
    'Boop.',
    'That tickles.',
    'Hi there!',
    'Stop poking me.',
    'I am watching you.',
    'Again? Okay.',
    'Face detected!'
  ];

  const TINTS = ['#3b5bff', '#179c52', '#e0307f', '#38bdf8'];
  const KEY_MS = 36;
  const HOLD_MS = 1600;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  let styleInjected = false;
  function injectStyles() {
    if (styleInjected || typeof document === 'undefined') return;
    styleInjected = true;
    const style = document.createElement('style');
    style.id = 'eyt-logo-styles';
    style.textContent = `
      .eyt-wrap {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: var(--eyt-size, 34px);
        height: var(--eyt-size, 34px);
        user-select: none;
        flex-shrink: 0;
      }
      .eyt-svg {
        width: 100%;
        height: 100%;
        display: block;
        cursor: pointer;
        overflow: visible;
        transition: transform 0.16s cubic-bezier(0.16, 1, 0.3, 1);
        filter: drop-shadow(0 2px 8px rgba(42, 70, 144, 0.35));
      }
      .eyt-wrap:hover .eyt-svg {
        transform: scale(1.06);
      }
      .eyt-wrap:active .eyt-svg {
        transform: scale(0.94);
      }
      .eyt-body-path {
        fill: url(#eyt-default-grad);
        stroke: none;
      }
      .eyt-eye-rect {
        fill: #ffffff;
      }
      .eyt-say {
        position: absolute;
        left: calc(100% + 9px);
        top: 50%;
        transform: translateY(-50%) scale(0.85);
        transform-origin: left center;
        background: rgba(10, 14, 24, 0.96);
        border: 1px solid var(--tint, #3b5bff);
        box-shadow: 0 10px 25px -4px rgba(0, 0, 0, 0.75), 0 0 14px -2px var(--tint, #3b5bff);
        color: #ffffff;
        font-size: 11px;
        font-weight: 500;
        padding: 4px 10px;
        border-radius: 9999px;
        white-space: nowrap;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.16s ease, transform 0.16s cubic-bezier(0.16, 1, 0.3, 1);
        z-index: 100;
        backdrop-filter: blur(12px);
      }
      .eyt-say[data-on="true"] {
        opacity: 1;
        transform: translateY(-50%) scale(1);
        pointer-events: auto;
      }
      .eyt-caret {
        display: inline-block;
        width: 2px;
        height: 10px;
        margin-left: 2px;
        vertical-align: middle;
        background: var(--tint, #3b5bff);
        animation: eyt-blink 0.8s infinite;
      }
      @keyframes eyt-blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  let nextId = 0;

  function createWatcher(container, opts = {}) {
    injectStyles();

    const follow = opts.follow ?? 65;
    const bounce = opts.bounce ?? 28;
    const size = opts.size ?? 34;
    const shape = opts.shape ?? 'Cube';
    const look = opts.eyes ?? 'Slant';
    const eyeScale = opts.eyeScale ?? 1.05;
    const idle = opts.idle ?? false;

    const baseEye = STYLES[look] ?? STYLES.Slant;
    const eyeNow = {
      w: baseEye.w * eyeScale,
      h: baseEye.h * eyeScale,
      r: baseEye.r * eyeScale
    };

    const clipId = `eyt-clip-${++nextId}`;
    const gradId = `eyt-grad-${nextId}`;

    const bodyPath = SHAPES[shape] ?? SHAPES.Cube;

    const wrap = document.createElement('div');
    wrap.className = 'eyt-wrap';
    wrap.setAttribute('role', 'img');
    wrap.setAttribute('aria-label', 'Watcher logo');
    wrap.style.setProperty('--eyt-size', `${size}px`);

    wrap.innerHTML = `
      <svg class="eyt-svg" viewBox="0 0 100 100">
        <defs>
          <clipPath id="${clipId}">
            <path class="eyt-clip-path" d="${bodyPath}" />
          </clipPath>
          <linearGradient id="${gradId}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#2a4690" />
            <stop offset="100%" stop-color="#0a101d" />
          </linearGradient>
        </defs>
        <path class="eyt-body-path" style="fill: url(#${gradId})" d="${bodyPath}" />
        <g clip-path="url(#${clipId})">
          <g class="eyt-eye-group">
            <rect class="eyt-eye-rect" x="${-eyeNow.w / 2}" y="${-eyeNow.h / 2}" width="${eyeNow.w}" height="${eyeNow.h}" rx="${eyeNow.r}" />
          </g>
          <g class="eyt-eye-group">
            <rect class="eyt-eye-rect" x="${-eyeNow.w / 2}" y="${-eyeNow.h / 2}" width="${eyeNow.w}" height="${eyeNow.h}" rx="${eyeNow.r}" />
          </g>
        </g>
      </svg>
      <span class="eyt-say" aria-live="polite">
        <span class="eyt-typed"></span>
        <span class="eyt-caret"></span>
      </span>
    `;

    container.replaceChildren(wrap);

    const eyeGroups = wrap.querySelectorAll('.eyt-eye-group');
    const eyeRects = wrap.querySelectorAll('.eyt-eye-rect');
    const sayEl = wrap.querySelector('.eyt-say');
    const typedEl = wrap.querySelector('.eyt-typed');

    // spring and gaze state
    const t = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 };
    let raf = 0;
    let prev = 0;
    let blink = 0;
    let nextBlink = performance.now() + 2000;
    const still = stillness();

    const draw = (now) => {
      let lid = 1;
      if (now > nextBlink) {
        blink = now;
        nextBlink = now + (idle ? 2000 : 2500 + Math.random() * 3000);
      }
      const since = now - blink;
      if (since < 160) {
        lid = 1 - 0.9 * Math.sin((since / 160) * Math.PI);
      }

      const as = (v) => Math.asin(clamp(v, -0.92, 0.92));
      const yaw = as(t.x);
      const pitch = -as(t.y);
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const cp = Math.cos(pitch), sp = Math.sin(pitch);
      const tilt = TILT * t.x * t.y;
      const g0 = GAP * Math.max(1, eyeScale * 0.8);

      [-g0, g0].forEach((x0, i) => {
        const g = eyeGroups[i];
        const rect = eyeRects[i];
        if (!g || !rect) return;

        const z0 = Math.sqrt(1 - x0 * x0);
        const x1 = x0 * cy + z0 * sy;
        const z1 = -x0 * sy + z0 * cy;
        const y2 = -z1 * sp;
        const z2 = z1 * cp;

        const near = clamp(z2, 0, 1);
        const k = 0.45 + 0.55 * near;
        const sx = k * (0.7 + 0.3 * near);

        const w = eyeNow.w * sx;
        const h = Math.max(0.6, eyeNow.h * k * lid);

        rect.setAttribute('x', (-w / 2).toFixed(2));
        rect.setAttribute('y', (-h / 2).toFixed(2));
        rect.setAttribute('width', w.toFixed(2));
        rect.setAttribute('height', h.toFixed(2));
        rect.setAttribute('rx', Math.min(eyeNow.r, w / 2, h / 2).toFixed(2));

        g.setAttribute(
          'transform',
          `translate(${(50 + x1 * R).toFixed(2)} ${(50 + y2 * R).toFixed(2)}) rotate(${tilt.toFixed(2)})`
        );
        g.style.opacity = z2 < 0.05 ? '0' : '1';
      });
    };

    const tick = (now) => {
      const dt = prev ? Math.min(2.5, (now - prev) / 16.67) : 1;
      prev = now;

      if (still) {
        t.x = t.tx;
        t.y = t.ty;
      } else {
        const k = 0.06;
        const d = 0.34 - (clamp(bounce, 0, 100) / 100) * 0.22;
        t.vx += ((t.tx - t.x) * k - t.vx * d) * dt;
        t.vy += ((t.ty - t.y) * k - t.vy * d) * dt;
        t.x += t.vx * dt;
        t.y += t.vy * dt;
      }

      draw(now);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // gaze tracking
    const aim = (e) => {
      const r = wrap.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy) || 1;
      const reach = 300;
      const far = Math.min(0.85, Math.tanh(d / reach) * (clamp(follow, 0, 100) / 100) * 1.5);
      t.tx = (dx / d) * far;
      t.ty = (dy / d) * far;
    };

    const rest = () => {
      t.tx = 0;
      t.ty = 0;
    };

    window.addEventListener('pointermove', aim, { passive: true });
    document.documentElement.addEventListener('pointerleave', rest);

    // poke chat interaction
    let turn = 0;
    let lastLine = -1;

    const poke = async (e) => {
      e.stopPropagation();
      e.preventDefault();
      const mine = ++turn;
      const pool = LINES.map((_, i) => i).filter((i) => i !== lastLine);
      const i = pool[Math.floor(Math.random() * pool.length)];
      lastLine = i;
      const line = LINES[i];
      const tint = TINTS[Math.floor(Math.random() * TINTS.length)];

      sayEl.style.setProperty('--tint', tint);
      typedEl.textContent = '';
      sayEl.setAttribute('data-on', 'true');

      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      for (let k = 1; k <= line.length; k++) {
        await wait(KEY_MS + Math.random() * 24);
        if (mine !== turn) return;
        typedEl.textContent = line.slice(0, k);
      }

      await wait(HOLD_MS);
      if (mine !== turn) return;
      sayEl.removeAttribute('data-on');
    };

    wrap.querySelector('.eyt-svg').addEventListener('click', poke);

    return {
      destroy() {
        cancelAnimationFrame(raf);
        window.removeEventListener('pointermove', aim);
        document.documentElement.removeEventListener('pointerleave', rest);
      }
    };
  }

  // auto initialize all containers with data-eye-watcher or .eye-watcher-logo
  function autoInit() {
    const targets = document.querySelectorAll('[data-eye-watcher], .eye-watcher-logo');
    targets.forEach((el) => {
      if (el._watcherInited) return;
      el._watcherInited = true;
      const size = parseInt(el.dataset.size || '32', 10);
      const shape = el.dataset.shape || 'Cube';
      createWatcher(el, { size, shape });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }

  window.createWatcher = createWatcher;
})();
