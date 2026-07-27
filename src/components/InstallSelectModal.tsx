import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { listen } from "@tauri-apps/api/event";
import { Check, CircleNotch, DownloadSimple, Prohibit, X } from "@phosphor-icons/react";
import { catalogInstallSelection } from "../lib/catalog";
import { useReleasedDlc } from "../lib/dlc";
import SmoothScroll from "./SmoothScroll";
import DlcRow from "./DlcRow";

export default function InstallSelectModal({
  appId,
  name,
  dlcAppIds,
  installedIds,
  steamPath,
  onClose,
  onInstalled,
}: {
  appId: number;
  name: string;
  dlcAppIds: number[];
  installedIds: Set<string>;
  steamPath: string | null;
  onClose: () => void;
  onInstalled: () => Promise<void> | void;
}) {
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(installedIds.has(String(appId)) ? [] : [appId])
  );
  const [installing, setInstalling] = useState(false);
  const [outcomes, setOutcomes] = useState<Map<number, string> | null>(null);
  const [appended, setAppended] = useState(0);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null
  );
  const { dlcIds, metas, loading: dlcLoading } = useReleasedDlc(dlcAppIds);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const unlisten = listen<{ done: number; total: number }>(
      "selection-progress",
      (e) => setProgress(e.payload)
    );
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const toggle = (id: number) => {
    if (installing) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allDlc = dlcIds.length > 0 && dlcIds.every((id) => selected.has(id));
  const toggleAllDlc = () => {
    if (installing) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (dlcIds.every((id) => next.has(id))) dlcIds.forEach((id) => next.delete(id));
      else dlcIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const statusOf = (id: number): "busy" | "ok" | "fail" | null => {
    if (!selected.has(id)) return null;
    if (installing) return "busy";
    if (!outcomes) return null;
    const s = outcomes.get(id);
    if (!s) return null;
    return s === "installed" || s === "appended" ? "ok" : "fail";
  };

  const install = async () => {
    if (!steamPath || selected.size === 0 || installing) return;
    setInstalling(true);
    setProgress(null);
    const installMain = selected.has(appId);
    const dlcs = [...selected]
      .filter((id) => id !== appId)
      .map((id) => [id, metas.get(id)?.name ?? `App ${id}`] as [number, string]);
    const result = await catalogInstallSelection(
      steamPath,
      appId,
      installMain,
      dlcs
    ).catch(() => null);
    if (result) {
      setOutcomes(new Map(result.statuses.map((s) => [s.app_id, s.status])));
      setAppended(result.appended);
    } else {
      setOutcomes(new Map());
    }
    setInstalling(false);
    setProgress(null);
    if (result) await onInstalled();
  };

  const mainStatus = statusOf(appId);

  return createPortal(
    <div className="cat-overlay" onMouseDown={onClose}>
      <div
        className="cat-modal select"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="cat-select-head">
          <div>
            <p className="cat-select-title">Install {name}</p>
            <p className="cat-select-sub">Choose what to add to your library.</p>
          </div>
          <button className="cat-icon-btn" onClick={onClose} aria-label="Close">
            <X size={15} weight="bold" />
          </button>
        </div>

        <SmoothScroll className="cat-select-list" deps={[dlcIds.length, dlcLoading]}>
          <div className="dlc-row-item" onClick={() => toggle(appId)}>
            <span className={`dlc-check${selected.has(appId) ? " on" : ""}`}>
              {selected.has(appId) && <Check size={11} weight="bold" />}
            </span>
            <div className="dlc-row-info">
              <p className="dlc-row-name">{name}</p>
              <p className="dlc-row-id">Base game · App ID {appId}</p>
            </div>
            {mainStatus === "busy" ? (
              <CircleNotch size={15} className="spin dlc-row-icon" />
            ) : mainStatus === "ok" ? (
              <Check size={15} weight="bold" className="dlc-row-icon ok" />
            ) : mainStatus === "fail" ? (
              <Prohibit size={15} weight="bold" className="dlc-row-icon fail" />
            ) : null}
          </div>

          {dlcLoading ? (
            <div className="cat-inline-loading">
              <CircleNotch size={14} className="spin" />
              Loading DLC…
            </div>
          ) : (
            dlcIds.length > 0 && (
              <>
                <div className="cat-dlc-head">
                  <span className="cat-dlc-count">{dlcIds.length} DLC</span>
                  <button className="cat-link" onClick={toggleAllDlc}>
                    {allDlc ? "Deselect all" : "Select all"}
                  </button>
                </div>
                {dlcIds.map((id) => (
                  <DlcRow
                    key={id}
                    appId={id}
                    meta={metas.get(id)}
                    mode="check"
                    checked={selected.has(id)}
                    status={outcomes || installing ? statusOf(id) : null}
                    onSelect={() => toggle(id)}
                  />
                ))}
              </>
            )
          )}
        </SmoothScroll>

        {outcomes && appended > 0 && (
          <div className="cat-appended-note">
            Some DLC couldn't be fetched but were added to the Lua — they may not work
            correctly, but in most cases should.
          </div>
        )}

        <div className="cat-select-foot">
          <span className="cat-selected-count">{selected.size} selected</span>
          {outcomes ? (
            <button className="cat-btn primary" onClick={onClose}>
              Done
            </button>
          ) : (
            <button
              className="cat-btn primary"
              onClick={install}
              disabled={installing || selected.size === 0 || !steamPath}
            >
              {installing ? (
                <CircleNotch size={15} weight="bold" className="spin" />
              ) : (
                <DownloadSimple size={15} weight="bold" />
              )}
              {installing
                ? progress
                  ? `Installing ${progress.done}/${progress.total}`
                  : "Installing…"
                : "Install"}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
