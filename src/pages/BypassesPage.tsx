import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { listen } from "@tauri-apps/api/event";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  ArrowSquareOut,
  ArrowsClockwise,
  Check,
  CircleNotch,
  DownloadSimple,
  FolderOpen,
  MagnifyingGlass,
  Trash,
  Warning,
  X,
} from "@phosphor-icons/react";
import SmartImage from "../components/SmartImage";
import SmoothScroll from "../components/SmoothScroll";
import Tooltip from "../components/Tooltip";
import { openUrl } from "../lib/library";
import { isSteamRunning, killSteam, startSteam } from "../lib/steam";
import { useInView } from "../lib/dlc";
import {
  bypassCheck,
  bypassInstall,
  bypassRemove,
  bypassSetLaunchOptions,
  fetchBypasses,
  type BypassCheckResult,
  type BypassInfo,
  type BypassProgress,
} from "../lib/bypasses";
import type { ToastKind } from "../lib/useToast";
import "./bypasses.css";

const OVERRIDE_KEY = "veil.bypass.overrides.v1";

function loadOverrides(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(OVERRIDE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveOverrides(map: Record<string, string>) {
  localStorage.setItem(OVERRIDE_KEY, JSON.stringify(map));
}

type Busy = { id: number; kind: "installing" | "removing" } | null;

function artSource(appId: number) {
  return [`app/${appId}`];
}

function BypassCard({
  item,
  status,
  busy,
  progress,
  index,
  onOpen,
  onGet,
  onVisible,
}: {
  item: BypassInfo;
  status: BypassCheckResult | null;
  busy: boolean;
  progress: BypassProgress | null;
  index: number;
  onOpen: () => void;
  onGet: () => void;
  onVisible: () => void;
}) {
  const [ref, inView] = useInView<HTMLDivElement>();

  useEffect(() => {
    if (inView) onVisible();
  }, [inView]);

  const state = status?.state;
  const pct =
    progress && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : null;

  return (
    <div
      ref={ref}
      className="bypass-card"
      style={{ animationDelay: `${Math.min(index * 0.025, 0.25)}s` }}
      onClick={onOpen}
    >
      <SmartImage sources={artSource(item.AppID)} className="bypass-art" />
      <div className="bypass-overlay">
        <div className="bypass-meta">
          <p className="bypass-name">{item.AppName}</p>
          <p className="bypass-sub">
            App ID {item.AppID} · {item.LastUpdated}
          </p>
        </div>

        {busy ? (
          <span className="bypass-badge busy">
            <CircleNotch size={12} weight="bold" className="spin" />
            {pct !== null ? `${pct}%` : "…"}
          </span>
        ) : state === "installed" ? (
          <span className="bypass-badge installed">
            <Check size={12} weight="bold" />
            Installed
          </span>
        ) : state === "available" ? (
          <button
            className="bypass-badge get"
            onClick={(e) => {
              e.stopPropagation();
              onGet();
            }}
          >
            <DownloadSimple size={12} weight="bold" />
            Get
          </button>
        ) : state === "wrong_version" ? (
          <Tooltip
            label={`Requires build ${status?.required_build ?? "?"}${
              status?.actual_build ? ` · installed ${status.actual_build}` : ""
            }`}
            pos="top"
          >
            <span
              className="bypass-badge warn"
              onClick={(e) => e.stopPropagation()}
            >
              <Warning size={12} weight="bold" />
              Wrong build
            </span>
          </Tooltip>
        ) : state === "not_installed" ? (
          <span
            className="bypass-badge muted"
            onClick={(e) => e.stopPropagation()}
          >
            Not installed
          </span>
        ) : (
          <span className="bypass-badge loading">
            <CircleNotch size={12} className="spin" />
          </span>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bp-row">
      <span className="bp-row-label">{label}</span>
      <span className="bp-row-value">{children}</span>
    </div>
  );
}

function BypassModal({
  item,
  status,
  busy,
  progress,
  override,
  onClose,
  onInstall,
  onRepair,
  onRemove,
  onSetOverride,
}: {
  item: BypassInfo;
  status: BypassCheckResult | null;
  busy: Busy;
  progress: BypassProgress | null;
  override: string | null;
  onClose: () => void;
  onInstall: () => void;
  onRepair: () => void;
  onRemove: () => void;
  onSetOverride: (path: string | null) => void;
}) {
  const state = status?.state;
  const isBusy = busy?.id === item.AppID;
  const pct =
    progress && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pickPath = async () => {
    const dir = await openDialog({ directory: true, multiple: false }).catch(
      () => null
    );
    if (typeof dir === "string") onSetOverride(dir);
  };

  return createPortal(
    <div className="bp-modal-overlay" onMouseDown={onClose}>
      <div className="bp-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="bp-modal-art">
          <SmartImage sources={artSource(item.AppID)} className="bp-modal-img" />
          <div className="bp-modal-fade" />
          <h2 className="bp-modal-title">{item.AppName}</h2>
          <button className="bp-modal-close" onClick={onClose} aria-label="Close">
            <X size={15} weight="bold" />
          </button>
        </div>

        <div className="bp-modal-body">
          <DetailRow label="App ID">{item.AppID}</DetailRow>
          <DetailRow label="Updated">{item.LastUpdated}</DetailRow>
          {item.RequiredBuild && (
            <DetailRow label="Build">
              <span className="mono">{item.RequiredBuild}</span>
              {state === "wrong_version" && status?.actual_build && (
                <span className="bp-amber">
                  {" "}
                  · installed <span className="mono">{status.actual_build}</span>
                </span>
              )}
            </DetailRow>
          )}
          <DetailRow label="Files">
            {item.Files.length} file{item.Files.length !== 1 ? "s" : ""}
          </DetailRow>
          {item.LaunchArgs && (
            <DetailRow label="Launch args">
              <span className="bp-dim">Set automatically on install.</span>
            </DetailRow>
          )}
          <DetailRow label="Location">
            {override ? (
              <span className="mono bp-amber break">{override}</span>
            ) : status?.install_dir ? (
              <span className="mono bp-dim break">{status.install_dir}</span>
            ) : (
              <span className="bp-dim">Resolved from your Steam library.</span>
            )}
          </DetailRow>

          <div className="bp-path-row">
            <button className="bp-btn ghost" onClick={pickPath}>
              <FolderOpen size={13} weight="bold" />
              Set game path
            </button>
            {override && (
              <button className="bp-btn ghost" onClick={() => onSetOverride(null)}>
                Reset
              </button>
            )}
            <button
              className="bp-btn plain steam"
              onClick={() =>
                openUrl(`https://store.steampowered.com/app/${item.AppID}`).catch(
                  () => {}
                )
              }
            >
              <ArrowSquareOut size={13} weight="bold" />
              Steam
            </button>
          </div>

          {state === "not_installed" && !override && (
            <p className="bp-note">
              This game isn't detected in your Steam libraries. Install it in Steam
              first, or set the game folder manually above.
            </p>
          )}
          {state === "wrong_version" && (
            <p className="bp-note warn">
              The installed game build doesn't match this bypass. Update the game in
              Steam, or set the path manually to override.
            </p>
          )}

          {isBusy && progress && (
            <div className="bp-progress">
              <div className="bp-progress-head">
                <span>{progress.phase === "extract" ? "Extracting" : "Downloading"}</span>
                <span>{pct !== null ? `${pct}%` : ""}</span>
              </div>
              <div className="bp-progress-track">
                <div className="bp-progress-fill" style={{ width: `${pct ?? 8}%` }} />
              </div>
              {progress.label && <p className="bp-progress-label">{progress.label}</p>}
            </div>
          )}
        </div>

        <div className="bp-modal-actions">
          {state === "installed" ? (
            <>
              <button
                className="bp-btn ghost"
                onClick={onRepair}
                disabled={!!busy}
              >
                {isBusy && busy?.kind === "installing" ? (
                  <CircleNotch size={15} weight="bold" className="spin" />
                ) : (
                  <ArrowsClockwise size={15} weight="bold" />
                )}
                Repair
              </button>
              <button
                className="bp-btn danger"
                onClick={onRemove}
                disabled={!!busy}
              >
                {isBusy && busy?.kind === "removing" ? (
                  <CircleNotch size={15} weight="bold" className="spin" />
                ) : (
                  <Trash size={15} weight="bold" />
                )}
                Remove
              </button>
            </>
          ) : (
            <button
              className="bp-btn primary"
              onClick={onInstall}
              disabled={!!busy || (state === "not_installed" && !override)}
            >
              {isBusy ? (
                <>
                  <CircleNotch size={15} weight="bold" className="spin" />
                  {pct !== null ? `${pct}%` : "Installing…"}
                </>
              ) : (
                <>
                  <DownloadSimple size={15} weight="bold" />
                  {state === "wrong_version" ? "Install anyway" : "Install bypass"}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function BypassesPage({
  steamPath,
  notify,
}: {
  steamPath: string | null;
  notify: (kind: ToastKind, message: string) => void;
}) {
  const [items, setItems] = useState<BypassInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statuses, setStatuses] = useState<Map<number, BypassCheckResult>>(new Map());
  const [busy, setBusy] = useState<Busy>(null);
  const [progress, setProgress] = useState<BypassProgress | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>(() =>
    loadOverrides()
  );
  const [selected, setSelected] = useState<BypassInfo | null>(null);
  const checkedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    let alive = true;
    fetchBypasses()
      .then((list) => {
        if (!alive) return;
        setItems(list);
        setLoading(false);
      })
      .catch(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const unlisten = listen<BypassProgress>("bypass-progress", (e) =>
      setProgress(e.payload)
    );
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const overrideFor = useCallback(
    (appId: number) => overrides[String(appId)] ?? null,
    [overrides]
  );

  const check = useCallback(
    async (item: BypassInfo) => {
      if (!steamPath) return;
      const res = await bypassCheck(
        steamPath,
        item.AppID,
        item.Files,
        overrideFor(item.AppID),
        item.RequiredBuild ?? null
      ).catch(() => null);
      if (res) setStatuses((prev) => new Map(prev).set(item.AppID, res));
    },
    [steamPath, overrideFor]
  );

  const onVisible = useCallback(
    (item: BypassInfo) => {
      if (checkedRef.current.has(item.AppID)) return;
      checkedRef.current.add(item.AppID);
      check(item);
    },
    [check]
  );

  const setOverride = useCallback(
    (appId: number, path: string | null) => {
      setOverrides((prev) => {
        const next = { ...prev };
        if (path) next[String(appId)] = path;
        else delete next[String(appId)];
        saveOverrides(next);
        return next;
      });
      const item = items.find((i) => i.AppID === appId);
      if (item) setTimeout(() => check(item), 0);
    },
    [items, check]
  );

  const applyLaunchArgs = useCallback(
    async (item: BypassInfo, value: string) => {
      if (!item.LaunchArgs || !steamPath) return;
      const running = await isSteamRunning().catch(() => false);
      if (running) await killSteam().catch(() => {});
      await bypassSetLaunchOptions(steamPath, item.AppID, value).catch(() => {});
      if (running) await startSteam().catch(() => {});
    },
    [steamPath]
  );

  const install = useCallback(
    async (item: BypassInfo) => {
      if (!steamPath || busy) return;
      setBusy({ id: item.AppID, kind: "installing" });
      setProgress(null);
      try {
        await bypassInstall(
          steamPath,
          item.AppID,
          overrideFor(item.AppID),
          item.RequiredBuild ?? null
        );
        if (item.LaunchArgs) await applyLaunchArgs(item, item.LaunchArgs);
        await check(item);
        notify("success", `${item.AppName} bypass installed.`);
      } catch (e) {
        notify("error", e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(null);
        setProgress(null);
      }
    },
    [steamPath, busy, overrideFor, applyLaunchArgs, check, notify]
  );

  const remove = useCallback(
    async (item: BypassInfo) => {
      if (!steamPath || busy) return;
      setBusy({ id: item.AppID, kind: "removing" });
      try {
        const res = await bypassRemove(
          steamPath,
          item.AppID,
          item.Files,
          overrideFor(item.AppID)
        );
        if (item.LaunchArgs) await applyLaunchArgs(item, "");
        await check(item);
        notify(
          "success",
          `Removed ${res.removed} file${res.removed !== 1 ? "s" : ""} for ${item.AppName}.`
        );
      } catch (e) {
        notify("error", e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(null);
      }
    },
    [steamPath, busy, overrideFor, applyLaunchArgs, check, notify]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.AppName.toLowerCase().includes(q) || String(it.AppID).includes(q)
    );
  }, [items, query]);

  const selectedStatus = selected ? statuses.get(selected.AppID) ?? null : null;

  return (
    <div className="bypasses">
      <div className="bypasses-search">
        <MagnifyingGlass size={16} className="bypasses-search-icon" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search bypasses…"
        />
        {query && (
          <button
            className="bypasses-search-clear"
            onClick={() => setQuery("")}
            aria-label="Clear"
          >
            <X size={14} weight="bold" />
          </button>
        )}
      </div>

      <div className="bypasses-count">
        {loading
          ? "Bypasses"
          : `${filtered.length} bypass${filtered.length !== 1 ? "es" : ""}`}
      </div>

      {loading ? (
        <div className="bypasses-state">
          <CircleNotch size={22} className="spin" />
          <span className="title">Loading bypasses…</span>
        </div>
      ) : !steamPath ? (
        <div className="bypasses-state">
          <span className="title">Steam installation not found</span>
          <span className="hint">Set your Steam path in Settings.</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bypasses-state">
          <Warning size={24} />
          <span className="title">No bypasses found</span>
        </div>
      ) : (
        <SmoothScroll className="bypasses-grid" deps={[filtered.length]}>
          {filtered.map((item, i) => (
            <BypassCard
              key={item.AppID}
              item={item}
              status={statuses.get(item.AppID) ?? null}
              busy={busy?.id === item.AppID}
              progress={progress?.app_id === item.AppID ? progress : null}
              index={i}
              onOpen={() => setSelected(item)}
              onGet={() => install(item)}
              onVisible={() => onVisible(item)}
            />
          ))}
        </SmoothScroll>
      )}

      {selected && (
        <BypassModal
          item={selected}
          status={selectedStatus}
          busy={busy}
          progress={progress?.app_id === selected.AppID ? progress : null}
          override={overrideFor(selected.AppID)}
          onClose={() => setSelected(null)}
          onInstall={() => install(selected)}
          onRepair={() => install(selected)}
          onRemove={() => remove(selected)}
          onSetOverride={(path) => setOverride(selected.AppID, path)}
        />
      )}
    </div>
  );
}

export default BypassesPage;
