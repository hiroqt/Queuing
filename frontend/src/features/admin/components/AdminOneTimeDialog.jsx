import { useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import AdminDialog from "./AdminDialog.jsx";

export default function AdminOneTimeDialog({ notice, onClose }) {
  const valueRef = useRef(null);
  const [visible, setVisible] = useState(true);
  const [copyMessage, setCopyMessage] = useState("");
  const isPassword = notice.kind === "credential";

  async function copyValue() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(notice.secret);
      setCopyMessage(isPassword ? "Password copied." : "Pairing code copied.");
    } catch {
      valueRef.current?.focus();
      valueRef.current?.select();
      setCopyMessage("Copy didn’t work here. The value is selected so you can copy it manually.");
    }
  }

  return (
    <AdminDialog title={notice.title} onClose={onClose}>
      <div className="one-time-dialog-content">
        {notice.itemName && <p className="one-time-item-name">{notice.itemName}</p>}
        {notice.userName && <p className="one-time-item-name"><strong>Username:</strong> {notice.userName}</p>}
        <label htmlFor="one-time-secret">{isPassword ? "Temporary password" : "One-time pairing code"}</label>
        <div className="one-time-secret-row">
          <input
            ref={valueRef}
            id="one-time-secret"
            type={isPassword && !visible ? "password" : "text"}
            value={notice.secret}
            readOnly
            autoFocus
            spellCheck="false"
            autoComplete="off"
          />
          {isPassword && <button
            className="one-time-reveal"
            type="button"
            aria-label={visible ? "Hide temporary password" : "Show temporary password"}
            title={visible ? "Hide temporary password" : "Show temporary password"}
            onClick={() => setVisible((current) => !current)}
          >
            {visible ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
          </button>}
        </div>
        <button className="button button-dark one-time-copy" type="button" onClick={copyValue}>
          Copy {isPassword ? "password" : "pairing code"}
        </button>
        {copyMessage && <p className="field-hint" role="status">{copyMessage}</p>}
        <p className="one-time-guidance">{notice.guidance}</p>
        {notice.href && <a className="one-time-link" href={notice.href} target="_blank" rel="noopener noreferrer">{notice.linkLabel}</a>}
      </div>
    </AdminDialog>
  );
}
