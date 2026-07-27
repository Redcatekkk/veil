import { useCallback, useEffect, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  ArrowsClockwise,
  CheckCircle,
  CircleNotch,
  DownloadSimple,
  FolderOpen,
  MagnifyingGlass,
  ShieldCheck,
  Warning,
} from "@phosphor-icons/react";
import ConfirmDialog from "../components/ConfirmDialog";
import {
  applyUpdate,
  checkForUpdates,
  getAppConfig,
  redetectSteamPath,
  resetSteam,
  setSteamPath,
  setVeilEnabled,
  veilDisable,
  veilEnable,
  type UpdateStatus,
} from "../lib/config";
import type { LibraryState } from "../lib/useLibrary";
import type { ToastKind } from "../lib/useToast";
import "./settings.css";

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function Toggle({
  on,
  onClick,
  disabled,
}: {
  on: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className={`cfg-switch${on ? " on" : ""}`}
      onClick={onClick}
      disabled={disabled}
      role="switch"
      aria-checked={on}
    >
      <span className="cfg-switch-knob" />
    </button>
  );
}

function SettingsPage({
  library,
  notify,
}: {
  library: LibraryState;
  notify: (kind: ToastKind, message: string) => void;
}) {
  const { steamPath, reload } = library;
  const [veilEnabled, setVeil] = useState(true);
  const [veilBusy, setVeilBusy] = useState(false);
  const [pathBusy, setPathBusy] = useState(false);
  const [redetecting, setRedetecting] = useState(false);
  const [update, setUpdate] = useState<UpdateStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    getAppConfig()
      .then((c) => setVeil(c.veil_enabled))
      .catch(() => {});
    checkForUpdates()
      .then(setUpdate)
      .catch(() => {});
  }, []);

  const toggleVeil = useCallback(async () => {
    if (veilBusy) return;
    const next = !veilEnabled;
    setVeilBusy(true);
    setVeil(next);
    try {
      if (!steamPath) {
        await setVeilEnabled(next);
        if (next) notify("error", "Set your Steam folder first to install Veil.");
      } else if (next) {
        await veilEnable(steamPath);
        notify("success", "Veil enabled.");
      } else {
        await veilDisable(steamPath);
        notify("success", "Veil disabled.");
      }
    } catch (e) {
      setVeil(!next);
      notify("error", e instanceof Error ? e.message : String(e));
    } finally {
      setVeilBusy(false);
    }
  }, [veilEnabled, veilBusy, steamPath, notify]);

  const changeFolder = useCallback(async () => {
    const dir = await openDialog({
      directory: true,
      multiple: false,
      defaultPath: steamPath || undefined,
    }).catch(() => null);
    if (typeof dir !== "string") return;
    setPathBusy(true);
    try {
      await setSteamPath(dir);
      await reload();
      notify("success", "Steam folder updated.");
    } catch (e) {
      notify("error", e instanceof Error ? e.message : String(e));
    } finally {
      setPathBusy(false);
    }
  }, [steamPath, reload, notify]);

  const redetect = useCallback(async () => {
    if (redetecting) return;
    setRedetecting(true);
    const start = performance.now();
    try {
      const cfg = await redetectSteamPath();
      await reload();
      notify(
        cfg.steam_path ? "success" : "error",
        cfg.steam_path
          ? "Steam folder auto-detected."
          : "Couldn't auto-detect Steam. Set it manually."
      );
    } catch (e) {
      notify("error", e instanceof Error ? e.message : String(e));
    } finally {
      const wait = Math.max(0, 1000 - (performance.now() - start));
      window.setTimeout(() => setRedetecting(false), wait);
    }
  }, [redetecting, reload, notify]);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const res = await checkForUpdates();
      setUpdate(res);
      notify(
        "success",
        res.update_available
          ? `Update available: v${res.latest_version}`
          : "You're on the latest version."
      );
    } catch (e) {
      notify("error", e instanceof Error ? e.message : "Couldn't check for updates");
    } finally {
      setChecking(false);
    }
  }, [notify]);

  const doUpdate = useCallback(async () => {
    setUpdating(true);
    try {
      await applyUpdate();
    } catch (e) {
      setUpdating(false);
      notify("error", e instanceof Error ? e.message : "Update failed");
    }
  }, [notify]);

  const doReset = useCallback(async () => {
    setConfirmReset(false);
    if (!steamPath) {
      notify("error", "Set your Steam folder first.");
      return;
    }
    setResetting(true);
    try {
      const res = await resetSteam(steamPath);
      setVeil(false);
      const freed = formatBytes(res.freed_bytes);
      notify(
        res.failed > 0 ? "error" : "success",
        res.failed > 0
          ? `Steam reset — freed ${freed}, but ${res.failed} item(s) couldn't be removed.`
          : `Steam reset — removed ${res.deleted} item(s), freed ${freed}.`
      );
    } catch (e) {
      notify("error", e instanceof Error ? e.message : "Reset failed");
    } finally {
      setResetting(false);
    }
  }, [steamPath, notify]);

  const version = update?.current_version || "3.1.0";
  const hasUpdate = !!update?.update_available;

  return (
    <div className="settings">
      <div className="settings-head">
        <h2 className="settings-title">Settings</h2>
        <p className="settings-sub">Configure Veil and your Steam installation.</p>
      </div>

      {}
      <div className="settings-card">
        <div className="settings-row">
          <div className="settings-row-icon">
            <ShieldCheck size={20} weight="regular" />
          </div>
          <div className="settings-row-main">
            <p className="settings-row-title">Enable Veil</p>
            <p className="settings-row-desc">
              {veilBusy
                ? "Applying — this may close and relaunch Steam…"
                : "Downloads Veil's DLLs into your Steam folder and keeps them current."}
            </p>
          </div>
          {veilBusy ? (
            <CircleNotch size={18} className="spin settings-row-spin" />
          ) : (
            <Toggle on={veilEnabled} onClick={toggleVeil} />
          )}
        </div>
      </div>

      {}
      <div className="settings-card">
        <div className="settings-row">
          <div className="settings-row-main">
            <p className="settings-row-title">Steam folder</p>
            <p className={`settings-path${steamPath ? "" : " unset"}`}>
              {steamPath || "Not detected — set it manually below"}
            </p>
          </div>
          <div className="settings-row-actions">
            <button
              className={`settings-btn redetect${redetecting ? " busy" : ""}`}
              onClick={redetect}
              disabled={pathBusy || redetecting}
              title="Auto-detect"
            >
              <ArrowsClockwise
                size={14}
                weight="bold"
                className={redetecting ? "spin" : ""}
              />
              <span className="redetect-label">
                {redetecting ? "Re-detecting" : "Re-detect"}
              </span>
            </button>
            <button
              className="settings-btn"
              onClick={changeFolder}
              disabled={pathBusy || redetecting}
            >
              <FolderOpen size={14} weight="bold" />
              Change
            </button>
          </div>
        </div>
        {!steamPath && (
          <div className="settings-warn">
            <Warning size={14} weight="fill" />
            Veil couldn't find Steam automatically. Pick your Steam folder (the one
            containing steam.exe) to use the other tabs.
          </div>
        )}
      </div>

      <div className="settings-card">
        <div className="settings-row">
          <div className="settings-row-main">
            <p className="settings-row-title">Veil version</p>
            <p className="settings-version">
              <span className="settings-version-num">v{version}</span>
              {update &&
                (hasUpdate ? (
                  <span className="settings-version-badge update">
                    v{update.latest_version} available
                  </span>
                ) : (
                  <span className="settings-version-badge ok">
                    <CheckCircle size={12} weight="fill" />
                    Up to date
                  </span>
                ))}
            </p>
          </div>
          <div className="settings-row-actions">
            <button
              className="settings-btn"
              onClick={check}
              disabled={checking || updating}
            >
              {checking ? (
                <CircleNotch size={14} weight="bold" className="spin" />
              ) : (
                <MagnifyingGlass size={14} weight="bold" />
              )}
              Check for updates
            </button>
            {hasUpdate && (
              <button
                className="settings-btn accent"
                onClick={doUpdate}
                disabled={updating}
              >
                {updating ? (
                  <CircleNotch size={14} weight="bold" className="spin" />
                ) : (
                  <DownloadSimple size={14} weight="bold" />
                )}
                {updating ? "Updating…" : `Update to v${update?.latest_version}`}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="settings-card danger">
        <div className="settings-row">
          <div className="settings-row-main">
            <p className="settings-row-title">Reset Steam</p>
            <p className="settings-row-desc">
              Restore Steam to a clean state. Use this if Steam is misbehaving after
              using Veil.
            </p>
          </div>
          <button
            className="settings-btn danger"
            onClick={() => setConfirmReset(true)}
            disabled={resetting}
          >
            {resetting ? (
              <CircleNotch size={14} weight="bold" className="spin" />
            ) : (
              <ArrowsClockwise size={14} weight="bold" />
            )}
            Reset Steam
          </button>
        </div>
      </div>

      {confirmReset && (
        <ConfirmDialog
          title="Reset Steam?"
          message="Closes Steam, clears its rebuildable client files (and Veil's DLLs), then relaunches so it repairs itself. Your games, saves, and login stay intact. Veil will be turned off."
          confirmLabel="Reset Steam"
          danger
          onConfirm={doReset}
          onCancel={() => setConfirmReset(false)}
        />
      )}
    </div>
  );
}

export default SettingsPage;
