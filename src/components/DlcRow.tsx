import { useMemo } from "react";
import { CaretRight, Check, CircleNotch, Prohibit } from "@phosphor-icons/react";
import { headerSources, type AppMeta } from "../lib/library";
import SmartImage from "./SmartImage";

export default function DlcRow({
  appId,
  meta,
  mode,
  checked,
  status,
  onSelect,
}: {
  appId: number;
  meta?: AppMeta;
  mode: "check" | "open";
  checked?: boolean;
  status?: "busy" | "ok" | "fail" | null;
  onSelect: () => void;
}) {
  const sources = useMemo(
    () => headerSources(appId, meta?.header_url || undefined),
    [appId, meta?.header_url]
  );

  return (
    <div className="dlc-row-item" onClick={onSelect}>
      {mode === "check" && (
        <span className={`dlc-check${checked ? " on" : ""}`}>
          {checked && <Check size={11} weight="bold" />}
        </span>
      )}
      <SmartImage sources={sources} className="dlc-row-art" />
      <div className="dlc-row-info">
        <p className="dlc-row-name">{meta?.name ?? `App ${appId}`}</p>
        <p className="dlc-row-id">App ID {appId}</p>
      </div>
      {status === "busy" ? (
        <CircleNotch size={15} className="spin dlc-row-icon" />
      ) : status === "ok" ? (
        <Check size={15} weight="bold" className="dlc-row-icon ok" />
      ) : status === "fail" ? (
        <Prohibit size={15} weight="bold" className="dlc-row-icon fail" />
      ) : mode === "open" ? (
        <CaretRight size={15} weight="bold" className="dlc-row-icon" />
      ) : null}
    </div>
  );
}
