import { invoke } from "@tauri-apps/api/core";

export interface AppConfig {
  steam_path: string;
  veil_enabled: boolean;
  cloud_saves_log: boolean;
}

export interface UpdateStatus {
  current_version: string;
  latest_version: string;
  update_available: boolean;
}

export function getAppConfig(): Promise<AppConfig> {
  return invoke("get_app_config");
}

export function saveAppConfig(config: AppConfig): Promise<void> {
  return invoke("save_app_config", { config });
}

export function setVeilEnabled(enabled: boolean): Promise<void> {
  return invoke("set_veil_enabled", { enabled });
}

export function veilEnable(steamPath: string): Promise<string> {
  return invoke("veil_enable", { steamPath });
}

export function veilDisable(steamPath: string): Promise<void> {
  return invoke("veil_disable", { steamPath });
}

export function setSteamPath(path: string): Promise<AppConfig> {
  return invoke("set_steam_path", { path });
}

export function redetectSteamPath(): Promise<AppConfig> {
  return invoke("redetect_steam_path");
}

export function checkForUpdates(): Promise<UpdateStatus> {
  return invoke("check_for_updates");
}

export function applyUpdate(): Promise<void> {
  return invoke("apply_update");
}

export interface ResetResult {
  deleted: number;
  failed: number;
  freed_bytes: number;
  steam_started: boolean;
  failures: string[];
}

export function resetSteam(steamPath: string): Promise<ResetResult> {
  return invoke("reset_steam", { steamPath });
}
