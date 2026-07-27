import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  CircleNotch,
  DownloadSimple,
  MagnifyingGlass,
  Warning,
  X,
} from "@phosphor-icons/react";
import SmartImage from "../components/SmartImage";
import SmoothScroll from "../components/SmoothScroll";
import CatalogModal from "../components/CatalogModal";
import InstallSelectModal from "../components/InstallSelectModal";
import { getAppsMeta, headerSources, type AppMeta } from "../lib/library";
import { useInView, useReleasedDlc } from "../lib/dlc";
import {
  catalogInstall,
  catalogInstallAt,
  catalogSearch,
  catalogTrending,
  type CatalogItem,
} from "../lib/catalog";
import type { LibraryState } from "../lib/useLibrary";
import type { ToastKind } from "../lib/useToast";
import "./catalog.css";

interface DisplayGame {
  app_id: number;
  name: string;
  header_url: string;
  dlc_app_ids: number[];
}

function CatalogCard({
  game,
  installed,
  installing,
  unavailable,
  index,
  onOpen,
  onAdd,
  onManage,
}: {
  game: DisplayGame;
  installed: boolean;
  installing: boolean;
  unavailable: boolean;
  index: number;
  onOpen: () => void;
  onAdd: () => void;
  onManage: () => void;
}) {
  const [ref, inView] = useInView<HTMLDivElement>();
  const hasGridDlc = game.dlc_app_ids.length > 0;
  const { dlcIds, loading: dlcLoading } = useReleasedDlc(
    game.dlc_app_ids,
    inView && hasGridDlc
  );
  const dlcCount = hasGridDlc && !dlcLoading ? dlcIds.length : null;

  const sources = useMemo(
    () => headerSources(game.app_id, game.header_url),
    [game.app_id, game.header_url]
  );

  return (
    <div
      ref={ref}
      className="cat-card"
      style={{ animationDelay: `${Math.min(index * 0.02, 0.2)}s` }}
      onClick={onOpen}
    >
      <SmartImage sources={sources} className="cat-card-art" />
      <div className="cat-card-overlay">
        <div className="cat-card-meta">
          <p className="cat-card-name">{game.name}</p>
          <p className="cat-card-sub">
            App ID {game.app_id}
            {dlcCount !== null && dlcCount > 0 && ` · ${dlcCount} DLC`}
          </p>
        </div>
        {installed ? (
          <button
            className="cat-card-badge added"
            onClick={(e) => {
              e.stopPropagation();
              onManage();
            }}
          >
            <Check size={12} weight="bold" className="added-check" />
            <span className="added-label">Added</span>
            <span className="manage-label">Manage</span>
          </button>
        ) : installing ? (
          <span className="cat-card-badge busy">
            <CircleNotch size={12} weight="bold" className="spin" />
          </span>
        ) : unavailable ? (
          <span
            className="cat-card-badge unavailable"
            onClick={(e) => e.stopPropagation()}
          >
            Unavailable
          </span>
        ) : (
          <button
            className="cat-card-badge add"
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
          >
            <DownloadSimple size={12} weight="bold" />
            Add
          </button>
        )}
      </div>
    </div>
  );
}

