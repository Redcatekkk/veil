import { useCallback, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  installManifestBlob,
  installManifestPaths,
  installManifestUrl,
  deleteImportFiles,
} from "./install";
import { installDlc, getAppsMeta, type AppMeta } from "./library";
import { parseAppIds } from "./dropimport";
import type { LibraryState } from "./useLibrary";
import type { ToastKind } from "./useToast";

const VALID = /\.(zip|lua|manifest)$/i;
const READY = "ready to use (restart Steam only if it doesn't show up)";

export interface ZipPrompt {
  paths: string[];
  resolve: (deleteThem: boolean) => void;
}

export interface ImportState {
  processing: string | null;
  importFiles: (files: File[]) => Promise<void>;
  importText: (text: string) => Promise<void>;
  importDialog: () => Promise<void>;
  zipPrompt: ZipPrompt | null;
}

export function useImport(
  library: LibraryState,
  notify: (kind: ToastKind, message: string) => void
): ImportState {
  const { steamPath, games, reload } = library;
  const [processing, setProcessing] = useState<string | null>(null);
  const [zipPrompt, setZipPrompt] = useState<ZipPrompt | null>(null);
  const busy = useRef(false);

  const importFiles = useCallback(
    async (files: File[]) => {
      if (busy.current) return;
      const valid = files.filter((f) => VALID.test(f.name));
      if (valid.length === 0) {
        notify("error", "Drop a .zip, .lua, .manifest, or a SteamDB link / App ID");
        return;
      }
      if (!steamPath) {
        notify("error", "Steam installation not found");
        return;
      }
      busy.current = true;
      setProcessing("Installing…");
      try {
        let lua = 0;
        let manifest = 0;
        const appIds = new Set<number>();
        for (const f of valid) {
          setProcessing(`Installing ${f.name}…`);
          const buf = new Uint8Array(await f.arrayBuffer());
          const report = await installManifestBlob(steamPath, f.name, buf);
          lua += report.lua_count;
          manifest += report.manifest_count;
          report.app_ids.forEach((id) => appIds.add(id));
        }
        if (lua + manifest === 0) {
          notify("error", "No valid manifests in that drop");
        } else {
          await reload();
          const count = appIds.size || lua + manifest;
          notify("success", `Imported ${count} manifest${count !== 1 ? "s" : ""} — ${READY}`);
        }
      } catch (e) {
        notify("error", e instanceof Error ? e.message : "Import failed");
      } finally {
        setProcessing(null);
        busy.current = false;
      }
    },
    [steamPath, reload, notify]
  );

  const importText = useCallback(
    async (raw: string) => {
      if (busy.current) return;
      const text = raw.trim();
      if (!text) return;
      if (!steamPath) {
        notify("error", "Steam installation not found");
        return;
      }

      // A pasted/dropped direct download link (anything that isn't a Steam
      // store / SteamDB page) is fetched and installed straight away.
      const isUrl = /^https?:\/\/\S+$/i.test(text);
      const isSteamMeta =
        /(steampowered\.com|steamdb\.info|steamcommunity\.com)/i.test(text);
      if (isUrl && !isSteamMeta) {
        busy.current = true;
        setProcessing("Downloading…");
        try {
          const report = await installManifestUrl(steamPath, text);
          await reload();
          const count =
            report.app_ids.length || report.lua_count + report.manifest_count;
          notify(
            "success",
            `Imported ${count} manifest${count !== 1 ? "s" : ""} from link — ${READY}`
          );
        } catch (e) {
          notify("error", e instanceof Error ? e.message : "Download failed");
        } finally {
          setProcessing(null);
          busy.current = false;
        }
        return;
      }

      const ids = parseAppIds(text);
      if (ids.length === 0) {
        notify("error", "No Steam App IDs found in that text");
        return;
      }
      busy.current = true;
      setProcessing("Looking up apps…");
      try {
        const metas = await getAppsMeta(ids).catch(() => [] as AppMeta[]);
        const map = new Map(metas.map((m) => [m.app_id, m]));
        const installedMains = new Set(games.map((g) => Number(g.app_id)));
        const realName = (m?: AppMeta) =>
          m && m.name && !/^App \d+$/.test(m.name) ? m.name : "";
        const nameOf = (id: number) => realName(map.get(id)) || `App ${id}`;

        let added = 0;
        let needBase = 0;
        let notImportable = 0;

        for (const id of ids) {
          const m = map.get(id);
          if (m && m.kind === "dlc" && m.parent_app_id > 0) {
            if (installedMains.has(m.parent_app_id)) {
              setProcessing(`Adding ${nameOf(id)}…`);
              await installDlc(steamPath, m.parent_app_id, id, nameOf(id)).catch(
                () => {}
              );
              added += 1;
            } else {
              needBase += 1;
            }
          } else {
            notImportable += 1;
          }
        }

        await reload();

        const parts: string[] = [];
        if (added) parts.push(`${added} DLC added`);
        if (needBase) parts.push(`${needBase} need base game`);
        if (notImportable) parts.push(`${notImportable} not importable here`);

        if (added > 0) {
          notify("success", `${parts.join(" · ")} — ${READY}`);
        } else {
          notify("error", parts.join(" · ") || "Nothing to add from that text");
        }
      } catch (e) {
        notify("error", e instanceof Error ? e.message : "Could not process that text");
      } finally {
        setProcessing(null);
        busy.current = false;
      }
    },
    [steamPath, games, reload, notify]
  );

  const importDialog = useCallback(async () => {
    if (busy.current) return;
    if (!steamPath) {
      notify("error", "Steam installation not found");
      return;
    }

    const selection = await open({
      multiple: true,
      filters: [{ name: "Manifests", extensions: ["zip", "lua", "manifest"] }],
    }).catch(() => null);
    if (!selection) return;
    const paths = Array.isArray(selection) ? selection : [selection];
    if (paths.length === 0) return;

    busy.current = true;
    setProcessing("Installing…");
    try {
      const report = await installManifestPaths(steamPath, paths);
      if (report.lua_count + report.manifest_count === 0) {
        notify("error", "No valid manifests in that file");
        return;
      }
      await reload();
      const count =
        report.app_ids.length || report.lua_count + report.manifest_count;
      notify(
        "success",
        `Imported ${count} manifest${count !== 1 ? "s" : ""} — ${READY}`
      );

      const zips = paths.filter((p) => /\.zip$/i.test(p));
      if (zips.length > 0) {
        const remove = await new Promise<boolean>((resolve) =>
          setZipPrompt({ paths: zips, resolve })
        );
        setZipPrompt(null);
        if (remove) await deleteImportFiles(zips).catch(() => {});
      }
    } catch (e) {
      notify("error", e instanceof Error ? e.message : "Import failed");
    } finally {
      setProcessing(null);
      busy.current = false;
    }
  }, [steamPath, reload, notify]);

  return { processing, importFiles, importText, importDialog, zipPrompt };
}
