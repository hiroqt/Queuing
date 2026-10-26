import { useState } from "react";

export default function AdminCheckboxList({ id, name, label, options, defaultValue = [], emptyMessage }) {
  const [selected, setSelected] = useState(defaultValue);
  const [query, setQuery] = useState("");
  const filteredOptions = options.filter((option) => option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

  function toggle(value) {
    setSelected((current) => current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value]);
  }

  return (
    <fieldset className="admin-checkbox-list" aria-describedby={`${id}-count`}>
      <legend>{label}</legend>
      <p className="field-hint" id={`${id}-count`}>{selected.length} selected</p>
      {options.length > 0 && <label className="admin-assignment-search" htmlFor={`${id}-search`}>Find an option
        <input id={`${id}-search`} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${label.toLocaleLowerCase()}`} />
      </label>}
      {filteredOptions.length > 0
        ? <div className="admin-checkbox-options">
          {filteredOptions.map((option) => <label className="admin-checkbox-option" key={option.value}>
            <input type="checkbox" name={name} value={option.value} checked={selected.includes(option.value)} onChange={() => toggle(option.value)} />
            <span>{option.label}</span>
          </label>)}
        </div>
        : <p className="field-hint">{query ? "No matching options." : emptyMessage}</p>}
      {selected.filter((value) => !filteredOptions.some((option) => option.value === value)).map((value) => <input key={value} type="hidden" name={name} value={value} />)}
    </fieldset>
  );
}
