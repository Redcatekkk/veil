import { useEffect, useRef, useState, type RefObject } from "react";
import { getAppsMeta, type AppMeta } from "./library";

export function useInView<T extends Element>(): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (inView) return;
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setInView(true);
      },
      { rootMargin: "300px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [inView]);

  return [ref, inView];
}

interface ReleasedDlc {
  dlcIds: number[];
  metas: Map<number, AppMeta>;
  loading: boolean;
}

export function useReleasedDlc(
  gridDlcIds: number[],
  enabled = true
): ReleasedDlc {
  const [result, setResult] = useState<ReleasedDlc>({
    dlcIds: [],
    metas: new Map(),
    loading: true,
  });
  const gridKey = gridDlcIds.join(",");

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    (async () => {
      const ids = gridKey ? gridKey.split(",").map(Number) : [];
      const metas = await getAppsMeta(ids).catch(() => [] as AppMeta[]);
      if (!alive) return;
      const metaMap = new Map(metas.map((m) => [m.app_id, m]));
      const released = ids.filter((id) => metaMap.get(id)?.released);
      setResult({ dlcIds: released, metas: metaMap, loading: false });
    })();
    return () => {
      alive = false;
    };
  }, [gridKey, enabled]);

  return result;
}
