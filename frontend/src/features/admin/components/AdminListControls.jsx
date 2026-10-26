import { useState } from "react";
import AdminSearchBar from "./AdminSearchBar.jsx";

export default function AdminListControls({ items, searchLabel, searchPlaceholder, alwaysShowSearch = false, getSearchText, getStatus = () => "active", children }) {
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const canSearch = alwaysShowSearch || items.length > 5 || query.length > 0 || appliedQuery.length > 0;
  const statuses = new Set(items.map(getStatus));
  const canFilterStatus = statuses.has("active") && statuses.has("inactive");
  const normalizedQuery = appliedQuery.toLocaleLowerCase();
  const filteredItems = items.filter((item) => {
    const matchesQuery = !normalizedQuery || getSearchText(item).toLocaleLowerCase().includes(normalizedQuery);
    const matchesStatus = !canFilterStatus || status === "all" || getStatus(item) === status;
    return matchesQuery && matchesStatus;
  });
  const pageCount = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const showPagination = items.length > 10;
  const rangeStart = filteredItems.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, filteredItems.length);

  function applySearch(event) {
    event.preventDefault();
    setAppliedQuery(query.trim());
    setPage(1);
  }

  function updateStatus(event) {
    setStatus(event.target.value);
    setPage(1);
  }

  function updatePageSize(event) {
    setPageSize(Number(event.target.value));
    setPage(1);
  }

  return (
    <>
      {(canSearch || canFilterStatus) && <div className="admin-list-controls">
        {canSearch && <AdminSearchBar label={searchLabel} placeholder={searchPlaceholder} value={query} onChange={(event) => setQuery(event.target.value)} onSearch={applySearch} />}
        {canFilterStatus && <label>Status
          <select value={status} onChange={updateStatus}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>}
        {!showPagination && <span className="admin-list-result-count" aria-live="polite">{filteredItems.length} of {items.length}</span>}
      </div>}
      {filteredItems.length > 0
        ? children(pageItems)
        : <p className="panel-description" role="status">No {searchLabel} match those filters.</p>}
      {showPagination && <div className="admin-pagination">
        <label className="admin-page-size">Rows per page
          <select value={pageSize} onChange={updatePageSize}>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </label>
        <span className="admin-pagination-range" aria-live="polite">{filteredItems.length ? `Showing ${rangeStart}–${rangeEnd} of ${filteredItems.length}` : "No matching results"}</span>
        <nav className="admin-pagination-nav" aria-label={`${searchLabel} pages`}>
          <button className="button button-quiet" type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1}>Previous</button>
          <span>Page {currentPage} of {pageCount}</span>
          <button className="button button-quiet" type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= pageCount}>Next</button>
        </nav>
      </div>}
    </>
  );
}
