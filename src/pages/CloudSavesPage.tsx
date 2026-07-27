import { useCallback, useEffect, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  Archive,
  CircleNotch,
  CloudArrowUp,
  FolderOpen,
  UploadSimple,
  Warning,
} from "@phosphor-icons/react";
import ConfirmDialog from "../components/ConfirmDialog";
import RestartBanner from "../components/RestartBanner";
import { restartSteam } from "../lib/steam";
import {
  cloudSavesBackup,
  cloudSavesDisable,
  cloudSavesEnable,
  cloudSavesImport,
  cloudSavesSetFolder,
  cloudSavesSetLogging,
  cloudSavesStatus,
  type CloudSavesStatus,
} from "../lib/cloudsave";
import type { ToastKind } from "../lib/useToast";
import "./cloudsaves.css";

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

function HeaderButton({
  onClick,
  disabled,
  busy,
  icon,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      className="cloud-header-btn"
      onClick={onClick}
      disabled={disabled || busy}
    >
      {busy ? <CircleNotch size={14} weight="bold" className="spin" /> : icon}
      {children}
    </button>
  );
}

function CloudSavesPage({
  steamPath,
  notify,
}: {
  steamPath: string | null;
  notify: (kind: ToastKind, message: string) => void;
}) {
  const [status, setStatus] = useState<CloudSavesStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [confirmEnable, setConfirmEnable] = useState(false);
  const [restartNeeded, setRestartNeeded] = useState(false);
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    if (!steamPath) return;
    cloudSavesStatus(steamPath).then(setStatus).catch(() => {});
  }, [steamPath]);

  const flagRestart = (next: CloudSavesStatus) => {
    if (next.steam_running) setRestartNeeded(true);
  };

  const doEnable = useCallback(async () => {
    if (!steamPath || !status || busy) return;
    setBusy(true);
    try {
      const next = await cloudSavesEnable(steamPath, status.sync_path);
      setStatus(next);
      notify("success", "Cloud Saves enabled.");
      flagRestart(next);
    } catch (e) {
      notify("error", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [steamPath, status, busy, notify]);

  const disable = useCallback(async () => {
    if (!steamPath || !status || busy) return;
    setBusy(true);
    try {
      const next = await cloudSavesDisable(steamPath);
      setStatus(next);
      notify("success", "Cloud Saves disabled.");
      flagRestart(next);
    } catch (e) {
      notify("error", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [steamPath, status, busy, notify]);

  const toggle = () => {
    if (!status || busy) return;
    if (status.enabled) disable();
    else setConfirmEnable(true);
  };

  const changeFolder = useCallback(async () => {
    if (!steamPath || !status) return;
    const dir = await openDialog({
      directory: true,
      multiple: false,
      defaultPath: status.sync_path || undefined,
    }).catch(() => null);
    if (typeof dir !== "string") return;
    try {
      const next = await cloudSavesSetFolder(steamPath, dir);
      setStatus(next);
      notify("success", "Cloud saves folder updated.");
      if (status.enabled) flagRestart(next);
    } catch (e) {
      notify("error", e instanceof Error ? e.message : String(e));
    }
  }, [steamPath, status, notify]);

  const toggleLog = useCallback(async () => {
    if (!steamPath || !status) return;
    try {
      const next = await cloudSavesSetLogging(steamPath, !status.log_enabled);
      setStatus(next);
      notify("success", next.log_enabled ? "Debug log enabled." : "Debug log disabled.");
    } catch (e) {
      notify("error", e instanceof Error ? e.message : String(e));
    }
  }, [steamPath, status, notify]);

  const backup = useCallback(async () => {
    if (!steamPath || backupBusy) return;
    setBackupBusy(true);
    try {
      await cloudSavesBackup(steamPath);
      notify("success", "Backup saved to your Desktop.");
    } catch (e) {
      notify("error", e instanceof Error ? e.message : String(e));
    } finally {
      setBackupBusy(false);
    }
  }, [steamPath, backupBusy, notify]);

  const importSaves = useCallback(async () => {
    if (!steamPath || importBusy) return;
    const zip = await openDialog({
      multiple: false,
      filters: [{ name: "Zip archive", extensions: ["zip"] }],
    }).catch(() => null);
    if (typeof zip !== "string") return;
    setImportBusy(true);
    try {
      const count = await cloudSavesImport(steamPath, zip);
      notify("success", `Imported ${count} save file${count !== 1 ? "s" : ""}.`);
      if (status?.enabled && status.steam_running) setRestartNeeded(true);
    } catch (e) {
      notify("error", e instanceof Error ? e.message : String(e));
    } finally {
      setImportBusy(false);
    }
  }, [steamPath, importBusy, status, notify]);

  const doRestart = async () => {
    setRestarting(true);
    try {
      await restartSteam();
      setRestartNeeded(false);
      notify("success", "Steam is restarting to apply Cloud Saves.");
    } catch (e) {
      notify("error", e instanceof Error ? e.message : "Failed to restart Steam");
    } finally {
      setRestarting(false);
    }
  };

  const enabled = !!status?.enabled;
  const folder = status?.sync_path || "";
  const ready = !!status && !!steamPath;

  return (
    <div className="cloud">
      <div className="cloud-head">
        <div className="cloud-head-text">
          <h2 className="cloud-title">Cloud Saves</h2>
          <p className="cloud-sub">
            Redirect Steam Cloud saves for your Veil games to a local folder — owned
            Steam games are untouched.
          </p>
        </div>
        <div className="cloud-head-actions">
          <HeaderButton
            onClick={backup}
            disabled={!ready}
            busy={backupBusy}
            icon={<Archive size={14} weight="bold" />}
          >
            Back up
          </HeaderButton>
          <HeaderButton
            onClick={importSaves}
            disabled={!ready}
            busy={importBusy}
            icon={<UploadSimple size={14} weight="bold" />}
          >
            Import
          </HeaderButton>
        </div>
      </div>

      {restartNeeded && (
        <RestartBanner
          body="Cloud Saves changed while Steam is running. Restart Steam for it to take effect."
          restarting={restarting}
          onRestart={doRestart}
          onDismiss={() => setRestartNeeded(false)}
        />
      )}

      <div className="cloud-card">
        <div className="cloud-row">
          <div className="cloud-row-icon">
            <CloudArrowUp size={22} weight="regular" />
          </div>
          <div className="cloud-row-main">
            <p className="cloud-row-title">Enable Cloud Saves</p>
            <p className="cloud-row-desc">
              {busy
                ? "Applying…"
                : "Store and load saves from your folder instead of Steam Cloud. Applied automatically on startup."}
            </p>
          </div>
          {busy ? (
            <CircleNotch size={18} className="spin cloud-row-spin" />
          ) : (
            <Toggle on={enabled} onClick={toggle} disabled={!status} />
          )}
        </div>

        <div className="cloud-divider" />

        <div className="cloud-row">
          <div className="cloud-row-main">
            <p className="cloud-row-title small">Saves folder</p>
            <p className={`cloud-folder${folder ? "" : " unset"}`}>
              {folder || "Not set"}
            </p>
          </div>
          <button
            className="cloud-change-btn"
            onClick={changeFolder}
            disabled={!status}
          >
            <FolderOpen size={14} weight="bold" />
            Change
          </button>
        </div>

        <div className="cloud-divider" />

        <div className="cloud-row">
          <div className="cloud-row-main">
            <p className="cloud-row-title small">Write debug log</p>
            <p className="cloud-row-desc">
              Writes a log to your Steam folder. Off by default; turn on only when
              troubleshooting.
            </p>
          </div>
          <Toggle
            on={!!status?.log_enabled}
            onClick={toggleLog}
            disabled={!status}
          />
        </div>
      </div>

      {!steamPath && (
        <p className="cloud-warn">
          <Warning size={13} weight="fill" /> Steam installation not detected — set the
          path in Settings.
        </p>
      )}

      <p className="cloud-note">
        Saves appear to sync exactly like Steam Cloud, but the data is read and written
        to your local folder. Back up anything you care about before enabling, and treat
        the folder like Steam Cloud itself — don't manually edit a game's files inside it.
      </p>

      {confirmEnable && (
        <ConfirmDialog
          title="Enable Cloud Saves?"
          message="Steam occasionally detects the cloud-save patch and restarts itself. This is expected and harmless — Steam keeps working normally, it'll just relaunch on its own once in a while."
          confirmLabel="Enable"
          onConfirm={() => {
            setConfirmEnable(false);
            doEnable();
          }}
          onCancel={() => setConfirmEnable(false)}
        />
      )}
    </div>
  );
}

export default CloudSavesPage;
