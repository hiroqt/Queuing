import { useCallback, useEffect, useState } from "react";
import { departmentApi, servicesApi, usersApi } from "../../../api/client.js";
import { useOutletContext } from "react-router";
import AdminFeedback from "../components/AdminFeedback.jsx";
import AdminSectionHeader from "../components/AdminSectionHeader.jsx";

const roles = ["Reception", "Staff", "Admin"];

export default function UsersSection() {
  const { setCredential } = useOutletContext();
  const [departments, setDepartments] = useState([]);
  const [services, setServices] = useState([]);
  const [users, setUsers] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    try {
      const [departmentRows, serviceRows, userRows] = await Promise.all([
        departmentApi.adminList(signal), servicesApi.list(signal), usersApi.list(signal),
      ]);
      setDepartments(departmentRows);
      setServices(serviceRows);
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
    const role = data.get("role");
    const serviceIds = role === "Staff"
      ? [...form.elements.serviceIds.selectedOptions].map((option) => option.value)
      : [];
    if (role === "Staff" && serviceIds.length === 0) {
      setError("Assign staff to at least one active Service.");
      return;
    }
    const result = await act(() => usersApi.create({ userName: data.get("userName").trim(), role, serviceIds }), "User provisioned.");
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
    const role = data.get("role");
    const serviceIds = role === "Staff"
      ? [...form.elements.serviceIds.selectedOptions].map((option) => option.value)
      : [];
    const result = await act(() => usersApi.update(user.id, { role, serviceIds, active: data.get("active") === "on" }), `Updated ${user.userName}.`);
    if (result) setEditingId("");
  }

  async function deleteUser() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    setError("");
    try {
      await usersApi.delete(deleteTarget.id);
      setMessage(`Deleted ${deleteTarget.userName}.`);
      setDeleteTarget(null);
      await load();
    } catch (cause) {
      setDeleteError(cause.message);
    } finally {
      setDeleting(false);
    }
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
        <label htmlFor="new-user-services">Services for staff</label>
        <p className="field-hint">Service assignments apply only to Staff users and define which queue items they can operate.</p>
        <select id="new-user-services" name="serviceIds" multiple size={Math.min(Math.max(services.filter((item) => item.active).length, 2), 5)}>
          {services.filter((service) => service.active && departments.some((department) => department.id === service.departmentId && department.active))
            .map((service) => <option key={service.id} value={service.id}>{departments.find((item) => item.id === service.departmentId)?.name} · {service.name}</option>)}
        </select>
        <button className="button button-dark" type="submit">Provision user</button>
      </form>}
      <div className="admin-record-list">{users.map((user) => (
        <article className="admin-record" key={user.id}>
          <div className="admin-record-summary">
            <strong>{user.userName}</strong>
            <span>{user.role} · {(user.serviceIds ?? []).map((id) => {
              const service = services.find((item) => item.id === id);
              const department = service && departments.find((item) => item.id === service.departmentId);
              return service ? `${department?.name ?? "Department"} · ${service.name}` : null;
            }).filter(Boolean).join(", ") || ((user.departmentIds ?? []).length ? "Legacy department queues only" : "No Service assigned")}</span>
            <span className="enabled-label">{user.active ? "Active" : "Inactive"}</span>
          </div>
          {editingId === user.id ? <form onSubmit={(event) => updateUser(event, user)}>
            <label htmlFor={`role-${user.id}`}>Role</label>
            <select id={`role-${user.id}`} name="role" defaultValue={user.role}>{roles.map((role) => <option key={role}>{role}</option>)}</select>
            <label htmlFor={`services-${user.id}`}>Assigned Services</label>
            <p className="field-hint">Queue actions are limited to these Services. Service-less historical queue items stay scoped to the retained Department assignment.</p>
            <select id={`services-${user.id}`} name="serviceIds" multiple size={Math.min(Math.max(services.filter((item) => item.active || (user.serviceIds ?? []).includes(item.id)).length, 2), 5)} defaultValue={user.serviceIds ?? []}>
              {services.filter((service) => service.active || (user.serviceIds ?? []).includes(service.id))
                .map((service) => <option key={service.id} value={service.id}>{departments.find((item) => item.id === service.departmentId)?.name} · {service.name}{service.active ? "" : " (inactive)"}</option>)}
            </select>
            <label className="checkbox-row"><input type="checkbox" name="active" defaultChecked={user.active} /> Active</label>
            <div className="admin-form-actions"><button className="button button-dark" type="submit">Save user access</button><button className="text-button" type="button" onClick={() => setEditingId("")}>Cancel</button></div>
          </form> : <div className="admin-form-actions"><button className="text-button" type="button" onClick={() => setEditingId(user.id)}>Edit access</button><button className="text-button danger-button" type="button" onClick={() => { setDeleteError(""); setDeleteTarget(user); }}>Delete user</button></div>}
        </article>
      ))}</div>
      {deleteTarget && <div className="confirmation-backdrop"><section className="confirmation-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-user-heading" aria-describedby="delete-user-description" onKeyDown={(event) => { if (event.key === "Escape" && !deleting) setDeleteTarget(null); }}><h3 id="delete-user-heading">Delete {deleteTarget.userName}?</h3><p id="delete-user-description">This permanently removes this account and its access assignments. The user will no longer be able to sign in.</p>{deleteError && <p className="confirmation-error" role="alert">{deleteError}</p>}<div className="admin-form-actions"><button className="button button-dark danger-confirm" type="button" disabled={deleting} onClick={deleteUser}>{deleting ? "Deleting…" : "Delete user"}</button><button className="button button-quiet" type="button" autoFocus disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancel</button></div></section></div>}
    </section>
  );
}
