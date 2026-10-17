import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Plus, GraduationCap, BookOpen, UserPlus, Calendar } from "lucide-react";

// liquid morphing create menu component
const LIQUID = {
  type: "spring" as const,
  stiffness: 220,
  damping: 14,
  mass: 0.5,
};

const LIQUID_STILL = { ...LIQUID, stiffness: 420, damping: 30 };

export interface CreateMenuItem {
  icon: any
  label: string
  action: string
}

const DEFAULT_ITEMS: CreateMenuItem[] = [
  { icon: GraduationCap, label: "Lớp học mới", action: "create-class" },
  { icon: BookOpen, label: "Môn học mới", action: "create-subject" },
  { icon: UserPlus, label: "Thêm sinh viên", action: "create-student" },
  { icon: Calendar, label: "Tạo buổi học", action: "create-lesson" },
];

export function Create({
  label = "Tạo mới",
  items = DEFAULT_ITEMS,
  onSelect,
}: {
  label?: string
  items?: CreateMenuItem[]
  onSelect?: (action: string) => void
}) {
  const [open, setOpen] = useState(false);
  const [sink, setSink] = useState(false);

  const panel = useRef<HTMLDivElement | null>(null);
  const say = useRef<HTMLSpanElement | null>(null);
  const beat = useRef(0);

  const [sayW, setSayW] = useState(54);

  useLayoutEffect(() => {
    const el = say.current;
    if (!el) return;
    let live = true;
    const measure = () => { if (live) setSayW(el.offsetWidth + 1); };
    measure();
    document.fonts?.ready.then(measure).catch(() => {});
    return () => { live = false; };
  }, [label]);

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
  const panelR = 16;
  const shutR = 8;

  return (
    <motion.div
      className="crt-stage"
      data-open={open || undefined}
      data-sink={sink || undefined}
      ref={panel}
      style={{
        "--pill-w": `${pillW}px`,
        "--crt-r": `${panelR}px`,
        "--crt-shut-r": `${shutR}px`,
        "--crt-row-r": "8px",
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
          <span ref={say}>{label}</span>
        </span>
      </button>

      <div className="crt-panel">
        <ul className="crt-menu">
          {items.map((it, i) => (
            <li
              className="crt-item"
              key={it.action}
              style={{ transitionDelay: open ? `${26 + i * 22}ms` : "0ms" }}
            >
              <button
                className="crt-item-btn"
                onClick={() => {
                  setOpen(false);
                  if (onSelect) onSelect(it.action);
                }}
              >
                <it.icon size={15} strokeWidth={2} />
                <span>{it.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}
