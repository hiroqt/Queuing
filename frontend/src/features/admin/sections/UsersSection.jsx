import { useCallback, useEffect, useState } from "react";
import { departmentApi, usersApi } from "../../../api/client.js";
import { useOutletContext } from "react-router";
import AdminFeedback from "../components/AdminFeedback.jsx";
import AdminSectionHeader from "../components/AdminSectionHeader.jsx";

const roles = ["Reception", "Staff", "Admin"];

export default function UsersSection() {
  const { setCredential } = useOutletContext();
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    try {
      const [departmentRows, userRows] = await Promise.all([departmentApi.adminList(signal), usersApi.list(signal)]);
      setDepartments(departmentRows);
      setUsers(userRows);
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

  async function createUser(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const departmentIds = [...form.elements.departmentIds.selectedOptions].map((option) => option.value);
    if (data.get("role") === "Staff" && departmentIds.length === 0) {
      setError("Assign staff to at least one active department.");
      return;
    }
    const result = await act(() => usersApi.create({ userName: data.get("userName").trim(), role: data.get("role"), departmentIds }), "User provisioned.");
    if (result) {
      setCredential(result.oneTimeCredential ?? result.generatedCredential ?? "");
      form.reset();
      setShowCreate(false);
    }
  }

  async function updateUser(event, user) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const departmentIds = [...form.elements.departmentIds.selectedOptions].map((option) => option.value);
    if (data.get("role") === "Staff" && data.get("active") === "on" && departmentIds.length === 0) {
      setError("Active staff must have at least one department assignment.");
      return;
    }
    const result = await act(() => usersApi.update(user.id, { role: data.get("role"), departmentIds, active: data.get("active") === "on" }), `Updated ${user.userName}.`);
    if (result) setEditingId("");
  }

  return (
    <section className="content-panel admin-section" aria-labelledby="users-heading">
      <AdminSectionHeader
        id="users-heading"
        eyebrow="ACCESS"
        title="Users & access"
        countLabel={`${users.length} provisioned`}
        action={<button className="button button-dark" type="button" onClick={() => setShowCreate((value) => !value)}>{showCreate ? "Cancel" : "Add user"}</button>}
      />
      <AdminFeedback error={error} message={message} />
      {loading && <p role="status" className="panel-description">Loading users…</p>}
      {!loading && users.length === 0 && <p className="panel-description">No users are configured. Provision an account to give staff access to the clinic workspace.</p>}
      {showCreate && <form className="admin-inline-form" onSubmit={createUser}>
        <h3>Provision user</h3>
        <p className="panel-description">The API generates a one-time credential that must be changed at first sign-in.</p>
        <label htmlFor="new-user">Username</label>
        <input id="new-user" name="userName" required autoComplete="off" maxLength="100" />
        <label htmlFor="new-user-role">Role</label>
        <select id="new-user-role" name="role" defaultValue="Reception">{roles.map((role) => <option key={role}>{role}</option>)}</select>
        <label htmlFor="new-user-departments">Departments for staff</label>
        <select id="new-user-departments" name="departmentIds" multiple size={Math.min(Math.max(departments.filter((item) => item.active).length, 2), 5)}>
          {departments.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <button className="button button-dark" type="submit">Provision user</button>
      </form>}
      <div className="admin-record-list">{users.map((user) => (
        <article className="admin-record" key={user.id}>
          <div className="admin-record-summary">
            <strong>{user.userName}</strong>
            <span>{user.role} · {(user.departmentIds ?? []).map((id) => departments.find((item) => item.id === id)?.name).filter(Boolean).join(", ") || "No department assigned"}</span>
            <span className="enabled-label">{user.active ? "Active" : "Inactive"}</span>
          </div>
          {editingId === user.id ? <form onSubmit={(event) => updateUser(event, user)}>
            <label htmlFor={`role-${user.id}`}>Role</label>
            <select id={`role-${user.id}`} name="role" defaultValue={user.role}>{roles.map((role) => <option key={role}>{role}</option>)}</select>
            <label htmlFor={`departments-${user.id}`}>Assigned departments</label>
            <select id={`departments-${user.id}`} name="departmentIds" multiple size={Math.min(Math.max(departments.filter((item) => item.active).length, 2), 5)} defaultValue={user.departmentIds ?? []}>
              {departments.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <label className="checkbox-row"><input type="checkbox" name="active" defaultChecked={user.active} /> Active</label>
            <div className="admin-form-actions"><button className="button button-dark" type="submit">Save user access</button><button className="text-button" type="button" onClick={() => setEditingId("")}>Cancel</button></div>
          </form> : <button className="text-button" type="button" onClick={() => setEditingId(user.id)}>Edit access</button>}
        </article>
      ))}</div>
    </section>
  );
}
