import { useEffect, useMemo, useRef, useState } from "react";
import { CircleNotch, Plus, TrashSimple, Warning } from "@phosphor-icons/react";
import SmoothScroll from "../components/SmoothScroll";
import RestartBanner from "../components/RestartBanner";
import {
  veilConfigGet,
  veilConfigSave,
  veilConfigSetEnabled,
  type VeilTomlConfig,
} from "../lib/veilconfig";
import { isSteamRunning, restartSteam } from "../lib/steam";
import type { ToastKind } from "../lib/useToast";
import "./config.css";

type SectionId = "manifest" | "lua" | "inject" | "pin" | "remote";

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "manifest", label: "Manifest" },
  { id: "lua", label: "Lua" },
  { id: "inject", label: "Inject" },
  { id: "pin", label: "Pin" },
  { id: "remote", label: "Remote" },
];

function Switch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      className={`cfg-switch${checked ? " on" : ""}`}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span className="cfg-switch-knob" />
    </button>
  );
}

function Field({
  label,
  desc,
  children,
  stacked,
}: {
  label: string;
  desc?: string;
  children: React.ReactNode;
  stacked?: boolean;
}) {
  return (
    <div className={`cfg-field${stacked ? " stacked" : ""}`}>
      <div className="cfg-field-text">
        <span className="cfg-field-label">{label}</span>
        {desc && <span className="cfg-field-desc">{desc}</span>}
      </div>
      <div className="cfg-field-control">{children}</div>
    </div>
  );
}

function sanitize(config: VeilTomlConfig): VeilTomlConfig {
  const clean = (s?: string | null) => {
    const t = (s ?? "").trim();
    return t.length ? t : null;
  };
  return {
    ...config,
    lua: { paths: config.lua.paths.map((p) => p.trim()).filter(Boolean) },
    inject: {
      ...config.inject,
      library_x64: clean(config.inject.library_x64),
      library_x86: clean(config.inject.library_x86),
    },
    cloud: { ...config.cloud, library: clean(config.cloud.library) },
    remote: { url_template: clean(config.remote.url_template) },
  };
}

