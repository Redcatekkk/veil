import { invoke } from "@tauri-apps/api/core";

export interface LogSection {
  level: string;
}

export interface ManifestSection {
  url: string;
  timeout_resolve_ms: number;
  timeout_connect_ms: number;
  timeout_send_ms: number;
  timeout_recv_ms: number;
}

export interface LuaSection {
  paths: string[];
}

export interface InjectSection {
  enabled: boolean;
  library_x64?: string | null;
  library_x86?: string | null;
}

export interface PinSection {
  enabled: boolean;
}

export interface CloudSection {
  enabled: boolean;
  library?: string | null;
}

export interface RemoteSection {
  url_template?: string | null;
}

export interface VeilTomlConfig {
  log: LogSection;
  manifest: ManifestSection;
  lua: LuaSection;
  inject: InjectSection;
  pin: PinSection;
  cloud: CloudSection;
  remote: RemoteSection;
}

export interface VeilConfigState {
  enabled: boolean;
  config: VeilTomlConfig;
  issues: string[];
}

export function veilConfigGet(): Promise<VeilConfigState> {
  return invoke("veil_config_get");
}

export function veilConfigSetEnabled(enabled: boolean): Promise<void> {
  return invoke("veil_config_set_enabled", { enabled });
}

export function veilConfigSave(config: VeilTomlConfig): Promise<boolean> {
  return invoke("veil_config_save", { config });
}
