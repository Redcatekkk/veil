import { ReactNode, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Pos = "top" | "bottom" | "left";

interface TooltipProps {
  label: string;
  pos?: Pos;
  delay?: number;
  children: ReactNode;
}

const PAD = 8;
const GAP = 8;

function Tooltip({ label, pos = "bottom", delay = 350, children }: TooltipProps) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState({ left: 0, top: 0 });

  useLayoutEffect(() => {
    if (!open || !wrapRef.current || !tipRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    const t = tipRef.current.getBoundingClientRect();

    let left: number;
    let top: number;
    if (pos === "left") {
      left = r.left - t.width - GAP;
      top = r.top + r.height / 2 - t.height / 2;
    } else if (pos === "top") {
      left = r.left + r.width / 2 - t.width / 2;
      top = r.top - t.height - GAP;
    } else {
      left = r.left + r.width / 2 - t.width / 2;
      top = r.bottom + GAP;
    }

    left = Math.max(PAD, Math.min(left, window.innerWidth - t.width - PAD));
    top = Math.max(PAD, Math.min(top, window.innerHeight - t.height - PAD));
    setStyle({ left, top });
  }, [open, pos, label]);

  const show = () => {
    clear();
    timer.current = window.setTimeout(() => setOpen(true), delay);
  };
  const clear = () => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = undefined;
    }
  };
  const hide = () => {
    clear();
    setOpen(false);
  };

  return (
    <span
      ref={wrapRef}
      className="tt-wrap"
      onMouseEnter={show}
      onMouseLeave={hide}
      onMouseDown={hide}
    >
      {children}
      {open &&
        createPortal(
          <span ref={tipRef} className="tt" style={style}>
            {label}
          </span>,
          document.body
        )}
    </span>
  );
}

export default Tooltip;
