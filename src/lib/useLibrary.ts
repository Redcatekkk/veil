import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  getAppsMeta,
  listInstalledGames,
  type AppMeta,
  type InstalledGame,
} from "./library";
import { getAppConfig } from "./config";

export interface LibraryState {
  steamPath: string | null;
  games: InstalledGame[];
  metas: Map<string, AppMeta>;
  ready: boolean;
  reloading: boolean;
  reload: () => Promise<void>;
}

export function useLibrary(): LibraryState {
  const [steamPath, setSteamPath] = useState<string | null>(null);
  const [games, setGames] = useState<InstalledGame[]>([]);
  const [metas, setMetas] = useState<Map<string, AppMeta>>(new Map());
  const [ready, setReady] = useState(false);
  const [reloading, setReloading] = useState(false);
  const alive = useRef(true);

  const load = useCallback(async () => {
    setReloading(true);
    const config = await getAppConfig().catch(() => ({ steam_path: "" }));
    const path = config.steam_path || "";
    if (!alive.current) return;
    setSteamPath(path);

    if (path) {
      const list = await listInstalledGames(path).catch(
        () => [] as InstalledGame[]
      );
      const fetched = await getAppsMeta(list.map((g) => Number(g.app_id))).catch(
        () => [] as AppMeta[]
      );
      if (!alive.current) return;
      setGames(list);
      setMetas(new Map(fetched.map((m) => [String(m.app_id), m])));
    }

    setReady(true);
    setReloading(false);
  }, []);

  useEffect(() => {
    alive.current = true;
    load();
    return () => {
      alive.current = false;
    };
  }, [load]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen("library-changed", () => load()).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, [load]);

  return { steamPath, games, metas, ready, reloading, reload: load };
}
