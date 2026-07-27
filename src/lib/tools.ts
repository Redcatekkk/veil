import { invoke } from "@tauri-apps/api/core";

export interface ToolFile {
  name: string;
  size: number;
}

export function listGamingTools(): Promise<ToolFile[]> {
  return invoke("gs_list_tools");
}

export function downloadGamingTool(name: string): Promise<string> {
  return invoke("gs_download_tool", { name });
}

export function runGamingTool(path: string): Promise<void> {
  return invoke("gs_run_tool", { path });
}

export function gamingServicesVersion(): Promise<string | null> {
  return invoke("gs_installed_version");
}

export function openStore(productId: string, fallbackUrl: string): Promise<void> {
  return invoke("open_store", { productId, fallbackUrl });
}
