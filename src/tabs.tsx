import { ReactNode } from "react";

export type TabId =
  | "library"
  | "catalog"
  | "fixes"
  | "bypasses"
  | "cloud-saves"
  | "config"
  | "settings";

export interface Tab {
  id: TabId;
  label: string;
  icon: ReactNode;
}

export interface TabGroup {
  heading: string;
  tabs: Tab[];
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const ICONS: Record<TabId, ReactNode> = {
  library: (
    <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </svg>
  ),
  catalog: (
    <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="12" r="8" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </svg>
  ),
  fixes: (
    <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
      <path d="M14.5 5.5a4 4 0 0 0-5.4 5.4L4 16v4h4l5.1-5.1a4 4 0 0 0 5.4-5.4l-2.7 2.7-2.3-.5-.5-2.3z" />
    </svg>
  ),
  bypasses: (
    <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  "cloud-saves": (
    <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
      <path d="M7 18a4 4 0 0 1-.5-8 5.5 5.5 0 0 1 10.6-1.3A3.8 3.8 0 0 1 17.5 18z" />
      <path d="M12 11v5m0 0-2-2m2 2 2-2" />
    </svg>
  ),
  config: (
    <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
      <path d="M13 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z" />
      <path d="M13 3v6h6" />
      <path d="M10.5 12.5 9 14.5l1.5 2" />
      <path d="M13.5 12.5 15 14.5l-1.5 2" />
    </svg>
  ),
  settings: (
    <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
    </svg>
  ),
};

export const TAB_GROUPS: TabGroup[] = [
  {
    heading: "Workspace",
    tabs: [
      { id: "library", label: "Library", icon: ICONS.library },
      { id: "catalog", label: "Catalog", icon: ICONS.catalog },
    ],
  },
  {
    heading: "Tools",
    tabs: [
      { id: "fixes", label: "Fixes", icon: ICONS.fixes },
      { id: "bypasses", label: "Bypasses", icon: ICONS.bypasses },
      { id: "cloud-saves", label: "Cloud Saves", icon: ICONS["cloud-saves"] },
    ],
  },
];

export const BOTTOM_TABS: Tab[] = [
  { id: "config", label: "Config", icon: ICONS.config },
  { id: "settings", label: "Settings", icon: ICONS.settings },
];

export const ALL_TABS: Tab[] = [
  ...TAB_GROUPS.flatMap((g) => g.tabs),
  ...BOTTOM_TABS,
];
