export default function AdminSearchBar({ label, placeholder = `Search ${label}`, value, onChange, onSearch }) {
  return (
    <form className="admin-list-search-form" onSubmit={onSearch}>
      <label className="admin-list-search">Search {label}
        <input type="search" value={value} onChange={onChange} placeholder={placeholder} />
      </label>
      <button className="button button-dark" type="submit">Search</button>
    </form>
  );
}
