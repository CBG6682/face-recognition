import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { FileText, Folder, Grid2x2, Plus, Table2 } from "lucide-react";

// liquid morphing create menu component
const LIQUID = {
  type: "spring" as const,
  stiffness: 220,
  damping: 14,
  mass: 0.5,
};

const LIQUID_STILL = { ...LIQUID, stiffness: 420, damping: 30 };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const ITEMS = [
  { icon: FileText, label: "Document" },
  { icon: Table2, label: "Spreadsheet" },
  { icon: Grid2x2, label: "Board" },
  { icon: Folder, label: "Folder" },
];

const CRT_CORNER = 20;
const CRT_MAX = 40;

export function Create({ corner = CRT_CORNER }: { corner?: number } = {}) {
  const [open, setOpen] = useState(false);
  const [sink, setSink] = useState(false);

  const panel = useRef<HTMLDivElement | null>(null);
  const say = useRef<HTMLSpanElement | null>(null);
  const beat = useRef(0);

  const [sayW, setSayW] = useState(96);

  useLayoutEffect(() => {
    const el = say.current;
    if (!el) return;
    let live = true;
    const measure = () => { if (live) setSayW(el.offsetWidth + 1); };
    measure();
    document.fonts?.ready.then(measure).catch(() => {});
    return () => { live = false; };
  }, []);

  useEffect(() => () => {
    window.clearTimeout(beat.current);
  }, []);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!e.isTrusted) return;
      const box = panel.current
        ?.querySelector(".crt-panel")
        ?.getBoundingClientRect();
      const on =
        !!box &&
        e.clientX >= box.left && e.clientX <= box.right &&
        e.clientY >= box.top && e.clientY <= box.bottom;
      if (!on) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const press = () => {
    setSink(true);
    window.clearTimeout(beat.current);
    beat.current = window.setTimeout(() => {
      setSink(false);
      setOpen(true);
    }, 60);
  };

  const pillW = 14 + 6 + sayW + 24;
  const panelR = clamp(corner, 0, CRT_MAX);
  const shutR = 8;

  return (
    <motion.div
      className="crt-stage"
      data-open={open || undefined}
      data-sink={sink || undefined}
      ref={panel}
      style={{
        "--pill-w": `${pillW}px`,
        "--crt-r": `${clamp(corner, 0, CRT_MAX)}px`,
        "--crt-shut-r": `${shutR}px`,
        "--crt-row-r": `${Math.min(17, Math.max(0, clamp(corner, 0, CRT_MAX) - 10)).toFixed(2)}px`,
      } as React.CSSProperties}
    >
      <div className="crt-blobs" aria-hidden="true">
        <motion.div
          className="crt-body"
          animate={{
            width: open ? 206 : pillW,
            height: open ? 160 : 30,
            borderRadius: open ? panelR : shutR,
          }}
          transition={LIQUID_STILL}
        />
      </div>

      <button className="crt-pill" onClick={press} aria-expanded={open}>
        <span className="crt-glyph" aria-hidden="true">
          <Plus size={13} strokeWidth={2.2} />
        </span>
        <span className="crt-say" style={{ width: sayW || undefined }}>
          <span ref={say}>Create</span>
        </span>
      </button>

      <div className="crt-panel">
        <ul className="crt-menu">
          {ITEMS.map((it, i) => (
            <li
              className="crt-item"
              key={it.label}
              style={{ transitionDelay: open ? `${30 + i * 22}ms` : "0ms" }}
            >
              <button
                onClick={() => { setOpen(false); }}
              >
                <it.icon size={16} strokeWidth={2} />
                {it.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}
