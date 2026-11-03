import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, NavLink } from "react-router-dom";
import { Archive, BookOpen, Home, MoreHorizontal, PanelLeftClose, Pencil, Plus, Search, Server, Trash2 } from "lucide-react";

import Logo from "./Logo.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import { groupByDate } from "../lib/time.js";

const STATUS_TEXT = {
  checking: "Connecting…",
  online: "Connected",
  offline: "Offline",
};

const STATUS_HINT = {
  checking: "One moment",
  online: "Ready to chat",
  offline: "Trying to reconnect…",
};

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const MENU_WIDTH = 168;

/** The ⋯ menu for one chat. Rendered into <body> so the sidebar's scroll area can't clip it. */
function ChatMenu({ anchor, onRename, onArchive, onDelete, onClose }) {
  const menuRef = useRef(null);
  const rect = anchor.getBoundingClientRect();
  const openUp = rect.bottom + 160 > window.innerHeight;
  const style = {
    top: openUp ? undefined : rect.bottom + 4,
    bottom: openUp ? window.innerHeight - rect.top + 4 : undefined,
    left: Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)),
    width: MENU_WIDTH,
  };

  useEffect(() => {
    menuRef.current?.querySelector("button")?.focus();
    const onPointerDown = (event) => {
      if (!menuRef.current?.contains(event.target) && !anchor.contains(event.target)) onClose();
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        anchor.focus();
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("resize", onClose);
    };
  }, [anchor, onClose]);

  return createPortal(
    <div ref={menuRef} className="sb-menu" role="menu" style={style}>
      <button type="button" role="menuitem" onClick={onRename}>
        <Pencil size={15} /> Rename
      </button>
      <button type="button" role="menuitem" onClick={onArchive}>
        <Archive size={15} /> Archive
      </button>
      <div className="sb-menu-sep" role="separator" />
      <button type="button" role="menuitem" className="is-danger" onClick={onDelete}>
        <Trash2 size={15} /> Delete
      </button>
    </div>,
    document.body,
  );
}

function ChatRow({ conversation, menuOpen, onOpenMenu, onCloseMenu, onNavigate, onRename, onArchive, onDelete }) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(conversation.title);
  const moreRef = useRef(null);

  const startRename = () => {
    onCloseMenu();
    setDraft(conversation.title);
    setRenaming(true);
  };

  const finishRename = (save) => {
    setRenaming(false);
    const title = draft.trim().replace(/\s+/g, " ");
    if (save && title && title !== conversation.title) onRename(conversation.session_id, title.slice(0, 100));
  };

  if (renaming) {
    return (
      <div className="sb-row is-renaming">
        <input
          className="sb-rename"
          value={draft}
          maxLength={100}
          autoFocus
          onFocus={(event) => event.target.select()}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") finishRename(true);
            if (event.key === "Escape") {
              event.stopPropagation();
              finishRename(false);
            }
          }}
          onBlur={() => finishRename(true)}
          aria-label="Chat name"
        />
      </div>
    );
  }

  return (
    <div className={`sb-row ${menuOpen ? "menu-open" : ""}`}>
      <NavLink
        to={`/chat/${conversation.session_id}`}
        className="sb-item"
        onClick={onNavigate}
        onDoubleClick={startRename}
        title={conversation.title}
      >
        {conversation.title}
      </NavLink>
      <button
        ref={moreRef}
        type="button"
        className="sb-more"
        onClick={() => (menuOpen ? onCloseMenu() : onOpenMenu(conversation.session_id))}
        aria-label={`Options for ${conversation.title}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        <MoreHorizontal size={16} />
      </button>
      {menuOpen && moreRef.current && (
        <ChatMenu
          anchor={moreRef.current}
          onClose={onCloseMenu}
          onRename={startRename}
          onArchive={() => {
            onCloseMenu();
            onArchive(conversation.session_id);
          }}
          onDelete={() => {
            onCloseMenu();
            onDelete(conversation.session_id);
          }}
        />
      )}
    </div>
  );
}

export default function Sidebar({
  conversations,
  status,
  archivedCount,
  onOpenSearch,
  onOpenArchive,
  onNewChat,
  onCollapse,
  onNavigate,
  onRename,
  onArchive,
  onDelete,
}) {
  const [menuFor, setMenuFor] = useState(null);
  const historyRef = useRef(null);

  const groups = useMemo(() => groupByDate(conversations), [conversations]);

  // Close an open menu when the list scrolls (it would otherwise float away from its row).
  useEffect(() => {
    const list = historyRef.current;
    if (!list || !menuFor) return undefined;
    const close = () => setMenuFor(null);
    list.addEventListener("scroll", close, { once: true });
    return () => list.removeEventListener("scroll", close);
  }, [menuFor]);

  return (
    <aside className="sidebar">
      <div className="sb-top">
        <Logo />
        <button type="button" className="icon-btn sb-collapse" onClick={onCollapse} aria-label="Hide sidebar" title="Hide sidebar">
          <PanelLeftClose size={18} />
        </button>
      </div>

      <button type="button" className="btn-ink" onClick={onNewChat}>
        <Plus size={18} /> New chat
      </button>

      <button type="button" className="sb-search" onClick={onOpenSearch} aria-haspopup="dialog">
        <Search size={16} />
        <span className="sb-search-text">Search chats</span>
        <kbd>{IS_MAC ? "⌘K" : "Ctrl K"}</kbd>
      </button>

      <nav className="sb-nav" aria-label="App">
        <Link to="/" className="sb-link" onClick={onNavigate}>
          <Home size={17} /> Home
        </Link>
        <Link to="/documentation" className="sb-link" onClick={onNavigate}>
          <BookOpen size={17} /> Documentation
        </Link>
      </nav>

      <div className="sb-divider" />

      <nav className="sb-history" aria-label="Conversations" ref={historyRef}>
        {groups.length === 0 && (
          <p className="sb-empty">Your conversations will appear here.</p>
        )}
        {groups.map((group) => (
          <section key={group.label}>
            <p className="sb-group-label">{group.label}</p>
            {group.items.map((conversation) => (
              <ChatRow
                key={conversation.session_id}
                conversation={conversation}
                menuOpen={menuFor === conversation.session_id}
                onOpenMenu={setMenuFor}
                onCloseMenu={() => setMenuFor(null)}
                onNavigate={onNavigate}
                onRename={onRename}
                onArchive={onArchive}
                onDelete={onDelete}
              />
            ))}
          </section>
        ))}
      </nav>

      <button type="button" className="sb-archive-btn" onClick={onOpenArchive} aria-haspopup="dialog">
        <Archive size={17} />
        <span>Archived chats</span>
        {archivedCount > 0 && <span className="sb-count">{archivedCount}</span>}
      </button>

      <div className="status-card">
        <span className={`status-avatar status-${status}`}>
          <Server size={17} />
        </span>
        <div className="status-text">
          <strong>{STATUS_TEXT[status]}</strong>
          <span>{STATUS_HINT[status]}</span>
        </div>
        <ThemeToggle />
      </div>
    </aside>
  );
}
