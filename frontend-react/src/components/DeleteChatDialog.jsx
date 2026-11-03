import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";

const normalize = (text) => text.trim().replace(/\s+/g, " ");

/**
 * GitHub-style "type the name to confirm" dialog for deleting a chat.
 * The Delete button only unlocks when the typed text matches the chat's title exactly.
 */
export default function DeleteChatDialog({ title, onCancel, onConfirm }) {
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef(null);
  const matches = normalize(typed) === normalize(title);

  useEffect(() => {
    inputRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !deleting) {
        event.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [deleting, onCancel]);

  const submit = async (event) => {
    event.preventDefault();
    if (!matches || deleting) return;
    setDeleting(true);
    try {
      await onConfirm();
    } finally {
      setDeleting(false);
    }
  };

  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !deleting && onCancel()}>
      <form className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" onSubmit={submit}>
        <div className="dialog-head">
          <h2 id="delete-title">Delete chat</h2>
          <button type="button" className="icon-btn" onClick={onCancel} aria-label="Close" disabled={deleting}>
            <X size={18} />
          </button>
        </div>

        <div className="dialog-warning">
          <AlertTriangle size={18} />
          <p>
            This permanently deletes <strong>{title}</strong> and all of its messages. This can't be undone.
          </p>
        </div>

        <label className="dialog-label" htmlFor="delete-confirm">
          To confirm, type <code>{title}</code> below:
        </label>
        <input
          id="delete-confirm"
          ref={inputRef}
          className="dialog-input"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          disabled={deleting}
        />

        <div className="dialog-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={onCancel} disabled={deleting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-danger btn-sm" disabled={!matches || deleting}>
            {deleting ? "Deleting…" : "Delete this chat"}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
