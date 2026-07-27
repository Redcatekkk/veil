import { ReactNode, useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowSquareOut,
  ArrowsClockwise,
  CaretRight,
  CheckCircle,
  CircleNotch,
  DownloadSimple,
  FolderOpen,
  GameController,
  Warning,
  XCircle,
} from "@phosphor-icons/react";
import SmoothScroll from "../components/SmoothScroll";
import { openFolder } from "../lib/library";
import {
  downloadGamingTool,
  gamingServicesVersion,
  listGamingTools,
  openStore,
  runGamingTool,
  type ToolFile,
} from "../lib/tools";
import type { ToastKind } from "../lib/useToast";
import "./fixes.css";

const TOOL_NAME = "GamingRepairTool.exe";
const STORE_PRODUCT_ID = "9MWPM2CQNLHN";
const STORE_URL = `https://www.microsoft.com/store/productId/${STORE_PRODUCT_ID}?ocid=libraryshare`;
const MIN_VERSION = "36.113.2002.0";

type FixId = "forza";

interface FixEntry {
  id: FixId;
  title: string;
  desc: string;
  icon: ReactNode;
}

const ENTRIES: FixEntry[] = [
  {
    id: "forza",
    title: "Forza Horizon 6 Fixer",
    desc: "Repair the Xbox Gaming Services component required by Forza Horizon 6 on Steam.",
    icon: <GameController size={22} weight="regular" />,
  },
];

function compareVersion(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function parentDir(path: string): string {
  const i = Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/"));
  return i > 0 ? path.slice(0, i) : path;
}

type VersionState =
  | { status: "loading" }
  | { status: "ok"; version: string }
  | { status: "outdated"; version: string }
  | { status: "missing" }
  | { status: "unknown" };

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="fix-step">
      <span className="fix-step-n">{n}</span>
      <span className="fix-step-body">{children}</span>
    </li>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="fix-section">
      <p className="fix-section-title">{title}</p>
      {children}
    </div>
  );
}

function VersionStatus({
  state,
  onRecheck,
}: {
  state: VersionState;
  onRecheck: () => void;
}) {
  const config =
    state.status === "loading"
      ? {
          tone: "neutral",
          icon: <CircleNotch size={18} className="spin" />,
          title: "Checking installed version…",
          body: "Reading your current Gaming Services version.",
        }
      : state.status === "ok"
      ? {
          tone: "good",
          icon: <CheckCircle size={18} weight="fill" />,
          title: "Gaming Services is up to date",
          body: `Installed version ${state.version} meets the minimum of ${MIN_VERSION}. No fix needed.`,
        }
      : state.status === "outdated"
      ? {
          tone: "warn",
          icon: <Warning size={18} weight="fill" />,
          title: "Gaming Services is out of date",
          body: `Installed version ${state.version} is below the minimum of ${MIN_VERSION}. Run the repair tool or update it to fix Forza Horizon 6.`,
        }
      : state.status === "missing"
      ? {
          tone: "warn",
          icon: <XCircle size={18} weight="fill" />,
          title: "Gaming Services not detected",
          body: "Gaming Services does not appear to be installed. Install it from the Microsoft Store or run the repair tool.",
        }
      : {
          tone: "neutral",
          icon: <Warning size={18} weight="fill" />,
          title: "Couldn't check the version",
          body: "Veil was unable to read your installed Gaming Services version.",
        };

  return (
    <div className={`fix-status ${config.tone}`}>
      <span className="fix-status-icon">{config.icon}</span>
      <div className="fix-status-text">
        <p className="fix-status-title">{config.title}</p>
        <p className="fix-status-body">{config.body}</p>
      </div>
      {state.status !== "loading" && (
        <button className="fix-btn ghost recheck" onClick={onRecheck}>
          <ArrowsClockwise size={13} weight="bold" />
          Re-check
        </button>
      )}
    </div>
  );
}

