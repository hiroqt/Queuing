import { useState } from "react";
import { NavLink, useLocation } from "react-router";
import { adminSections } from "./adminSections.js";

export default function AdminNavigation() {
  const { pathname } = useLocation();
  const isAdminRoute = pathname.startsWith("/admin");
  const [collapsedPath, setCollapsedPath] = useState("");
  const expanded = isAdminRoute && collapsedPath !== pathname;

  return (
    <div className="admin-nav-group">
      <button
        className="admin-nav-toggle"
        type="button"
        aria-expanded={expanded}
        aria-controls="admin-section-links"
        onClick={() => setCollapsedPath(expanded ? pathname : "")}
      >
        <span className="nav-link-copy"><span>Administration</span><small>Clinic configuration</small></span>
        <span className="admin-nav-chevron" aria-hidden="true">{expanded ? "−" : "+"}</span>
      </button>
      <div id="admin-section-links" className="admin-subnav" role="group" aria-label="Administration sections" hidden={!expanded}>
        {adminSections.map(({ path, label, note }) => (
          <NavLink className="admin-subnav-link" end key={path} to={`/admin/${path}`}>
            <span>{label}</span><small>{note}</small>
          </NavLink>
        ))}
      </div>
    </div>
  );
}
