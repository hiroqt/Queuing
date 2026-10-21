export default function AdminSectionHeader({ id, eyebrow, title, countLabel, action }) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={id}>{title}</h2>
      </div>
      <div className="admin-section-tools">
        {countLabel && <span className="count-label">{countLabel}</span>}
        {action}
      </div>
    </div>
  );
}
