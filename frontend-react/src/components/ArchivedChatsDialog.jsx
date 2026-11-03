import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Archive, ArchiveRestore, Clock, Trash2, X } from "lucide-react";

import { daysLeftLabel, daysUntil, formatDate, timeAgo } from "../lib/time.js";

/** List of archived chats: open, restore, or delete forever. */
export default function ArchivedChatsDialog({ items, retentionDays, loading, onOpen, onRestore, onDeleteForever, onClose }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  return createPortal(
    <div className="search-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="archive-card" role="dialog" aria-modal="true" aria-labelledby="archive-title">
        <div className="archive-head">
          <span className="archive-head-icon">
            <Archive size={18} />
          </span>
          <div>
            <h2 id="archive-title">Archived chats</h2>
            <p>
              Chats you archive or delete stay here for {retentionDays} days, then they're deleted permanently.
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="archive-body">
          {loading && items.length === 0 && <p className="search-empty">Loading…</p>}
          {!loading && items.length === 0 && (
            <div className="archive-empty">
              <Archive size={28} />
              <strong>No archived chats</strong>
              <span>Use “Archive” or “Delete” in a chat's ⋯ menu to move it here.</span>
            </div>
          )}

          {items.map((item) => {
            const urgent = daysUntil(item.delete_at) <= 3;
            return (
              <div key={item.session_id} className="archive-row">
                <button type="button" className="archive-row-main" onClick={() => onOpen(item.session_id)} title="Open this chat">
                  <span className="archive-row-title">{item.title}</span>
                  <span className="archive-row-meta">
                    Archived {timeAgo(item.archived_at)}
                    <span className={`archive-countdown ${urgent ? "is-urgent" : ""}`} title={`Deleted on ${formatDate(item.delete_at)}`}>
                      <Clock size={12} /> Deletes {daysLeftLabel(item.delete_at)}
                    </span>
                  </span>
                </button>
                <div className="archive-row-actions">
                  <button type="button" className="btn-line" onClick={() => onRestore(item.session_id)}>
                    <ArchiveRestore size={15} /> Restore
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-btn-outline archive-delete"
                    onClick={() => onDeleteForever(item)}
                    aria-label={`Delete "${item.title}" forever`}
                    title="Delete forever"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