function CatalogPage({
  library,
  notify,
  onNavigate,
}: {
  library: LibraryState;
  notify: (kind: ToastKind, message: string) => void;
  onNavigate: () => void;
}) {
  const { games, steamPath, reload } = library;
  const installedIds = useMemo(
    () => new Set(games.map((g) => g.app_id)),
    [games]
  );

  const markInstalled = useCallback(async () => {
    await reload();
  }, [reload]);

  const [query, setQuery] = useState("");
  const [trending, setTrending] = useState<CatalogItem[]>([]);
  const [results, setResults] = useState<CatalogItem[]>([]);
  const [resultsFor, setResultsFor] = useState("");
  const [metaMap, setMetaMap] = useState<Map<number, AppMeta>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DisplayGame | null>(null);
  const [installGame, setInstallGame] = useState<DisplayGame | null>(null);
  const [installingId, setInstallingId] = useState<number | null>(null);
  const [unavailable, setUnavailable] = useState<Set<number>>(new Set());

  const mergeMetas = (metas: AppMeta[]) =>
    setMetaMap((prev) => {
      const next = new Map(prev);
      metas.forEach((m) => next.set(m.app_id, m));
      return next;
    });

  useEffect(() => {
    let alive = true;
    catalogTrending()
      .then(async (items) => {
        if (!alive) return;
        setTrending(items);
        const metas = await getAppsMeta(items.map((i) => i.app_id)).catch(() => []);
        if (!alive) return;
        mergeMetas(metas);
        setLoading(false);
      })
      .catch(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const timer = setTimeout(() => {
      catalogSearch(q)
        .then(async (items) => {
          const metas = await getAppsMeta(items.map((i) => i.app_id)).catch(() => []);
          setResults(items);
          mergeMetas(metas);
          setResultsFor(q);
        })
        .catch(() => {});
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  const handleInstall = useCallback(
    async (appId: number): Promise<boolean> => {
      if (!steamPath) return false;
      try {
        await catalogInstall(appId, steamPath);
        await reload();
        return true;
      } catch {
        return false;
      }
    },
    [steamPath, reload]
  );

  const handleInstallAt = useCallback(
    async (appId: number, sha: string): Promise<boolean> => {
      if (!steamPath) return false;
      try {
        await catalogInstallAt(appId, steamPath, sha);
        await reload();
        return true;
      } catch {
        return false;
      }
    },
    [steamPath, reload]
  );

  const addToLibrary = useCallback(
    async (appId: number) => {
      setInstallingId(appId);
      const ok = await handleInstall(appId);
      setInstallingId(null);
      if (!ok) {
        setUnavailable((prev) => new Set(prev).add(appId));
        setTimeout(() => {
          setUnavailable((prev) => {
            const next = new Set(prev);
            next.delete(appId);
            return next;
          });
        }, 3000);
      }
    },
    [handleInstall]
  );

  const handleAdd = (game: DisplayGame) => {
    if (!steamPath) {
      notify(
        "error",
        "Steam installation not found. Set your Steam path in Settings to install games."
      );
      return;
    }
    if (game.dlc_app_ids.length > 0) setInstallGame(game);
    else addToLibrary(game.app_id);
  };

  const trimmed = query.trim();
  const isSearch = trimmed.length > 0;
  const matched = isSearch && resultsFor === trimmed;

  const displayGames = useMemo<DisplayGame[]>(() => {
    const rawItems = isSearch ? (matched ? results : []) : trending;
    return rawItems
      .filter((it) => metaMap.get(it.app_id)?.kind !== "dlc")
      .map((it) => {
        const meta = metaMap.get(it.app_id);
        const metaName = meta?.name;
        const name =
          metaName && !/^App \d+$/.test(metaName) ? metaName : it.name;
        return {
          app_id: it.app_id,
          name,
          header_url: meta?.header_url || it.header_url,
          dlc_app_ids: meta?.dlc_app_ids ?? [],
        };
      });
  }, [isSearch, matched, results, trending, metaMap]);

  const showSpinner = isSearch ? !matched : loading;
  const showEmpty = matched && results.length === 0;

  return (
    <div className="catalog">
      <div className="catalog-search">
        <MagnifyingGlass size={16} className="catalog-search-icon" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search games or App ID…"
        />
        {query && (
          <button
            className="catalog-search-clear"
            onClick={() => setQuery("")}
            aria-label="Clear"
          >
            <X size={14} weight="bold" />
          </button>
        )}
      </div>

      {!steamPath && (
        <div className="catalog-warn">
          <Warning size={15} weight="fill" />
          Steam installation not found. Set your Steam path in Settings to install
          games.
        </div>
      )}

      <div className="catalog-count">{isSearch ? "Results" : "Trending"}</div>

      {showSpinner ? (
        <div className="catalog-state">
          <CircleNotch size={22} className="spin" />
          <span className="title">{isSearch ? "Searching…" : "Loading trending…"}</span>
        </div>
      ) : showEmpty ? (
        <div className="catalog-state">
          <MagnifyingGlass size={24} />
          <span className="title">No games found</span>
        </div>
      ) : (
        <SmoothScroll className="catalog-grid" deps={[displayGames.length, isSearch]}>
          {displayGames.map((game, i) => (
            <CatalogCard
              key={game.app_id}
              game={game}
              installed={installedIds.has(String(game.app_id))}
              installing={installingId === game.app_id}
              unavailable={unavailable.has(game.app_id)}
              index={i}
              onOpen={() => setSelected(game)}
              onAdd={() => handleAdd(game)}
              onManage={onNavigate}
            />
          ))}
        </SmoothScroll>
      )}

      {selected && (
        <CatalogModal
          key={selected.app_id}
          appId={selected.app_id}
          name={selected.name}
          headerUrl={selected.header_url}
          dlcAppIds={selected.dlc_app_ids}
          installedIds={installedIds}
          steamPath={steamPath}
          onClose={() => setSelected(null)}
          onInstall={handleInstall}
          onInstallAt={handleInstallAt}
          onInstalled={markInstalled}
          onSelectInstall={() => setInstallGame(selected)}
        />
      )}

      {installGame && (
        <InstallSelectModal
          appId={installGame.app_id}
          name={installGame.name}
          dlcAppIds={installGame.dlc_app_ids}
          installedIds={installedIds}
          steamPath={steamPath}
          onClose={() => setInstallGame(null)}
          onInstalled={markInstalled}
        />
      )}
    </div>
  );
}

export default CatalogPage;
