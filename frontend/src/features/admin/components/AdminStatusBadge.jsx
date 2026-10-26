const labels = {
  active: "Active",
  inactive: "Inactive",
  revoked: "Revoked",
};

export default function AdminStatusBadge({ status }) {
  return <span className={`admin-status-badge admin-status-badge--${status}`}>{labels[status]}</span>;
}
