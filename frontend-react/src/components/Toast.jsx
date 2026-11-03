import { useEffect } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, X } from "lucide-react";

const SHOW_FOR_MS = 6000;

/** Small notice at the bottom of the screen, with an optional action such as "Undo". */
export default function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(onClose, SHOW_FOR_MS);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  return createPortal(
    <div className="toast" role="status" key={toast.id}>
      <CheckCircle2 size={17} className="toast-icon" />
      <span>{toast.message}</span>
      {toast.actionLabel && (
        <button
          type="button"
          className="toast-action"
          onClick={() => {
            toast.onAction();
            onClose();
          }}
        >
          {toast.actionLabel}
        </button>
      )}
      <button type="button" className="toast-close" onClick={onClose} aria-label="Dismiss">
        <X size={15} />
      </button>
    </div>,
    document.body,
  );
}
