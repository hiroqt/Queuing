export default function AdminFeedback({ error, message }) {
  return (
    <>
      {error && <p className="action-message" role="alert">{error}</p>}
      {message && <p className="action-message" role="status">{message}</p>}
    </>
  );
}
