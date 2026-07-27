import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowsClockwise,
  CaretDown,
  CircleNotch,
  DotsThreeVertical,
  DownloadSimple,
  FolderOpen,
  Globe,
  MagnifyingGlass,
  MinusCircle,
  Play,
  ShieldCheck,
  ShieldPlus,
  SquaresFour,
  TrashSimple,
  X,
} from "@phosphor-icons/react";
import SmartImage from "../components/SmartImage";
import SmoothScroll from "../components/SmoothScroll";
import Tooltip from "../components/Tooltip";
import ConfirmDialog from "../components/ConfirmDialog";
import {
  headerSources,
  installDlc,
  launchWithSteam,
  launchWithoutSteam,
  openFolder,
  openLibraryFolder,
  openUrl,
  removeManifest,
  removeSteamDrm,
  restoreSteamDrm,
  uninstallDlc,
  uninstallGame,
  type AppMeta,
  type InstalledGame,
} from "../lib/library";
import type { ToastKind } from "../lib/useToast";
import { onlineFixCached, onlineFixFetch, type OnlineFixEntry } from "../lib/onlinefix";
import { useInView, useReleasedDlc } from "../lib/dlc";
import { catalogInstall } from "../lib/catalog";
import type { LibraryState } from "../lib/useLibrary";
import "./library.css";

type FixStatus = "loading" | "available" | "unavailable" | "error";
interface FixUi {
  status: FixStatus;
  url?: string | null;
}

interface DlcRow {
  id: number;
  name: string;
  installed: boolean;
}

const EMPTY_DLC: number[] = [];

