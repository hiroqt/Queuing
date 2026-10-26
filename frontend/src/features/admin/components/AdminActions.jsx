export default function AdminActions({ children }) {
  return (
    <details
      className="admin-actions"
      onClick={(event) => {
        if (event.target.closest("button")) event.currentTarget.open = false;
      }}
    >
      <summary>Actions</summary>
      <div className="admin-actions-menu">{children}</div>
    </details>
  );
}
