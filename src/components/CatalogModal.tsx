import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowSquareOut,
  CaretLeft,
  Check,
  CircleNotch,
  DownloadSimple,
  DotsThreeVertical,
  Stack,
  X,
} from "@phosphor-icons/react";
import {
  catalogDetails,
  catalogInstallSelection,
  catalogVersions,
  type CatalogDetails,
  type CatalogVersion,
} from "../lib/catalog";
import { headerSources, openUrl } from "../lib/library";
import { useReleasedDlc } from "../lib/dlc";
import SmartImage from "./SmartImage";
import SmoothScroll from "./SmoothScroll";
import DlcRow from "./DlcRow";

const detailsCache = new Map<number, CatalogDetails>();

function useHorizontalWheel() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let target = el.scrollLeft;
    let raf: number | null = null;
    const stop = () => {
      if (raf !== null) {
        cancelAnimationFrame(raf);
        raf = null;
      }
    };
    const step = () => {
      const diff = target - el.scrollLeft;
      if (Math.abs(diff) < 0.5) {
        el.scrollLeft = target;
        raf = null;
        return;
      }
      el.scrollLeft += diff * 0.18;
      raf = requestAnimationFrame(step);
    };
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      if (raf === null) target = el.scrollLeft;
      target = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, target + e.deltaY));
      if (raf === null) raf = requestAnimationFrame(step);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", stop);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", stop);
      stop();
    };
  }, []);
  return ref;
}

