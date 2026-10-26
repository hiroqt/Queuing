import { useLayoutEffect, useRef, useId } from "react";

export default function AdminDialog({ title, onClose, busy = false, children }) {
  const dialogRef = useRef(null);
  const titleId = useId();

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  function requestClose() {
    if (!busy) onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className="admin-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); requestClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) requestClose(); }}
    >
      <div className="admin-dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <button className="button button-quiet" type="button" onClick={requestClose} disabled={busy}>Close</button>
      </div>
      {children}
    </dialog>
  );
}
