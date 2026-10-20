import { useCallback, useEffect, useState } from "react";
import { departmentApi, displaysApi, usersApi } from "../../api/client.js";

const roles = ["Reception", "Staff", "Admin"];

export default function AdminPage() {
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [displays, setDisplays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [credential, setCredential] = useState("");
  const [pairingCode, setPairingCode] = useState("");

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    try {
      const [departmentRows, userRows, displayRows] = await Promise.all([
        departmentApi.adminList(signal), usersApi.list(signal), displaysApi.list(signal),
      ]);
      setDepartments(departmentRows);
      setUsers(userRows);
      setDisplays(displayRows);
    } catch (cause) {
      if (cause.name !== "AbortError") setError(cause.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve().then(() => load(controller.signal));
    return () => controller.abort();
  }, [load]);

  async function act(action, success) {
    setError("");
    setMessage("");
    try {
      const result = await action();
      setMessage(success);
      await load();
      return result;
    } catch (cause) {
      setError(cause.message);
      return null;
    }
  }

  async function createDepartment(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = await act(() => departmentApi.create({ name: data.get("name").trim() }), "Department added.");
    if (result) form.reset();
  }

  async function createUser(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const departmentIds = [...form.elements.departmentIds.selectedOptions].map((option) => option.value);
    if (data.get("role") === "Staff" && departmentIds.length === 0) {
      setError("Assign department staff to at least one active department.");
      return;
    }
    const result = await act(() => usersApi.create({ userName: data.get("userName").trim(), role: data.get("role"), departmentIds }), "User provisioned.");
    if (result) {
      setCredential(result.oneTimeCredential ?? result.generatedCredential ?? "");
      form.reset();
    }
  }

  async function updateUser(event, user) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const departmentIds = [...form.elements.departmentIds.selectedOptions].map((option) => option.value);
    if (data.get("role") === "Staff" && data.get("active") === "on" && departmentIds.length === 0) {
      setError("Active department staff must have at least one department assignment.");
      return;
    }
    await act(() => usersApi.update(user.id, { role: data.get("role"), departmentIds, active: data.get("active") === "on" }), `Updated ${user.userName}.`);
  }

  async function createDisplay(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = await act(() => displaysApi.create({ name: data.get("name").trim(), departmentId: data.get("departmentId") }), "Monitor created.");
    if (result) form.reset();
  }

  async function issuePairingCode(display) {
    const result = await act(() => displaysApi.pairingCode(display.id), `Pairing code created for ${display.name}.`);
    setPairingCode(result?.code ?? "");
  }

  return (
    <section aria-labelledby="admin-heading">
      <div className="page-heading"><div><p className="eyebrow">ADMINISTRATION</p><h1 id="admin-heading">Clinic configuration</h1><p>Manage active departments, staff access, and assigned department displays.</p></div><span className="surface-tag">API managed</span></div>
      {loading && <p role="status" className="panel-description">Loading clinic configuration…</p>}
      {error && <p className="action-message" role="alert">{error}</p>}
      {message && <p className="action-message" role="status">{message}</p>}
      {credential && <p className="action-message" role="status"><strong>One-time credential:</strong> <code>{credential}</code> Save it now; it is shown only once.</p>}
      {pairingCode && <p className="action-message" role="status"><strong>One-time monitor pairing code:</strong> <code>{pairingCode}</code> Enter this on the monitor pairing page. <a className="text-button" href="/display/pair" target="_blank" rel="noopener noreferrer">Open pairing page in a new tab</a></p>}

      <div className="admin-layout">
        <section className="content-panel" aria-labelledby="departments-heading">
          <div className="section-heading"><div><p className="eyebrow">QUEUE DESTINATIONS</p><h2 id="departments-heading">Departments</h2></div><span className="count-label">{departments.length} configured</span></div>
          <ul className="settings-list">{departments.map((department) => <li key={department.id}><span>{department.name}</span><span className="enabled-label">{department.active ? "Active" : "Inactive"}</span><button className="text-button" type="button" disabled={!department.active} onClick={() => act(() => departmentApi.update(department.id, { active: false }), `${department.name} deactivated.`)}>Deactivate</button></li>)}</ul>
          <form className="admin-inline-form" onSubmit={createDepartment}><label htmlFor="new-department">Add department</label><input id="new-department" name="name" required maxLength="100" /><button className="button button-dark" type="submit">Add department</button></form>
        </section>

        <section className="content-panel" aria-labelledby="users-heading">
          <div className="section-heading"><div><p className="eyebrow">ACCESS</p><h2 id="users-heading">Users</h2></div><span className="count-label">{users.length} provisioned</span></div>
          {users.length === 0 && !loading && <p className="panel-description">No users are configured.</p>}
          <div className="admin-record-list">{users.map((user) => <form className="admin-record" key={user.id} onSubmit={(event) => updateUser(event, user)}>
            <strong>{user.userName}</strong><label htmlFor={`role-${user.id}`}>Role</label><select id={`role-${user.id}`} name="role" defaultValue={user.role}>{roles.map((role) => <option key={role}>{role}</option>)}</select>
            <label htmlFor={`departments-${user.id}`}>Assigned departments</label><select id={`departments-${user.id}`} name="departmentIds" multiple size={Math.min(Math.max(departments.length, 2), 5)} defaultValue={user.departmentIds ?? []}>{departments.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
            <label className="checkbox-row"><input type="checkbox" name="active" defaultChecked={user.active} /> Active</label>
            <button className="button button-dark" type="submit">Save user access</button>
          </form>)}</div>
          <form className="admin-inline-form" onSubmit={createUser}><h3>Provision user</h3><p className="panel-description">The API generates a one-time credential, which must be changed at first sign-in.</p><label htmlFor="new-user">Username</label><input id="new-user" name="userName" required autoComplete="off" maxLength="100" /><label htmlFor="new-user-role">Role</label><select id="new-user-role" name="role" defaultValue="Reception">{roles.map((role) => <option key={role}>{role}</option>)}</select><label htmlFor="new-user-departments">Departments for staff</label><select id="new-user-departments" name="departmentIds" multiple size={Math.min(Math.max(departments.length, 2), 5)}>{departments.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button className="button button-dark" type="submit">Provision user</button></form>
        </section>

        <section className="content-panel" aria-labelledby="displays-heading">
          <div className="section-heading"><div><p className="eyebrow">WAITING ROOM DEVICES</p><h2 id="displays-heading">Department displays</h2></div><span className="count-label">{displays.length} registered</span></div>
          <div className="admin-record-list">{displays.map((display) => <article className="admin-record" key={display.id}><strong>{display.name}</strong><span>{departments.find((item) => item.id === display.departmentId)?.name ?? "Department unavailable"}</span><span>{display.active ? "Active" : "Revoked"}</span><button className="text-button" type="button" onClick={() => issuePairingCode(display)} disabled={!display.active}>Create pairing code</button>{display.active && <button className="text-button" type="button" onClick={() => act(() => displaysApi.update(display.id, { active: false }), `${display.name} revoked.`)}>Revoke</button>}</article>)}</div>
          <form className="admin-inline-form" onSubmit={createDisplay}><h3>Register monitor</h3><label htmlFor="display-name">Monitor name</label><input id="display-name" name="name" required maxLength="100" /><label htmlFor="display-department">Assigned department</label><select id="display-department" name="departmentId" required defaultValue=""><option value="" disabled>Select a department</option>{departments.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button className="button button-dark" type="submit">Create monitor</button></form>
        </section>
      </div>
    </section>
  );
}