function ForzaFix({
  onBack,
  notify,
}: {
  onBack: () => void;
  notify: (kind: ToastKind, message: string) => void;
}) {
  const [tool, setTool] = useState<ToolFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [version, setVersion] = useState<VersionState>({ status: "loading" });

  const checkVersion = useCallback(() => {
    setVersion({ status: "loading" });
    gamingServicesVersion()
      .then((v) => {
        if (!v) {
          setVersion({ status: "missing" });
          return;
        }
        setVersion(
          compareVersion(v, MIN_VERSION) >= 0
            ? { status: "ok", version: v }
            : { status: "outdated", version: v }
        );
      })
      .catch(() => setVersion({ status: "unknown" }));
  }, []);

  useEffect(() => {
    let alive = true;
    listGamingTools()
      .then((files) => {
        if (!alive) return;
        setTool(files.find((f) => f.name === TOOL_NAME) ?? null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => checkVersion(), [checkVersion]);

  const download = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setSavedPath(null);
    try {
      const path = await downloadGamingTool(TOOL_NAME);
      setSavedPath(path);
      await runGamingTool(path);
      notify("success", "Repair Tool downloaded and launched.");
    } catch (e) {
      notify("error", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [busy, notify]);

  return (
    <div className="fixes">
      <div className="fixes-head">
        <button className="fix-back" onClick={onBack}>
          <ArrowLeft size={14} weight="bold" />
          Fixes
        </button>
        <h2 className="fixes-title">Forza Horizon 6 Fixer</h2>
        <p className="fixes-sub">
          Repairs the Xbox Gaming Services component required by Forza Horizon 6 on
          Steam.
        </p>
      </div>

      <SmoothScroll
        className="fixes-scroll"
        deps={[version.status, savedPath, tool]}
      >
        <VersionStatus state={version} onRecheck={checkVersion} />

        <div className="fix-alert">
          <div className="fix-alert-head">
            <Warning size={20} weight="fill" />
            <div>
              <p className="fix-alert-title">Invalid Gaming Services Detected</p>
              <p className="fix-alert-body">
                If Forza Horizon 6 shows the error below on launch, your system has an
                outdated version of Gaming Services. Run the repair tool or update it
                manually — both methods are below.
              </p>
            </div>
          </div>
          <div className="fix-alert-image">
            <img
              src="/images/invalidgamingservices.png"
              alt="Invalid Gaming Services Detected"
              draggable={false}
            />
          </div>
        </div>

        <Section title="Repair Tool">
          <div className="fix-tool">
            <div className="fix-tool-icon">
              <DownloadSimple size={20} />
            </div>
            <div className="fix-tool-info">
              <p className="fix-tool-name">Gaming Services Repair Tool</p>
              <p className="fix-tool-sub">
                Microsoft's official repair utility
                {tool ? ` · ${formatSize(tool.size)}` : ""}
              </p>
            </div>
            <button className="fix-btn primary download" onClick={download} disabled={busy}>
              {busy ? (
                <CircleNotch size={15} weight="bold" className="spin" />
              ) : (
                "Download & Run"
              )}
            </button>
          </div>

          {savedPath && (
            <div className="fix-saved">
              <CheckCircle size={16} weight="fill" />
              <p className="fix-saved-path">{savedPath}</p>
              <button
                className="fix-btn ghost"
                onClick={() => openFolder(parentDir(savedPath)).catch(() => {})}
              >
                <FolderOpen size={14} weight="bold" />
                Open Folder
              </button>
            </div>
          )}

          <ol className="fix-steps">
            <Step n={1}>
              Click Download &amp; Run — Veil downloads the tool to your Downloads folder
              and launches it automatically.
            </Step>
            <Step n={2}>
              A command prompt opens and automatically runs checks, then installs the
              needed Gaming Services updates for your PC.
            </Step>
            <Step n={3}>
              When it finishes, type <b>Y</b> or <b>N</b> and press Enter to leave
              feedback on how the tool worked.
            </Step>
            <Step n={4}>Once repaired, launch Forza Horizon 6 again and enjoy.</Step>
          </ol>
        </Section>

        <Section title="Manual Update via Microsoft Store">
          <p className="fix-text">
            Steam players need an up-to-date Gaming Services component before playing.
            This applies to both the Xbox app and Steam versions of the game.
          </p>
          <ol className="fix-steps">
            <Step n={1}>
              Open the Microsoft Store (press the Windows key and type <b>Store</b>).
            </Step>
            <Step n={2}>Click Downloads in the lower-left of the Store app.</Step>
            <Step n={3}>
              Click Check for updates in the top-right of the Updates &amp; downloads
              page.
            </Step>
            <Step n={4}>Find Gaming Services in the list and click Update.</Step>
          </ol>
          <p className="fix-text dim">
            If it's already current, you'll only see an Open option or an Installed
            label. If Gaming Services isn't listed, install it directly from the Store.
          </p>
          <button
            className="fix-btn ghost store"
            onClick={() => openStore(STORE_PRODUCT_ID, STORE_URL).catch(() => {})}
          >
            <ArrowSquareOut size={15} weight="bold" />
            Open Gaming Services in the Microsoft Store
          </button>
        </Section>

        <Section title="Check Your Installed Version">
          <p className="fix-text">
            The minimum supported version is <b>{MIN_VERSION}</b> or greater.
          </p>
          <ol className="fix-steps">
            <Step n={1}>
              Open Settings (press the Windows key and type <b>Settings</b>).
            </Step>
            <Step n={2}>Go to Apps, then Installed apps.</Step>
            <Step n={3}>
              Search for <b>Gaming Services</b>.
            </Step>
            <Step n={4}>Click the "..." button and choose Advanced options.</Step>
            <Step n={5}>The version number shown must be {MIN_VERSION} or greater.</Step>
          </ol>
        </Section>

        <p className="fixes-footnote">
          Still seeing the error after both methods? Open a ticket in the Veil Discord
          server and we'll help you out.
        </p>
      </SmoothScroll>
    </div>
  );
}

function FixesPage({
  notify,
}: {
  notify: (kind: ToastKind, message: string) => void;
}) {
  const [open, setOpen] = useState<FixId | null>(null);

  if (open === "forza") {
    return <ForzaFix onBack={() => setOpen(null)} notify={notify} />;
  }

  return (
    <div className="fixes">
      <div className="fixes-head">
        <h2 className="fixes-title">Fixes</h2>
        <p className="fixes-sub">Patches and game-specific repair tools.</p>
      </div>

      <div className="fixes-list">
        {ENTRIES.map((entry, i) => (
          <button
            key={entry.id}
            className="fix-card"
            style={{ animationDelay: `${i * 0.04}s` }}
            onClick={() => setOpen(entry.id)}
          >
            <span className="fix-card-icon">{entry.icon}</span>
            <span className="fix-card-info">
              <span className="fix-card-title">{entry.title}</span>
              <span className="fix-card-desc">{entry.desc}</span>
            </span>
            <CaretRight size={18} weight="bold" className="fix-card-caret" />
          </button>
        ))}
      </div>
    </div>
  );
}

export default FixesPage;
