import { invoke } from "@tauri-apps/api/core";

interface SteamStatus {
  installed: boolean;
  path: string | null;
  running: boolean;
}

export async function isSteamRunning(): Promise<boolean> {
  const status = await invoke<SteamStatus>("steam_status");
  return status.running;
}

export function killSteam(): Promise<void> {
  return invoke("steam_kill");
}

export function startSteam(): Promise<void> {
  return invoke("steam_start");
}

export function restartSteam(): Promise<void> {
  return invoke("steam_restart");
}