function useDetails(appId: number) {
  const [details, setDetails] = useState<CatalogDetails | null>(
    detailsCache.get(appId) ?? null
  );
  useEffect(() => {
    if (detailsCache.has(appId)) return;
    let alive = true;
    catalogDetails(appId)
      .then((d) => {
        if (!alive) return;
        detailsCache.set(appId, d);
        setDetails(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [appId]);
  return details;
}

function metaLine(details: CatalogDetails | null) {
  return details
    ? [details.developers[0], details.release_date, details.price]
        .filter(Boolean)
        .join("  ·  ")
    : "";
}

function Screenshots({ details }: { details: CatalogDetails | null }) {
  const stripRef = useHorizontalWheel();
  return (
    <div ref={stripRef} className="cat-shots">
      {details
        ? details.screenshots.map((s) => (
            <SmartImage key={s} sources={[s]} className="cat-shot" />
          ))
        : [0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="cat-shot skeleton">
              <CircleNotch size={16} className="spin" />
            </div>
          ))}
    </div>
  );
}

function Banner({
  appId,
  name,
  fallbackUrl,
  details,
  onBack,
  onClose,
}: {
  appId: number;
  name: string;
  fallbackUrl?: string;
  details: CatalogDetails | null;
  onBack?: () => void;
  onClose: () => void;
}) {
  const sources = headerSources(appId, details?.header_image || fallbackUrl);
  const generic = (s?: string) => !s || /^App \d+$/.test(s);
  const title = [details?.name, name].find((n) => !generic(n)) ?? name;
  return (
    <div className="cat-banner">
      <SmartImage sources={sources} className="cat-banner-img" />
      <div className="cat-banner-fade" />
      <h2 className="cat-banner-title">{title}</h2>
      {onBack && (
        <button className="cat-banner-btn left" onClick={onBack} aria-label="Back">
          <CaretLeft size={15} weight="bold" />
        </button>
      )}
      <button className="cat-banner-btn right" onClick={onClose} aria-label="Close">
        <X size={15} weight="bold" />
      </button>
    </div>
  );
}

function Body({ details }: { details: CatalogDetails | null }) {
  return (
    <>
      {details ? (
        metaLine(details) && <p className="cat-metaline">{metaLine(details)}</p>
      ) : (
        <div className="cat-skel line" style={{ width: "13rem" }} />
      )}
      {details && details.genres.length > 0 && (
        <div className="cat-genres">
          {details.genres.map((g) => (
            <span key={g} className="cat-genre">
              {g}
            </span>
          ))}
        </div>
      )}
      {details ? (
        details.short_description ? (
          <p className="cat-desc">{details.short_description}</p>
        ) : (
          <p className="cat-desc empty">No description available.</p>
        )
      ) : (
        <div className="cat-skel-block">
          {["100%", "96%", "88%", "64%"].map((w) => (
            <div key={w} className="cat-skel line" style={{ width: w }} />
          ))}
        </div>
      )}
    </>
  );
}

function Footer({
  appId,
  installed,
  steamPath,
  onInstall,
  onConfigure,
  extra,
}: {
  appId: number;
  installed: boolean;
  steamPath: string | null;
  onInstall: (appId: number) => Promise<boolean | "missing">;
  onConfigure?: () => void;
  extra?: ReactNode;
}) {
  const [installing, setInstalling] = useState(false);
  const [localDone, setLocalDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const [missing, setMissing] = useState(false);
  const done = installed || localDone;

  const install = async () => {
    if (!steamPath || installing || done) return;
    setInstalling(true);
    setFailed(false);
    setMissing(false);
    const res = await onInstall(appId);
    setInstalling(false);
    if (res === true) setLocalDone(true);
    else if (res === "missing") {
      setMissing(true);
      setTimeout(() => setMissing(false), 3000);
    } else {
      setFailed(true);
      setTimeout(() => setFailed(false), 3000);
    }
  };

  return (
    <div className="cat-foot">
      <button
        className="cat-btn plain"
        onClick={() =>
          openUrl(`https://store.steampowered.com/app/${appId}`).catch(() => {})
        }
      >
        <ArrowSquareOut size={15} weight="bold" />
        Steam Page
      </button>
      <div className="cat-foot-right">
        {done ? (
          <span className="cat-in-library">
            <Check size={15} weight="bold" />
            In Library
          </span>
        ) : onConfigure ? (
          <button className="cat-btn primary" onClick={onConfigure} disabled={!steamPath}>
            <DownloadSimple size={15} weight="bold" />
            Add to Library
          </button>
        ) : missing ? (
          <span className="cat-error-pill">Missing Base App Lua</span>
        ) : failed ? (
          <span className="cat-error-pill">Unavailable</span>
        ) : (
          <button
            className="cat-btn primary"
            onClick={install}
            disabled={installing || !steamPath}
          >
            {installing ? (
              <CircleNotch size={15} weight="bold" className="spin" />
            ) : (
              <DownloadSimple size={15} weight="bold" />
            )}
            {installing ? "Installing…" : "Add to Library"}
          </button>
        )}
        {extra}
      </div>
    </div>
  );
}

function Sheet({ children }: { children: ReactNode }) {
  return <div className="cat-sheet">{children}</div>;
}

function SheetHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
}) {
  return (
    <div className="cat-sheet-head">
      <button className="cat-sheet-back" onClick={onBack} aria-label="Back">
        <CaretLeft size={15} weight="bold" />
      </button>
      <div className="cat-sheet-titles">
        <p className="cat-sheet-title">{title}</p>
        <p className="cat-sheet-sub">{subtitle}</p>
      </div>
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="cat-centered">{children}</div>;
}

function DlcListView({
  gridDlcIds,
  name,
  onBack,
  onOpen,
}: {
  gridDlcIds: number[];
  name: string;
  onBack: () => void;
  onOpen: (id: number, name: string, headerUrl?: string) => void;
}) {
  const { dlcIds, metas, loading } = useReleasedDlc(gridDlcIds);
  return (
    <Sheet>
      <SheetHeader
        title="DLC"
        subtitle={
          loading ? `Loading DLC for ${name}…` : `${dlcIds.length} available for ${name}`
        }
        onBack={onBack}
      />
      {loading ? (
        <Centered>
          <CircleNotch size={16} className="spin" /> Loading DLC…
        </Centered>
      ) : dlcIds.length === 0 ? (
        <Centered>No DLC available</Centered>
      ) : (
        <SmoothScroll className="cat-sheet-scroll" deps={[dlcIds.length]}>
          {dlcIds.map((id) => {
            const m = metas.get(id);
            return (
              <DlcRow
                key={id}
                appId={id}
                meta={m}
                mode="open"
                onSelect={() =>
                  onOpen(id, m?.name ?? `App ${id}`, m?.header_url || undefined)
                }
              />
            );
          })}
        </SmoothScroll>
      )}
    </Sheet>
  );
}

function DlcDetailView({
  appId,
  name,
  headerUrl,
  installed,
  steamPath,
  onInstallDlc,
  onBack,
  onClose,
}: {
  appId: number;
  name: string;
  headerUrl?: string;
  installed: boolean;
  steamPath: string | null;
  onInstallDlc: (dlcId: number, dlcName: string) => Promise<boolean | "missing">;
  onBack: () => void;
  onClose: () => void;
}) {
  const details = useDetails(appId);
  return (
    <Sheet>
      <Banner
        appId={appId}
        name={name}
        fallbackUrl={headerUrl}
        details={details}
        onBack={onBack}
        onClose={onClose}
      />
      <div className="cat-body">
        <Body details={details} />
        <Screenshots details={details} />
      </div>
      <Footer
        appId={appId}
        installed={installed}
        steamPath={steamPath}
        onInstall={(id) => onInstallDlc(id, name)}
      />
    </Sheet>
  );
}

type View =
  | { t: "versions" }
  | { t: "dlcList" }
  | { t: "dlcDetail"; appId: number; name: string; headerUrl?: string };

export default function CatalogModal({
  appId,
  name,
  headerUrl,
  dlcAppIds,
  installedIds,
  steamPath,
  onClose,
  onInstall,
  onInstallAt,
  onInstalled,
  onSelectInstall,
}: {
  appId: number;
  name: string;
  headerUrl?: string;
  dlcAppIds: number[];
  installedIds: Set<string>;
  steamPath: string | null;
  onClose: () => void;
  onInstall: (appId: number) => Promise<boolean>;
  onInstallAt: (appId: number, sha: string) => Promise<boolean>;
  onInstalled?: () => Promise<void> | void;
  onSelectInstall: () => void;
}) {
  const details = useDetails(appId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [stack, setStack] = useState<View[]>([]);
  const [versions, setVersions] = useState<CatalogVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [installingSha, setInstallingSha] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const top = stack[stack.length - 1];
  const push = (v: View) => setStack((s) => [...s, v]);
  const back = () => setStack((s) => s.slice(0, -1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (stack.length > 0) back();
      else onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, stack.length]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [menuOpen]);

  const installed = installedIds.has(String(appId));
  const dlcUnion = Array.from(
    new Set([...dlcAppIds, ...(details?.dlc_app_ids ?? [])])
  );
  const hasDlc = dlcUnion.length > 0;

  const installDlc = async (
    dlcId: number,
    dlcName: string
  ): Promise<boolean | "missing"> => {
    if (!steamPath) return false;
    const result = await catalogInstallSelection(steamPath, appId, false, [
      [dlcId, dlcName],
    ]).catch(() => null);
    const status = result?.statuses.find((s) => s.app_id === dlcId)?.status;
    if (status === "installed" || status === "appended") {
      await onInstalled?.();
      return true;
    }
    return status === "missing_base" ? "missing" : false;
  };

  const openVersions = () => {
    setMenuOpen(false);
    push({ t: "versions" });
    if (versions.length === 0 && !versionsLoading) {
      setVersionsLoading(true);
      catalogVersions(appId)
        .then((v) => {
          setVersions(v);
          setVersionsLoading(false);
        })
        .catch(() => setVersionsLoading(false));
    }
  };

  const installVersion = async (sha: string) => {
    if (!steamPath || installingSha) return;
    setInstallingSha(sha);
    const ok = await onInstallAt(appId, sha);
    setInstallingSha(null);
    if (ok) back();
  };

  return createPortal(
    <div className="cat-overlay" onMouseDown={onClose}>
      <div className="cat-modal" onMouseDown={(e) => e.stopPropagation()}>
        <Banner
          appId={appId}
          name={name}
          fallbackUrl={headerUrl}
          details={details}
          onClose={onClose}
        />

        <div className="cat-body">
          <Body details={details} />

          {hasDlc && (
            <button className="cat-dlc-btn" onClick={() => push({ t: "dlcList" })}>
              <span className="cat-dlc-btn-left">
                <Stack size={15} weight="bold" />
                View DLC
              </span>
              <CaretLeft size={14} weight="bold" className="cat-dlc-btn-caret" />
            </button>
          )}

          <Screenshots details={details} />
        </div>

        <Footer
          appId={appId}
          installed={installed}
          steamPath={steamPath}
          onInstall={onInstall}
          onConfigure={hasDlc ? onSelectInstall : undefined}
          extra={
            <div ref={menuRef} className="cat-menu-wrap">
              <button
                className="cat-more-btn"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="More"
              >
                <DotsThreeVertical size={18} weight="bold" />
              </button>
              {menuOpen && (
                <div className="cat-menu">
                  <button onClick={openVersions}>Install Older Version</button>
                </div>
              )}
            </div>
          }
        />

        {top?.t === "versions" && (
          <Sheet>
            <SheetHeader
              title="Versions"
              subtitle={`Install a specific build of ${name}`}
              onBack={back}
            />
            {versionsLoading ? (
              <Centered>
                <CircleNotch size={16} className="spin" /> Loading versions…
              </Centered>
            ) : versions.length === 0 ? (
              <Centered>No older versions available</Centered>
            ) : (
              <SmoothScroll className="cat-sheet-scroll" deps={[versions.length]}>
                {versions.map((v, i) => (
                  <button
                    key={v.sha}
                    className="cat-version"
                    onClick={() => installVersion(v.sha)}
                    disabled={installingSha !== null}
                  >
                    <div className="cat-version-info">
                      <div className="cat-version-top">
                        <span className="cat-version-build">Build {v.build_id}</span>
                        {i === 0 && <span className="cat-version-latest">Latest</span>}
                      </div>
                      <p className="cat-version-sub">
                        {v.date.slice(0, 10)} · {v.short_sha}
                      </p>
                    </div>
                    {installingSha === v.sha ? (
                      <CircleNotch size={16} className="spin cat-version-icon" />
                    ) : (
                      <DownloadSimple size={16} weight="bold" className="cat-version-icon" />
                    )}
                  </button>
                ))}
              </SmoothScroll>
            )}
          </Sheet>
        )}

        {top?.t === "dlcList" && (
          <DlcListView
            gridDlcIds={dlcUnion}
            name={name}
            onBack={back}
            onOpen={(id, dlcName, dlcHeader) =>
              push({ t: "dlcDetail", appId: id, name: dlcName, headerUrl: dlcHeader })
            }
          />
        )}

        {top?.t === "dlcDetail" && (
          <DlcDetailView
            appId={top.appId}
            name={top.name}
            headerUrl={top.headerUrl}
            installed={installedIds.has(String(top.appId))}
            steamPath={steamPath}
            onInstallDlc={installDlc}
            onBack={back}
            onClose={onClose}
          />
        )}
      </div>
    </div>,
    document.body
  );
}
