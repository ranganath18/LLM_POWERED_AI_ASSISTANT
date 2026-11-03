import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MessageCircle, Search, SquarePen, X } from "lucide-react";

import { formatRelative } from "../lib/time.js";

const MAX_RESULTS = 50;

/** Wraps the matching part of `text` in <mark>. */
function Highlight({ text, term }) {
  if (!term) return text;
  const index = text.toLowerCase().indexOf(term.toLowerCase());
  if (index === -1) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + term.length)}</mark>
      {text.slice(index + term.length)}
    </>
  );
}

/** ChatGPT-style search card: type to filter chats, ↑/↓ to move, Enter to open, Esc to close. */
export default function SearchChatsDialog({ conversations, onSelect, onNewChat, onClose }) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const term = query.trim();
  const results = useMemo(() => {
    const lower = term.toLowerCase();
    const matches = lower
      ? conversations.filter((item) => `${item.title} ${item.preview}`.toLowerCase().includes(lower))
      : conversations;
    return matches.slice(0, MAX_RESULTS);
  }, [conversations, term]);

  // Rows the keyboard can move through: "New chat" (only when not searching) + the chats.
  const rows = useMemo(
    () => [...(term ? [] : [{ type: "new" }]), ...results.map((chat) => ({ type: "chat", chat }))],
    [results, term],
  );

  useEffect(() => inputRef.current?.focus(), []);
  useEffect(() => setActiveIndex(0), [term]);

  // Keep the highlighted row visible while moving with the arrow keys.
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const choose = (row) => {
    if (!row) return;
    if (row.type === "new") onNewChat();
    else onSelect(row.chat.session_id);
  };

  const onKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, rows.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(rows[activeIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  };

  return createPortal(
    <div className="search-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="search-card" role="dialog" aria-modal="true" aria-label="Search chats" onKeyDown={onKeyDown}>
        <div className="search-head">
          <Search size={18} className="search-head-icon" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search chats…"
            aria-label="Search chats"
            aria-controls="search-results"
            aria-activedescendant={rows.length ? `search-row-${activeIndex}` : undefined}
            autoComplete="off"
            spellCheck={false}
          />
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close search">
            <X size={18} />
          </button>
        </div>

        <div className="search-body" ref={listRef} id="search-results" role="listbox">
          {rows.map((row, index) => {
            const isActive = index === activeIndex;
            const common = {
              id: `search-row-${index}`,
              "data-index": index,
              role: "option",
              "aria-selected": isActive,
              className: `search-row ${isActive ? "is-active" : ""}`,
              onMouseMove: () => setActiveIndex(index),
              onClick: () => choose(row),
            };

            if (row.type === "new") {
              return (
                <div key="new" {...common}>
                  <SquarePen size={17} className="search-row-icon" />
                  <span className="search-row-title">New chat</span>
                </div>
              );
            }

            const showLabel = index === (term ? 0 : 1);
            return (
              <div key={row.chat.session_id}>
                {showLabel && <p className="search-label">{term ? "Results" : "Recent chats"}</p>}
                <div {...common}>
                  <MessageCircle size={17} className="search-row-icon" />
                  <span className="search-row-text">
                    <span className="search-row-title">
                      <Highlight text={row.chat.title} term={term} />
                    </span>
                    {term && row.chat.preview && row.chat.preview !== row.chat.title && (
                      <span className="search-row-preview">
                        <Highlight text={row.chat.preview} term={term} />
                      </span>
                    )}
                  </span>
                  <span className="search-row-time">{formatRelative(row.chat.updated_at)}</span>
                </div>
              </div>
            );
          })}

          {results.length === 0 && (
            <p className="search-empty">{term ? `No chats match "${term}".` : "No chats yet. Start one!"}</p>
          )}
        </div>

        <div className="search-foot" aria-hidden="true">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> to move
          </span>
          <span>
            <kbd>Enter</kbd> to open
          </span>
          <span>
            <kbd>Esc</kbd> to close
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
