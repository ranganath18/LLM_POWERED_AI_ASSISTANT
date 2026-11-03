import { useEffect, useState } from "react";
import { BarChart3, Check, Download, Ghost, Link2, Menu, PanelLeftOpen } from "lucide-react";

const STATUS_TITLE = { checking: "Connecting…", online: "Online", offline: "Offline: trying to reconnect" };

export default function ChatHeader({
  model,
  status,
  sidebarHidden,
  noSidebar = false,
  onShowSidebar,
  onOpenMenu,
  insightsOpen,
  hasNewInsights,
  onToggleInsights,
  shareUrl,
  onExport,
  canExport,
  incognito,
  onToggleIncognito,
  incognitoDisabled,
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      // Clipboard blocked by the browser; nothing else to do.
    }
  };

  return (
    <header className="chat-topbar">
      {!noSidebar && (
        <button type="button" className="icon-btn mobile-only" onClick={onOpenMenu} aria-label="Open menu">
          <Menu size={20} />
        </button>
      )}
      {sidebarHidden && !noSidebar && (
        <button type="button" className="icon-btn desktop-only" onClick={onShowSidebar} aria-label="Show sidebar" title="Show sidebar">
          <PanelLeftOpen size={18} />
        </button>
      )}

      <div className="model-chip" title={STATUS_TITLE[status]}>
        <span className="orb orb-xs" aria-hidden="true" />
        <span className="model-name">{model ?? "Indigo.ai"}</span>
        <span className={`status-dot status-${status}`} />
      </div>
      {incognito && (
        <span className="incognito-pill">
          <Ghost size={14} /> Incognito
        </span>
      )}

      <div className="topbar-actions">
        <button
          type="button"
          className={`incognito-btn ${incognito ? "is-on" : ""}`}
          onClick={onToggleIncognito}
          disabled={incognitoDisabled}
          aria-pressed={incognito}
          title={incognito ? "Turn off incognito (this chat will be deleted)" : "Incognito: chat without saving history"}
        >
          <Ghost size={16} />
          <span className="hide-sm">{incognito ? "Exit incognito" : "Incognito"}</span>
        </button>
        <button
          type="button"
          className={`icon-btn icon-btn-outline ${insightsOpen ? "is-active" : ""} ${hasNewInsights ? "has-dot" : ""}`}
          onClick={onToggleInsights}
          aria-label="Message insights"
          aria-pressed={insightsOpen}
          title="Message insights"
        >
          <BarChart3 size={17} />
        </button>
        <button
          type="button"
          className="icon-btn icon-btn-outline"
          onClick={copyLink}
          disabled={!shareUrl}
          aria-label="Copy link to this chat"
          title={shareUrl ? "Copy link to this chat" : "Send a message first"}
        >
          {copied ? <Check size={17} /> : <Link2 size={17} />}
        </button>
        <button type="button" className="btn-line" onClick={onExport} disabled={!canExport} title="Download as Markdown">
          <Download size={16} />
          <span className="hide-sm">Export chat</span>
        </button>
      </div>
    </header>
  );
}