function GameCard({
  game,
  meta,
  fix,
  installedIds,
  index,
  steamPath,
  removing,
  onReload,
  onDlc,
  onAction,
  notify,
}: {
  game: InstalledGame;
  meta?: AppMeta;
  fix?: FixUi;
  installedIds: Set<string>;
  index: number;
  steamPath: string;
  removing: boolean;
  onReload: () => void;
  onDlc: (appId: string, total: number, installed: number) => void;
  onAction: (kind: "remove" | "uninstall") => void;
  notify: (kind: ToastKind, message: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [manifestBusy, setManifestBusy] = useState(false);
  const [drmBusy, setDrmBusy] = useState(false);
  const [dlcBusy, setDlcBusy] = useState<Set<number>>(new Set());
  const [bulk, setBulk] = useState<null | "install" | "uninstall">(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [inViewRef, inView] = useInView<HTMLDivElement>();
  const gridDlc = meta?.dlc_app_ids ?? EMPTY_DLC;
  const hasDlcSource = gridDlc.length > 0;
  const { dlcIds, metas: dlcMetaMap, loading: dlcLoading } = useReleasedDlc(
    gridDlc,
    inView
  );

  const dlcRows = useMemo<DlcRow[]>(
    () =>
      dlcIds
        .map((id) => ({
          id,
          name: dlcMetaMap.get(id)?.name ?? `App ${id}`,
          installed:
            installedIds.has(String(id)) || game.included_app_ids.includes(id),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [dlcIds, dlcMetaMap, installedIds, game.included_app_ids]
  );

  const resolved = !dlcLoading;
  const installedDlc = dlcRows.filter((d) => d.installed).length;
  const missingDlc = dlcRows.filter((d) => !d.installed);
  const showChip = (hasDlcSource && !resolved) || (resolved && dlcRows.length > 0);

  useEffect(() => {
    if (!resolved) return;
    onDlc(game.app_id, dlcRows.length, installedDlc);
  }, [resolved, dlcRows.length, installedDlc, game.app_id, onDlc]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const sources = useMemo(
    () => headerSources(game.app_id, meta?.header_url || undefined),
    [game.app_id, meta?.header_url]
  );

  const name = meta?.name ?? `App ${game.app_id}`;
  const parentId = Number(game.app_id);

  const refreshManifest = async () => {
    if (manifestBusy) return;
    setMenuOpen(false);
    setManifestBusy(true);
    await catalogInstall(parentId, steamPath).catch(() => {});
    await onReload();
    setManifestBusy(false);
  };

  const drmRemoved = game.drm_backed_up && !game.has_steam_drm;

  const drmAction = async () => {
    if (drmBusy || !game.launch_exe) return;
    setMenuOpen(false);
    setDrmBusy(true);
    try {
      const message = drmRemoved
        ? await restoreSteamDrm(game.launch_exe)
        : await removeSteamDrm(game.launch_exe);
      notify("success", message);
      await onReload();
    } catch (e) {
      notify("error", e instanceof Error ? e.message : String(e));
    }
    setDrmBusy(false);
  };

  const dlcAction = async (dlc: DlcRow) => {
    setDlcBusy((prev) => new Set(prev).add(dlc.id));
    if (dlc.installed) {
      await uninstallDlc(steamPath, parentId, dlc.id).catch(() => {});
    } else {
      await installDlc(steamPath, parentId, dlc.id, dlc.name).catch(() => {});
    }
    onReload();
    setDlcBusy((prev) => {
      const next = new Set(prev);
      next.delete(dlc.id);
      return next;
    });
  };

  const installAll = async () => {
    if (missingDlc.length === 0) return;
    setBulk("install");
    for (const dlc of missingDlc) {
      await installDlc(steamPath, parentId, dlc.id, dlc.name).catch(() => {});
    }
    onReload();
    setBulk(null);
  };

  const uninstallAll = async () => {
    const installed = dlcRows.filter((d) => d.installed);
    if (installed.length === 0) return;
    setBulk("uninstall");
    for (const dlc of installed) {
      await uninstallDlc(steamPath, parentId, dlc.id).catch(() => {});
    }
    onReload();
    setBulk(null);
  };

  const fixStatus = fix?.status;
  const fixLoading = !fixStatus || fixStatus === "loading";
  const fixAvail = fixStatus === "available" && !!fix?.url;

  const metaLine = [
    `${game.manifest_count} manifest${game.manifest_count !== 1 ? "s" : ""}`,
    game.install_dir ? "Files installed" : null,
    fixStatus === "available"
      ? "Online Fix Available"
      : fixStatus === "unavailable"
      ? "No Online Fix"
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      ref={inViewRef}
      className={`game-card${removing ? " removing" : ""}${menuOpen || expanded ? " menu-open" : ""}`}
      style={{ animationDelay: `${Math.min(index * 0.03, 0.3)}s` }}
    >
      <div
        className={`game-card-main${showChip ? " clickable" : ""}`}
        onClick={() => showChip && setExpanded((e) => !e)}
      >
        <SmartImage sources={sources} className="game-thumb" />

        <div className="game-info">
          <div className="game-name">{name}</div>
          <div className="game-sub">App ID {game.app_id}</div>
          <div className="game-meta">{metaLine}</div>
        </div>

        {showChip && (
          <button
            className="dlc-chip"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
          >
            {resolved ? (
              <span className="dlc-count">
                {installedDlc}/{dlcRows.length}
              </span>
            ) : (
              <CircleNotch size={11} className="spin" />
            )}
            <span className="dlc-label">DLC</span>
            <CaretDown
              size={11}
              weight="bold"
              className={`dlc-caret${expanded ? " open" : ""}`}
            />
          </button>
        )}

        <div className="game-actions" ref={menuRef} onClick={(e) => e.stopPropagation()}>
          <Tooltip label="Options" pos="top">
            <button
              className="kebab-btn"
              onClick={() => setMenuOpen((o) => !o)}
              disabled={removing || drmBusy}
              aria-label="Options"
            >
              {removing || drmBusy ? (
                <CircleNotch size={16} className="spin" />
              ) : (
                <DotsThreeVertical size={18} weight="bold" />
              )}
            </button>
          </Tooltip>

          <Tooltip
            label={
              fixLoading
                ? "Checking Online Fixes…"
                : fixAvail
                ? "Open Online Fix"
                : fixStatus === "error"
                ? "Couldn't check Online Fixes"
                : "No Online Fix available"
            }
            pos="top"
          >
            <button
              className={`kebab-btn globe${fixAvail ? " avail" : ""}`}
              disabled={!fixAvail}
              onClick={() => fixAvail && openUrl(fix!.url!).catch(() => {})}
            >
              {fixLoading ? (
                <CircleNotch size={15} className="spin" />
              ) : (
                <Globe size={17} weight={fixAvail ? "bold" : "regular"} />
              )}
            </button>
          </Tooltip>

          {menuOpen && (
            <div className="card-menu">
              <button
                disabled={!game.install_dir}
                onClick={() => {
                  setMenuOpen(false);
                  launchWithSteam(game.app_id).catch(() => {});
                }}
              >
                <Play size={15} weight="bold" />
                Launch With Steam
              </button>
              <button
                disabled={!game.launch_exe}
                onClick={() => {
                  setMenuOpen(false);
                  launchWithoutSteam(steamPath, game.app_id).catch(() => {});
                }}
              >
                <Play size={15} weight="regular" />
                Launch Without Steam
              </button>
              <div className="menu-divider" />
              <button
                disabled={!game.install_dir}
                onClick={() => {
                  setMenuOpen(false);
                  if (game.install_dir) openFolder(game.install_dir).catch(() => {});
                }}
              >
                <FolderOpen size={15} weight="bold" />
                View Game Files
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  openUrl(`https://store.steampowered.com/app/${game.app_id}`).catch(
                    () => {}
                  );
                }}
              >
                <Globe size={15} weight="bold" />
                Open Steam Page
              </button>
              <button disabled={manifestBusy} onClick={refreshManifest}>
                {manifestBusy ? (
                  <CircleNotch size={15} className="spin" />
                ) : (
                  <ArrowsClockwise size={15} weight="bold" />
                )}
                {manifestBusy ? "Refreshing Manifest…" : "Refresh Manifest"}
              </button>
              <button
                disabled={
                  !game.launch_exe ||
                  drmBusy ||
                  (!game.has_steam_drm && !game.drm_backed_up)
                }
                onClick={drmAction}
              >
                {drmBusy ? (
                  <CircleNotch size={15} className="spin" />
                ) : drmRemoved ? (
                  <ShieldPlus size={15} weight="bold" />
                ) : (
                  <ShieldCheck size={15} weight="bold" />
                )}
                {drmBusy
                  ? drmRemoved
                    ? "Restoring Steam DRM…"
                    : "Removing Steam DRM…"
                  : drmRemoved
                  ? "Restore Steam DRM"
                  : "Remove Steam DRM"}
              </button>
              <div className="menu-divider" />
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onAction("remove");
                }}
              >
                <MinusCircle size={15} weight="bold" />
                Remove Manifest
              </button>
              <button
                className="danger"
                onClick={() => {
                  setMenuOpen(false);
                  onAction("uninstall");
                }}
              >
                <TrashSimple size={15} weight="bold" />
                Uninstall
              </button>
            </div>
          )}
        </div>
      </div>

      {showChip && (
        <div className={`dlc-wrap${expanded ? " open" : ""}`}>
          <div className="dlc-wrap-inner">
            <div className="dlc-panel">
              {resolved && dlcRows.length > 0 && (
                <div className="dlc-panel-head">
                  <span className="dlc-panel-count">
                    {installedDlc}/{dlcRows.length} installed
                  </span>
                  <div className="dlc-bulk">
                    {missingDlc.length > 0 && (
                      <button
                        className="dlc-bulk-btn install"
                        onClick={installAll}
                        disabled={bulk !== null}
                      >
                        {bulk === "install" ? (
                          <>
                            <CircleNotch size={12} weight="bold" className="spin" />
                            Installing…
                          </>
                        ) : (
                          <>
                            <DownloadSimple size={12} weight="bold" />
                            Install All
                          </>
                        )}
                      </button>
                    )}
                    {installedDlc > 0 && (
                      <button
                        className="dlc-bulk-btn remove"
                        onClick={uninstallAll}
                        disabled={bulk !== null}
                      >
                        {bulk === "uninstall" ? (
                          <>
                            <CircleNotch size={12} weight="bold" className="spin" />
                            Removing…
                          </>
                        ) : (
                          <>
                            <TrashSimple size={12} weight="bold" />
                            Uninstall All
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}
              {!resolved ? (
                <div className="dlc-loading">
                  <CircleNotch size={14} className="spin" />
                  Loading DLC…
                </div>
              ) : (
                dlcRows.map((dlc) => {
                  const busy = dlcBusy.has(dlc.id) || bulk !== null;
                  return (
                    <div key={dlc.id} className="dlc-row">
                      <span className={`dlc-dot${dlc.installed ? " on" : ""}`} />
                      <span className="dlc-name">{dlc.name}</span>
                      <button
                        className={`dlc-toggle${dlc.installed ? " installed" : ""}`}
                        onClick={() => dlcAction(dlc)}
                        disabled={busy}
                      >
                        {dlcBusy.has(dlc.id) ? (
                          <CircleNotch size={12} className="spin" />
                        ) : dlc.installed ? (
                          <>
                            <span className="on-label">Installed</span>
                            <span className="hover-label">Uninstall</span>
                          </>
                        ) : (
                          <>
                            <span className="on-label">Available</span>
                            <span className="hover-label">Install</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LibrarySearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const expanded = open || value.length > 0;

  return (
    <div className="library-search" style={{ width: expanded ? 210 : 34 }}>
      <button
        onClick={() => {
          setOpen(true);
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
        aria-label="Search"
      >
        <MagnifyingGlass size={15} weight="bold" />
      </button>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          if (!value) setOpen(false);
        }}
        placeholder="Search library…"
      />
      {expanded && value && (
        <button onClick={() => onChange("")} aria-label="Clear">
          <X size={13} weight="bold" />
        </button>
      )}
    </div>
  );
}

function LibraryPage({
  library,
  onImportDialog,
  notify,
}: {
  library: LibraryState;
  onImportDialog: () => void;
  notify: (kind: ToastKind, message: string) => void;
}) {
  const { steamPath, games, metas, ready, reload } = library;
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const doRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    const start = performance.now();
    await reload();
    const wait = Math.max(0, 1000 - (performance.now() - start));
    window.setTimeout(() => setRefreshing(false), wait);
  };
  const [fixes, setFixes] = useState<Record<string, FixUi>>({});
  const fixesRef = useRef(fixes);
  fixesRef.current = fixes;
  const fixInFlight = useRef<Set<string>>(new Set());
  const [dlcStats, setDlcStats] = useState<
    Record<string, { total: number; installed: number }>
  >({});
  const [confirm, setConfirm] = useState<{
    game: InstalledGame;
    kind: "remove" | "uninstall";
  } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const runConfirm = async () => {
    if (!confirm || !steamPath) return;
    const { game, kind } = confirm;
    setConfirm(null);
    setBusyId(game.app_id);
    if (kind === "remove") {
      await removeManifest(steamPath, game.app_id).catch(() => {});
    } else {
      await uninstallGame(steamPath, game.app_id).catch(() => {});
    }
    await reload();
    setBusyId(null);
  };

  const reportDlc = useCallback(
    (appId: string, total: number, installed: number) => {
      setDlcStats((prev) => {
        const cur = prev[appId];
        if (cur && cur.total === total && cur.installed === installed) return prev;
        return { ...prev, [appId]: { total, installed } };
      });
    },
    []
  );

  const installedIds = useMemo(
    () => new Set(games.map((g) => g.app_id)),
    [games]
  );

  const visible = useMemo(() => {
    return games.filter((g) => {
      const meta = metas.get(g.app_id);
      if (!meta) return true;
      return !(meta.kind === "dlc" && installedIds.has(String(meta.parent_app_id)));
    });
  }, [games, metas, installedIds]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return visible;
    return visible.filter((g) => {
      const name = (metas.get(g.app_id)?.name ?? "").toLowerCase();
      return name.includes(q) || g.app_id.includes(q);
    });
  }, [visible, search, metas]);

  const dlcSummary = useMemo(() => {
    let total = 0;
    let installed = 0;
    for (const g of visible) {
      const s = dlcStats[g.app_id];
      if (!s) continue;
      total += s.total;
      installed += s.installed;
    }
    return { total, installed };
  }, [visible, dlcStats]);

  useEffect(() => {
    if (!ready || !steamPath) return;
    let cancelled = false;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const lookupOne = async (g: InstalledGame) => {
      const id = g.app_id;
      if (fixInFlight.current.has(id)) return;
      fixInFlight.current.add(id);
      setFixes((p) => ({ ...p, [id]: { status: "loading" } }));
      let attempt = 0;
      try {
        for (;;) {
          try {
            const res = await onlineFixFetch(Number(id), metas.get(id)?.name || "");
            setFixes((p) => ({ ...p, [id]: { status: res.status, url: res.url } }));
            return;
          } catch (e) {
            if (String(e).includes("rate_limited") && attempt < 5) {
              attempt++;
              await sleep(Math.min(1500 * 2 ** (attempt - 1), 30000));
              continue;
            }
            setFixes((p) => ({ ...p, [id]: { status: "error" } }));
            return;
          }
        }
      } finally {
        fixInFlight.current.delete(id);
      }
    };

    (async () => {
      const candidates = visible.filter((g) => {
        const st = fixesRef.current[g.app_id]?.status;
        if (st === "available" || st === "unavailable" || st === "error") return false;
        if (fixInFlight.current.has(g.app_id)) return false;
        const name = metas.get(g.app_id)?.name;
        return !!name && !/^App \d+$/.test(name);
      });
      if (candidates.length === 0) return;

      const cached = await onlineFixCached(
        candidates.map((g) => Number(g.app_id))
      ).catch(() => ({}) as Record<string, OnlineFixEntry>);
      if (cancelled) return;

      const resolved: Record<string, FixUi> = {};
      const toFetch: InstalledGame[] = [];
      for (const g of candidates) {
        const c = cached[g.app_id];
        if (c) resolved[g.app_id] = { status: c.status, url: c.url };
        else toFetch.push(g);
      }
      if (Object.keys(resolved).length) setFixes((p) => ({ ...p, ...resolved }));

      for (const g of toFetch) {
        if (cancelled) return;
        await lookupOne(g);
        if (cancelled) return;
        await sleep(400);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, steamPath, visible, metas]);

  if (!ready) {
    return (
      <div className="library">
        <div className="library-state">
          <CircleNotch size={22} className="spin" />
          <span className="title">Loading library…</span>
        </div>
      </div>
    );
  }

  if (!steamPath) {
    return (
      <div className="library">
        <div className="library-state">
          <span className="title">Steam installation not found</span>
          <span className="hint">Set your Steam path in Settings.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="library">
      <div className="library-header">
        <div className="library-count">
          <span>
            <strong>{visible.length}</strong> App{visible.length !== 1 ? "s" : ""}
          </span>
          {dlcSummary.total > 0 && (
            <>
              <span className="dot">·</span>
              <span>
                <strong>
                  {dlcSummary.installed}/{dlcSummary.total}
                </strong>{" "}
                DLC
              </span>
            </>
          )}
        </div>
        <div className="library-actions">
          <LibrarySearch value={search} onChange={setSearch} />
          <Tooltip label="Open library folder" pos="bottom">
            <button
              className="icon-btn"
              onClick={() => openLibraryFolder(steamPath).catch(() => {})}
              aria-label="Open library folder"
            >
              <FolderOpen size={15} weight="bold" />
            </button>
          </Tooltip>
          <button className="icon-btn" onClick={() => onImportDialog()}>
            <DownloadSimple size={14} weight="bold" />
            Import
          </button>
          <button
            className={`icon-btn refresh${refreshing ? " busy" : ""}`}
            onClick={doRefresh}
            disabled={refreshing}
          >
            <ArrowsClockwise
              size={15}
              weight="bold"
              className={refreshing ? "spin" : ""}
            />
            <span className="refresh-label">
              {refreshing ? "Refreshing" : "Refresh"}
            </span>
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="library-state">
          <SquaresFour size={26} />
          <span className="title">No manifests installed</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="library-state">
          <MagnifyingGlass size={24} />
          <span className="title">No games match “{search.trim()}”</span>
        </div>
      ) : (
        <SmoothScroll className="library-scroll" deps={[filtered.length]}>
          {filtered.map((game, i) => (
            <GameCard
              key={game.app_id}
              game={game}
              meta={metas.get(game.app_id)}
              fix={fixes[game.app_id]}
              installedIds={installedIds}
              index={i}
              steamPath={steamPath}
              removing={busyId === game.app_id}
              onReload={reload}
              onDlc={reportDlc}
              onAction={(kind) => setConfirm({ game, kind })}
              notify={notify}
            />
          ))}
        </SmoothScroll>
      )}

      {confirm && (
        <ConfirmDialog
          title={
            confirm.kind === "remove"
              ? "Remove manifest?"
              : `Uninstall ${metas.get(confirm.game.app_id)?.name ?? `App ${confirm.game.app_id}`}?`
          }
          message={
            confirm.kind === "remove"
              ? "This removes the Veil manifest for this app. Your installed game files are kept."
              : "This closes the game if it's running, deletes its manifest, and removes the installed files from your Steam library. This can't be undone."
          }
          confirmLabel={confirm.kind === "remove" ? "Remove" : "Uninstall"}
          danger={confirm.kind === "uninstall"}
          onConfirm={runConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

export default LibraryPage;
