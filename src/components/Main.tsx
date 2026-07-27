import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { CircleNotch, DownloadSimple } from "@phosphor-icons/react";
import Sidebar from "./Sidebar";
import ConfirmDialog from "./ConfirmDialog";
import LibraryPage from "../pages/LibraryPage";
import FixesPage from "../pages/FixesPage";
import BypassesPage from "../pages/BypassesPage";
import CatalogPage from "../pages/CatalogPage";
import ConfigPage from "../pages/ConfigPage";
import CloudSavesPage from "../pages/CloudSavesPage";
import SettingsPage from "../pages/SettingsPage";
import { useLibrary } from "../lib/useLibrary";
import { useImport } from "../lib/useImport";
import { useToast } from "../lib/useToast";
import { applyUpdate } from "../lib/config";
import { ALL_TABS, TabId } from "../tabs";

function Main() {
  const [active, setActive] = useState<TabId>("library");
  const [expanded, setExpanded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [updating, setUpdating] = useState(false);
  const library = useLibrary();
  const { toast, notify, dismiss } = useToast();
  const imports = useImport(library, notify);
  const current = ALL_TABS.find((t) => t.id === active);
  const dragDepth = useRef(0);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen("update-available", () => setUpdateReady(true)).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, []);

  const doUpdate = async () => {
    setUpdating(true);
    try {
      await applyUpdate();
    } catch (e) {
      setUpdating(false);
      notify("error", e instanceof Error ? e.message : "Update failed");
    }
  };

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(dismiss, 4200);
    return () => window.clearTimeout(id);
  }, [toast, dismiss]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      const text = e.clipboardData?.getData("text") ?? "";
      if (text.trim()) imports.importText(text);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [imports]);

  useEffect(() => {
    const hasPayload = (e: DragEvent) => {
      const types = e.dataTransfer?.types;
      return !!types && (types.includes("Files") || types.includes("text/plain"));
    };

    const onEnter = (e: DragEvent) => {
      e.preventDefault();
      dragDepth.current += 1;
      if (hasPayload(e)) setDragging(true);
    };
    const onOver = (e: DragEvent) => e.preventDefault();
    const onLeave = (e: DragEvent) => {
      e.preventDefault();
      dragDepth.current -= 1;
      if (dragDepth.current <= 0) {
        dragDepth.current = 0;
        setDragging(false);
      }
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length) {
        imports.importFiles(files);
        return;
      }
      const text = e.dataTransfer?.getData("text") ?? "";
      if (text.trim()) imports.importText(text);
    };

    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [imports]);

  const renderPage = () => {
    switch (active) {
      case "library":
        return (
          <LibraryPage
            library={library}
            onImportDialog={imports.importDialog}
            notify={notify}
          />
        );
      case "fixes":
        return <FixesPage notify={notify} />;
      case "bypasses":
        return <BypassesPage steamPath={library.steamPath} notify={notify} />;
      case "catalog":
        return (
          <CatalogPage
            library={library}
            notify={notify}
            onNavigate={() => setActive("library")}
          />
        );
      case "config":
        return <ConfigPage notify={notify} />;
      case "cloud-saves":
        return (
          <CloudSavesPage steamPath={library.steamPath} notify={notify} />
        );
      case "settings":
        return <SettingsPage library={library} notify={notify} />;
      default:
        return (
          <>
            <h2 className="content-title">{current?.label}</h2>
            <p className="content-placeholder">Nothing here yet.</p>
          </>
        );
    }
  };

  const isPage =
    active === "library" ||
    active === "fixes" ||
    active === "bypasses" ||
    active === "catalog" ||
    active === "config" ||
    active === "cloud-saves" ||
    active === "settings";

  return (
    <div className="main">
      <Sidebar
        active={active}
        onSelect={setActive}
        expanded={expanded}
        onExpandedChange={setExpanded}
      />
      <section className="content">
        <div
          key={active}
          className={`content-view ${isPage ? "page-view" : "pad-view"}`}
        >
          {renderPage()}
        </div>
      </section>
      <div className={`content-blur${expanded ? " active" : ""}`} />

      {dragging && (
        <div className="drop-overlay">
          <div className="drop-box">
            <DownloadSimple size={30} weight="bold" />
            <span className="drop-title">Drop to import</span>
            <span className="drop-hint">
              .zip, .lua, .manifest — or a SteamDB link / App ID
            </span>
          </div>
        </div>
      )}

      {imports.processing && (
        <div className="processing-pill">
          <CircleNotch size={15} className="spin" />
          {imports.processing}
        </div>
      )}

      {toast && (
        <div className={`toast toast-${toast.kind}`} onClick={dismiss}>
          {toast.message}
        </div>
      )}

      {imports.zipPrompt && (
        <ConfirmDialog
          title={
            imports.zipPrompt.paths.length > 1
              ? "Delete the imported zips?"
              : "Delete the imported zip?"
          }
          message={
            imports.zipPrompt.paths.length > 1
              ? "The manifests were added to your library. Do you want to delete the original zip files from your disk?"
              : "The manifests were added to your library. Do you want to delete the original zip file from your disk?"
          }
          confirmLabel="Delete"
          danger
          onConfirm={() => imports.zipPrompt?.resolve(true)}
          onCancel={() => imports.zipPrompt?.resolve(false)}
        />
      )}

      {updateReady && (
        <div className="update-pill">
          <DownloadSimple size={15} weight="bold" />
          <span>A new version of Veil is available.</span>
          <button className="update-pill-btn" onClick={doUpdate} disabled={updating}>
            {updating ? (
              <CircleNotch size={13} weight="bold" className="spin" />
            ) : null}
            {updating ? "Updating…" : "Update & Restart"}
          </button>
        </div>
      )}
    </div>
  );
}

export default Main;
