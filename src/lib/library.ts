import { invoke } from "@tauri-apps/api/core";

export interface InstalledGame {
  app_id: string;
  included_app_ids: number[];
  manifest_count: number;
  install_dir: string | null;
  launch_exe: string | null;
  has_steam_drm: boolean;
  drm_backed_up: boolean;
}

export interface AppMeta {
  app_id: number;
  name: string;
  header_url: string;
  kind: string;
  parent_app_id: number;
  dlc_app_ids: number[];
  released: boolean;
}

export function listInstalledGames(steamPath: string): Promise<InstalledGame[]> {
  return invoke("list_installed_games", { steamPath });
}

export function getAppsMeta(appIds: number[]): Promise<AppMeta[]> {
  if (appIds.length === 0) return Promise.resolve([]);
  return invoke("get_apps_meta", { appIds });
}

export function openLibraryFolder(steamPath: string): Promise<void> {
  return invoke("open_library_folder", { steamPath });
}

export function openFolder(path: string): Promise<void> {
  return invoke("open_folder", { path });
}

export function openUrl(url: string): Promise<void> {
  return invoke("open_url", { url });
}

export function removeManifest(steamPath: string, appId: string): Promise<void> {
  return invoke("remove_manifest", { steamPath, appId });
}

export function uninstallGame(steamPath: string, appId: string): Promise<void> {
  return invoke("uninstall_game", { steamPath, appId });
}

export function installDlc(
  steamPath: string,
  mainAppId: number,
  dlcId: number,
  dlcName: string
): Promise<void> {
  return invoke("install_dlc", { steamPath, mainAppId, dlcId, dlcName });
}

export function uninstallDlc(
  steamPath: string,
  mainAppId: number,
  dlcId: number
): Promise<void> {
  return invoke("uninstall_dlc", { steamPath, mainAppId, dlcId });
}

export function launchWithSteam(appId: string): Promise<void> {
  return invoke("launch_game_steam", { appId: Number(appId) });
}

export function launchWithoutSteam(steamPath: string, appId: string): Promise<void> {
  return invoke("launch_game_direct", { steamPath, appId });
}

export function removeSteamDrm(exePath: string): Promise<string> {
  return invoke("remove_steam_drm", { exePath });
}

export function restoreSteamDrm(exePath: string): Promise<string> {
  return invoke("restore_steam_drm", { exePath });
}

export function headerSources(appId: string | number, primary?: string): string[] {
  const base = [
    `app/${appId}`,
    `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`,
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`,
    `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/capsule_616x353.jpg`,
  ];
  return primary ? [primary, ...base] : base;
}