function ConfigPage({
  notify,
}: {
  notify: (kind: ToastKind, message: string) => void;
}) {
  const [enabled, setEnabled] = useState(false);
  const [config, setConfig] = useState<VeilTomlConfig | null>(null);
  const [section, setSection] = useState<SectionId>("manifest");
  const [issues, setIssues] = useState<string[]>([]);
  const [restartNeeded, setRestartNeeded] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const saveTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    veilConfigGet()
      .then((state) => {
        setEnabled(state.enabled);
        setConfig(state.config);
        setIssues(state.issues ?? []);
      })
      .catch(() => {});
    return () => window.clearTimeout(saveTimer.current);
  }, []);

  const scheduleSave = (next: VeilTomlConfig) => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      try {
        const restart = await veilConfigSave(sanitize(next));
        setIssues([]);
        if (restart) setRestartNeeded(true);
      } catch {
      }
    }, 500);
  };

  const update = (fn: (c: VeilTomlConfig) => VeilTomlConfig) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      scheduleSave(next);
      return next;
    });
  };

  const toggleEnabled = async (value: boolean) => {
    setEnabled(value);
    await veilConfigSetEnabled(value).catch(() => {});
    if (value) {
      const running = await isSteamRunning().catch(() => false);
      if (running) setRestartNeeded(true);
    } else {
      setRestartNeeded(false);
      setIssues([]);
    }
  };

  const doRestart = async () => {
    setRestarting(true);
    try {
      await restartSteam();
      setRestartNeeded(false);
      notify("success", "Steam is restarting to apply your config.");
    } catch (e) {
      notify("error", e instanceof Error ? e.message : "Failed to restart Steam");
    } finally {
      setRestarting(false);
    }
  };

  const body = useMemo(() => {
    if (!config) return null;
    switch (section) {
      case "manifest":
        return (
          <>
            {(
              [
                ["timeout_resolve_ms", "DNS resolution"],
                ["timeout_connect_ms", "TCP handshake"],
                ["timeout_send_ms", "Request send"],
                ["timeout_recv_ms", "Response download"],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={`${label} timeout`} desc="Milliseconds.">
                <input
                  className="cfg-input num"
                  type="number"
                  min={0}
                  value={config.manifest[key]}
                  onChange={(e) =>
                    update((c) => ({
                      ...c,
                      manifest: {
                        ...c.manifest,
                        [key]: Math.max(0, Number(e.target.value) || 0),
                      },
                    }))
                  }
                />
              </Field>
            ))}
          </>
        );
      case "lua":
        return (
          <Field
            label="Extra Lua directories"
            desc="Loaded before the default config/Veil folder, which always takes priority."
            stacked
          >
            <div className="cfg-list">
              {config.lua.paths.length === 0 && (
                <p className="cfg-list-empty">No extra directories.</p>
              )}
              {config.lua.paths.map((p, i) => (
                <div className="cfg-list-row" key={i}>
                  <input
                    className="cfg-input"
                    value={p}
                    placeholder="D:/my-steam-config/lua"
                    onChange={(e) =>
                      update((c) => {
                        const paths = [...c.lua.paths];
                        paths[i] = e.target.value;
                        return { ...c, lua: { paths } };
                      })
                    }
                  />
                  <button
                    className="cfg-list-remove"
                    onClick={() =>
                      update((c) => ({
                        ...c,
                        lua: { paths: c.lua.paths.filter((_, j) => j !== i) },
                      }))
                    }
                    aria-label="Remove"
                  >
                    <TrashSimple size={15} weight="bold" />
                  </button>
                </div>
              ))}
              <button
                className="cfg-add"
                onClick={() =>
                  update((c) => ({ ...c, lua: { paths: [...c.lua.paths, ""] } }))
                }
              >
                <Plus size={14} weight="bold" />
                Add directory
              </button>
            </div>
          </Field>
        );
      case "inject":
        return (
          <>
            <Field
              label="Enable injection"
              desc="Inject a library into game processes. It must match the target's architecture."
            >
              <Switch
                checked={config.inject.enabled}
                onChange={(enabled) =>
                  update((c) => ({ ...c, inject: { ...c.inject, enabled } }))
                }
              />
            </Field>
            <Field label="64-bit library" desc="Path to the x64 injection DLL.">
              <input
                className="cfg-input"
                value={config.inject.library_x64 ?? ""}
                placeholder="Veil.GameHook.x64.dll"
                onChange={(e) =>
                  update((c) => ({
                    ...c,
                    inject: { ...c.inject, library_x64: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="32-bit library" desc="Path to the x86 injection DLL.">
              <input
                className="cfg-input"
                value={config.inject.library_x86 ?? ""}
                placeholder="Veil.GameHook.x86.dll"
                onChange={(e) =>
                  update((c) => ({
                    ...c,
                    inject: { ...c.inject, library_x86: e.target.value },
                  }))
                }
              />
            </Field>
          </>
        );
      case "pin":
        return (
          <Field
            label="Pin Veil apps"
            desc="Group every addappid() game into a “•Veil” collection in each signed-in user's Steam library."
          >
            <Switch
              checked={config.pin.enabled}
              onChange={(enabled) =>
                update((c) => ({ ...c, pin: { enabled } }))
              }
            />
          </Field>
        );
      case "remote":
        return (
          <Field
            label="Metadata mirror"
            desc="Optional. Must include {channel}, {component}, and {sha256}. Leave blank to use the default Veil API."
            stacked
          >
            <input
              className="cfg-input"
              value={config.remote.url_template ?? ""}
              placeholder="https://your.server/steam/{channel}/{component}/raw?sha={sha256}"
              onChange={(e) =>
                update((c) => ({ ...c, remote: { url_template: e.target.value } }))
              }
            />
          </Field>
        );
    }
  }, [config, section]);

  return (
    <div className="config">
      <div className="config-head">
        <div>
          <h2 className="config-title">Config</h2>
          <p className="config-sub">
            Manage <span className="mono">Veil.toml</span> in your Steam folder.
          </p>
        </div>
        <div className="config-enable">
          <div className="config-enable-text">
            <span className="config-enable-label">Enable Veil Config</span>
            <span className="config-enable-desc">
              {enabled
                ? "Veil.toml is being created and kept in sync."
                : "Off — no Veil.toml is written."}
            </span>
          </div>
          <Switch checked={enabled} onChange={toggleEnabled} />
        </div>
      </div>

      {restartNeeded && (
        <RestartBanner
          body="Your config changed while Steam is running. Restart Steam for it to take effect."
          restarting={restarting}
          onRestart={doRestart}
          onDismiss={() => setRestartNeeded(false)}
        />
      )}

      {issues.length > 0 && (
        <div className="config-issues">
          <Warning size={17} weight="fill" className="config-issues-icon" />
          <div className="config-issues-text">
            <span className="config-issues-title">
              {issues.length} issue{issues.length !== 1 ? "s" : ""} in your Veil.toml
            </span>
            <ul className="config-issues-list">
              {issues.map((it, i) => (
                <li key={i}>{it}</li>
              ))}
            </ul>
            <span className="config-issues-hint">
              Editing any option below will rewrite the file and clear this.
            </span>
          </div>
        </div>
      )}

      <div className="config-tabs">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            className={`config-tab${section === s.id ? " active" : ""}`}
            onClick={() => setSection(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {config ? (
        <SmoothScroll className="config-scroll" deps={[section]}>
          <div key={section} className="config-section">
            {body}
          </div>
        </SmoothScroll>
      ) : (
        <div className="config-loading">
          <CircleNotch size={20} className="spin" />
        </div>
      )}
    </div>
  );
}

export default ConfigPage;
