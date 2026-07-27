import { useCallback, useRef, useState } from "react";

export type ToastKind = "success" | "error";

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

export interface ToastApi {
  toast: Toast | null;
  notify: (kind: ToastKind, message: string) => void;
  dismiss: () => void;
}

export function useToast(): ToastApi {
  const [toast, setToast] = useState<Toast | null>(null);
  const id = useRef(0);

  const notify = useCallback((kind: ToastKind, message: string) => {
    id.current += 1;
    setToast({ id: id.current, kind, message });
  }, []);

  const dismiss = useCallback(() => setToast(null), []);

  return { toast, notify, dismiss };
}
