import { X } from "@phosphor-icons/react";

interface InstanceDialogProps {
  onRunAnyway: () => void;
  onKillAndLaunch: () => void;
  onCancel: () => void;
}

function InstanceDialog({
  onRunAnyway,
  onKillAndLaunch,
  onCancel,
}: InstanceDialogProps) {
  return (
    <div className="dialog" data-tauri-drag-region>
      <button className="dialog-close" onClick={onCancel} aria-label="Cancel">
        <X size={14} weight="bold" />
      </button>

      <div className="dialog-head" data-tauri-drag-region>
        <img className="dialog-logo" src="/veil.png" alt="" draggable={false} />
        <span className="dialog-title">Veil</span>
      </div>

      <p className="dialog-message">
        Veil is already running. Would you like to launch another instance
        anyway, or cancel?
      </p>

      <div className="dialog-actions">
        <button className="dlg-btn ghost" onClick={onCancel}>
          Cancel
        </button>
        <button className="dlg-btn ghost" onClick={onKillAndLaunch}>
          Close Others &amp; Launch
        </button>
        <button className="dlg-btn primary" onClick={onRunAnyway}>
          Run Anyway
        </button>
      </div>
    </div>
  );
}

export default InstanceDialog;
