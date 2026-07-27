import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { invoke } from "@tauri-apps/api/core";
import TitleBar from "./components/TitleBar";
import Main from "./components/Main";
import InstanceDialog from "./components/InstanceDialog";
import "./App.css";

const appWindow = getCurrentWindow();

type Mode = "init" | "dialog" | "app";

function App() {
  const [mode, setMode] = useState<Mode>("init");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const reveal = async () => {
      try {
        await appWindow.show();
        await appWindow.setFocus();
      } catch {
      }
      requestAnimationFrame(() => {
        if (!cancelled) setVisible(true);
      });
    };

    const loadApp = async () => {
      try {
        await invoke("initialize_app");
      } catch {
      }
      if (cancelled) return;
      setMode("app");
      reveal();
    };

    const boot = async () => {
      let running = false;
      try {
        running = await invoke<boolean>("other_instances_running");
      } catch {
      }
      if (cancelled) return;

      if (running) {
        try {
          await appWindow.setSize(new LogicalSize(480, 232));
          await appWindow.center();
        } catch {
        }
        setMode("dialog");
        reveal();
        return;
      }

      try {
        const upd = await invoke<{ update_available: boolean }>("check_for_updates");
        if (!cancelled && upd.update_available) {
          await invoke("apply_update");
          return;
        }
      } catch {
      }
      if (cancelled) return;

      loadApp();
    };

    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const goToApp = async (killFirst: boolean) => {
    if (killFirst) {
      try {
        await invoke("kill_other_instances");
      } catch {
      }
    }
    setVisible(false);
    await new Promise((r) => setTimeout(r, 180));
    try {
      await appWindow.setSize(new LogicalSize(1100, 700));
      await appWindow.center();
    } catch {
    }
    try {
      await invoke("initialize_app");
    } catch {
    }
    setMode("app");
    requestAnimationFrame(() => setVisible(true));
  };

  const cancel = async () => {
    try {
      await invoke("exit_app");
    } catch {
      try {
        await appWindow.close();
      } catch {
      }
    }
  };

  return (
    <div className={`shell${visible ? " visible" : ""}`}>
      {mode === "dialog" && (
        <InstanceDialog
          onRunAnyway={() => goToApp(false)}
          onKillAndLaunch={() => goToApp(true)}
          onCancel={cancel}
        />
      )}
      {mode === "app" && (
        <div className="app">
          <TitleBar />
          <div className="app-body">
            <Main />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
