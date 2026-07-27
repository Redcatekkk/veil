import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type Busy = null | "starting" | "stopping" | "killing" | "restarting";

interface SteamStatus {
  installed: boolean;
  path: string | null;
  running: boolean;
}

interface SteamWidgetProps {
  collapsed: boolean;
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function SteamWidget({ collapsed }: SteamWidgetProps) {
  const [open, setOpen] = useState(false);
  const [installed, setInstalled] = useState(true);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const ref = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const status = await invoke<SteamStatus>("steam_status");
      setInstalled(status.installed);
      setRunning(status.running);
    } catch {
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 3000);
    return () => window.clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (collapsed) setOpen(false);
  }, [collapsed]);

  const waitFor = async (target: boolean) => {
    for (let i = 0; i < 24; i++) {
      await new Promise((r) => setTimeout(r, 600));
      try {
        const status = await invoke<SteamStatus>("steam_status");
        setRunning(status.running);
        if (status.running === target) return;
      } catch {
      }
    }
  };

  const run = async (cmd: string, phase: Busy, target: boolean) => {
    setOpen(false);
    setBusy(phase);
    try {
      await invoke(cmd);
      await waitFor(target);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(null);
      refresh();
    }
  };

  const label = busy
    ? {
        starting: "Starting",
        stopping: "Stopping",
        killing: "Stopping",
        restarting: "Restarting",
      }[busy]
    : installed
    ? running
      ? "Running"
      : "Stopped"
    : "Not found";

  const dotClass = busy
    ? busy === "starting"
      ? "starting"
      : "stopping"
    : running
    ? "running"
    : "stopped";

  return (
    <div className="steam" ref={ref}>
      {open && (
        <div className="steam-menu">
          {!installed ? (
            <div className="steam-empty">Steam not found</div>
          ) : running ? (
            <>
              <button
                className="steam-action"
                onClick={() => run("steam_stop", "stopping", false)}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
                </svg>
                <span className="steam-action-label">Stop</span>
              </button>
              <button
                className="steam-action danger"
                onClick={() => run("steam_kill", "killing", false)}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" {...stroke}>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
                <span className="steam-action-label">Kill</span>
              </button>
              <button
                className="steam-action"
                onClick={() => run("steam_restart", "restarting", true)}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" {...stroke}>
                  <path d="M20 11a8 8 0 1 0-.6 4" />
                  <path d="M20 5v6h-6" />
                </svg>
                <span className="steam-action-label">Restart</span>
              </button>
            </>
          ) : (
            <button
              className="steam-action"
              onClick={() => run("steam_start", "starting", true)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M7 5l12 7-12 7z" fill="currentColor" />
              </svg>
              <span className="steam-action-label">Start</span>
            </button>
          )}
        </div>
      )}

      <button
        className={`steam-trigger${open ? " open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        disabled={busy !== null}
      >
        <span className="steam-logo">
          <img src="/icons/steam.svg" alt="" draggable={false} />
        </span>
        <span className="steam-name">Steam</span>
        <span className={`steam-status ${dotClass}`}>
          <span className="steam-dot" />
          {label}
        </span>
        <svg
          className="steam-chevron"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
    </div>
  );
}

export default SteamWidget;
