import {
  CSSProperties,
  ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

interface SmoothScrollProps {
  className?: string;
  children: ReactNode;
  deps?: unknown[];
}

const FADE = 28;
const EASE = 0.18;

function SmoothScroll({ className, children, deps = [] }: SmoothScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState({ top: 0, bottom: 0 });

  const updateFade = () => {
    const el = ref.current;
    if (!el) return;
    setFade({
      top: Math.min(el.scrollTop, FADE),
      bottom: Math.min(el.scrollHeight - el.clientHeight - el.scrollTop, FADE),
    });
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let target = el.scrollTop;
    let current = el.scrollTop;
    let raf = 0;
    let animating = false;

    const clamp = (v: number) =>
      Math.max(0, Math.min(v, el.scrollHeight - el.clientHeight));

    const tick = () => {
      current += (target - current) * EASE;
      if (Math.abs(target - current) < 0.4) {
        current = target;
        animating = false;
      }
      el.scrollTop = current;
      if (animating) raf = requestAnimationFrame(tick);
    };

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      let delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 16;
      else if (e.deltaMode === 2) delta *= el.clientHeight;
      if (delta === 0) return;
      e.preventDefault();
      target = clamp((animating ? target : el.scrollTop) + delta);
      if (!animating) {
        animating = true;
        current = el.scrollTop;
        raf = requestAnimationFrame(tick);
      }
    };

    const onScroll = () => {
      updateFade();
      if (!animating) {
        target = el.scrollTop;
        current = el.scrollTop;
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("scroll", onScroll, { passive: true });
    updateFade();
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  useLayoutEffect(() => {
    updateFade();
  }, deps);

  useEffect(() => {
    window.addEventListener("resize", updateFade);
    return () => window.removeEventListener("resize", updateFade);
  }, []);

  const mask = `linear-gradient(to bottom, transparent 0, #000 ${fade.top}px, #000 calc(100% - ${fade.bottom}px), transparent 100%)`;
  const style: CSSProperties = { maskImage: mask, WebkitMaskImage: mask };

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}

export default SmoothScroll;
