import { NavLink } from "react-router";
import { adminSectionGroups } from "./adminSections.js";

export default function AdminNavigation() {
  return (
    <div className="admin-nav-groups" role="group" aria-label="Admin sections">
      {adminSectionGroups.map(({ label, sections }) => (
        <section className="admin-nav-group" key={label} aria-label={label}>
          <h2 className="admin-nav-heading">{label}</h2>
          <div className="admin-subnav">
            {sections.map(({ path, label: sectionLabel, note }) => (
              <NavLink className="admin-subnav-link" end key={path} to={`/admin/${path}`}>
                <span>{sectionLabel}</span><small>{note}</small>
              </NavLink>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
