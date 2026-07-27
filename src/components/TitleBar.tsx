import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Copy, Minus, Square, X } from "@phosphor-icons/react";
import Tooltip from "./Tooltip";

const appWindow = getCurrentWindow();

function TitleBar() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    appWindow.isMaximized().then(setMaximized);
    appWindow
      .onResized(async () => setMaximized(await appWindow.isMaximized()))
      .then((fn) => {
        unlisten = fn;
      });

    return () => unlisten?.();
  }, []);

  return (
    <div className="titlebar" data-tauri-drag-region>
      <div className="titlebar-left" data-tauri-drag-region>
        <img className="titlebar-logo" src="/veil.png" alt="" draggable={false} />
      </div>

      <div className="titlebar-brand" data-tauri-drag-region>
        <span className="brand-text">VEIL</span>
        <span className="brand-ver">V3</span>
      </div>

      <div className="titlebar-controls">
        <Tooltip label="Minimize" pos="bottom">
          <button
            className="titlebar-btn titlebar-min"
            onClick={() => appWindow.minimize()}
            aria-label="Minimize"
          >
            <Minus size={16} weight="bold" />
          </button>
        </Tooltip>
        <Tooltip label={maximized ? "Restore" : "Maximize"} pos="bottom">
          <button
            className="titlebar-btn titlebar-max"
            onClick={() => appWindow.toggleMaximize()}
            aria-label="Maximize"
          >
            {maximized ? (
              <Copy size={14} weight="regular" />
            ) : (
              <Square size={14} weight="regular" />
            )}
          </button>
        </Tooltip>
        <Tooltip label="Close" pos="bottom">
          <button
            className="titlebar-btn titlebar-close"
            onClick={() => appWindow.close()}
            aria-label="Close"
          >
            <X size={16} weight="bold" />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

export default TitleBar;
