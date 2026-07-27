import { ArrowClockwise, CircleNotch, Warning, X } from "@phosphor-icons/react";

interface RestartBannerProps {
  title?: string;
  body: string;
  restarting: boolean;
  onRestart: () => void;
  onDismiss: () => void;
}

function RestartBanner({
  title = "Restart Steam to apply",
  body,
  restarting,
  onRestart,
  onDismiss,
}: RestartBannerProps) {
  return (
    <div className="restart-banner">
      <Warning size={17} weight="fill" className="restart-banner-icon" />
      <div className="restart-banner-text">
        <span className="restart-banner-title">{title}</span>
        <span className="restart-banner-body">{body}</span>
      </div>
      <button
        className="restart-banner-btn"
        onClick={onRestart}
        disabled={restarting}
      >
        {restarting ? (
          <CircleNotch size={14} weight="bold" className="spin" />
        ) : (
          <ArrowClockwise size={14} weight="bold" />
        )}
        Restart &amp; Apply
      </button>
      <button
        className="restart-banner-dismiss"
        onClick={onDismiss}
        aria-label="Dismiss"
      >
        <X size={14} weight="bold" />
      </button>
    </div>
  );
}

export default RestartBanner;
