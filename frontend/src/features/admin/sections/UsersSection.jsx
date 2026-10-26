import { useCallback, useEffect, useState } from "react";
import { departmentApi, servicesApi, usersApi } from "../../../api/client.js";
import { useOutletContext } from "react-router";
import AdminActions from "../components/AdminActions.jsx";
import AdminCheckboxList from "../components/AdminCheckboxList.jsx";
import AdminDialog from "../components/AdminDialog.jsx";
import AdminFeedback from "../components/AdminFeedback.jsx";
import AdminListControls from "../components/AdminListControls.jsx";
import AdminSectionHeader from "../components/AdminSectionHeader.jsx";
import AdminStatusBadge from "../components/AdminStatusBadge.jsx";

const roles = ["Reception", "Staff", "Admin"];

export default function UsersSection() {
  const { setOneTimeNotice } = useOutletContext();
  const [departments, setDepartments] = useState([]);
  const [services, setServices] = useState([]);
  const [users, setUsers] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [newRole, setNewRole] = useState("Reception");
  const [editingRole, setEditingRole] = useState("Reception");
  const [submitting, setSubmitting] = useState(false);
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
    setSubmitting(true);
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
    } finally {
      setSubmitting(false);
    }
  }

  async function createUser(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const role = data.get("role");
    const serviceIds = role === "Staff" ? data.getAll("serviceIds") : [];
    if (role === "Staff" && serviceIds.length === 0) {
      setError("Assign staff to at least one active Service.");
      return;
    }
    const result = await act(() => usersApi.create({ userName: data.get("userName").trim(), role, serviceIds }), "User provisioned.");
    if (result) {
      const temporaryPassword = result.oneTimeCredential ?? result.generatedCredential ?? "";
      if (temporaryPassword) setOneTimeNotice({
        kind: "credential",
        title: "Temporary password generated",
        userName: data.get("userName").trim(),
        secret: temporaryPassword,
        guidance: "Share this password securely. The user will be asked to choose a new password at first sign-in. This password is shown only once.",
      });
      form.reset();
      setShowCreate(false);
      setNewRole("Reception");
    }
  }

  async function updateUser(event, user) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const role = data.get("role");
    const serviceIds = role === "Staff" ? data.getAll("serviceIds") : [];
    const result = await act(() => usersApi.update(user.id, { role, serviceIds }), `Updated ${user.userName}.`);
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
        action={<button className="button button-dark" type="button" onClick={() => setShowCreate(true)} disabled={loading}>Add user</button>}
      />
      <AdminFeedback error={showCreate || editingId ? "" : error} message={message} />
      {loading && <p role="status" className="panel-description">Loading users…</p>}
      {!loading && users.length === 0 && <p className="panel-description">No users are configured. Provision an account to give staff access to the clinic workspace.</p>}
      {showCreate && <AdminDialog title="Add user" onClose={() => { setShowCreate(false); setNewRole("Reception"); }} busy={submitting}>
        <form onSubmit={createUser}>
          <p className="panel-description">A temporary password will be generated and must be changed at first sign-in.</p>
          <label htmlFor="new-user">Username</label>
          <input id="new-user" name="userName" required autoComplete="off" maxLength="100" autoFocus />
          <label htmlFor="new-user-role">Role</label>
          <select id="new-user-role" name="role" value={newRole} onChange={(event) => setNewRole(event.target.value)}>{roles.map((role) => <option key={role}>{role}</option>)}</select>
          {newRole === "Staff" && <>
            <p className="field-hint">Staff can work only with the selected Services.</p>
            <AdminCheckboxList id="new-user-services" name="serviceIds" label="Assigned Services" options={services.filter((service) => service.active && departments.some((department) => department.id === service.departmentId && department.active)).map((service) => ({ value: service.id, label: `${departments.find((item) => item.id === service.departmentId)?.name} · ${service.name}` }))} emptyMessage="Add an active Service before provisioning a Staff account." />
          </>}
          {error && <p className="action-message" role="alert">{error}</p>}
          <div className="admin-form-actions"><button className="button button-dark" type="submit" disabled={submitting}>{submitting ? "Creating account…" : "Provision user"}</button><button className="button button-quiet" type="button" onClick={() => { setShowCreate(false); setNewRole("Reception"); }} disabled={submitting}>Cancel</button></div>
        </form>
      </AdminDialog>}
      {editingId && <AdminDialog title="Edit user access" onClose={() => setEditingId("")} busy={submitting}>
        {users.filter((item) => item.id === editingId).map((user) => {
          const assignedServiceIds = user.serviceIds ?? [];
          const editableServices = services.filter((service) => service.active || assignedServiceIds.includes(service.id));
          return <form key={user.id} onSubmit={(event) => updateUser(event, user)}>
            <p className="panel-description">Queue access is limited to the selected Services. Historical items without a Service remain scoped to the existing Department assignment.</p>
            <label htmlFor={`role-${user.id}`}>Role</label>
            <select id={`role-${user.id}`} name="role" value={editingRole} onChange={(event) => setEditingRole(event.target.value)}>{roles.map((role) => <option key={role}>{role}</option>)}</select>
            {editingRole === "Staff" && <AdminCheckboxList id={`services-${user.id}`} name="serviceIds" label="Assigned Services" options={editableServices.map((service) => ({ value: service.id, label: `${departments.find((item) => item.id === service.departmentId)?.name ?? "Department"} · ${service.name}${service.active ? "" : " (inactive)"}` }))} defaultValue={assignedServiceIds.filter((id) => editableServices.some((service) => service.id === id))} emptyMessage="No Services are available." />}
            {error && <p className="action-message" role="alert">{error}</p>}
            <div className="admin-form-actions"><button className="button button-dark" type="submit" disabled={submitting}>{submitting ? "Saving access…" : "Save user access"}</button><button className="button button-quiet" type="button" onClick={() => setEditingId("")} disabled={submitting}>Cancel</button></div>
          </form>;
        })}
      </AdminDialog>}
      {users.length > 0 && <AdminListControls items={users} searchLabel="users" searchPlaceholder="Username, role, department, or service" alwaysShowSearch getSearchText={(user) => {
        const departmentNames = (user.departmentIds ?? []).map((id) => departments.find((item) => item.id === id)?.name ?? "");
        const serviceNames = (user.serviceIds ?? []).map((id) => {
          const service = services.find((item) => item.id === id);
          const department = service && departments.find((item) => item.id === service.departmentId);
          return service ? `${department?.name ?? "Department"} ${service.name}` : "";
        }).join(" ");
        return `${user.userName} ${user.role} ${departmentNames.join(" ")} ${serviceNames}`;
      }} getStatus={(item) => item.active ? "active" : "inactive"}>
        {(filteredUsers) => <div className="admin-record-list">{filteredUsers.map((user) => {
          const assignments = (user.serviceIds ?? []).map((id) => {
            const service = services.find((item) => item.id === id);
            const department = service && departments.find((item) => item.id === service.departmentId);
            return service ? `${department?.name ?? "Department"} · ${service.name}` : null;
          }).filter(Boolean);
          const assignmentSummary = assignments.join(", ") || ((user.departmentIds ?? []).length ? "Legacy department queues only" : "No Service assigned");
          return <article className="admin-record" key={user.id}>
            <div className="admin-record-summary"><strong>{user.userName}</strong><AdminStatusBadge status={user.active ? "active" : "inactive"} /></div>
            <div className="admin-record-details"><span>{user.role}</span>{user.role === "Staff" && <span>Services: {assignmentSummary}</span>}</div>
            <AdminActions>
              <button className="text-button" type="button" onClick={() => { setEditingRole(user.role); setEditingId(user.id); }}>Edit access</button>
              <button className="text-button" type="button" disabled={submitting} onClick={() => {
                const active = !user.active;
                return act(() => usersApi.update(user.id, { active }), `${user.userName} ${active ? "reactivated" : "deactivated"}.`);
              }}>{user.active ? "Deactivate" : "Reactivate"}</button>
              <button className="text-button danger-button" type="button" onClick={() => { setDeleteError(""); setDeleteTarget(user); }}>Delete user</button>
            </AdminActions>
          </article>;
        })}</div>}
      </AdminListControls>}
      {deleteTarget && <div className="confirmation-backdrop"><section className="confirmation-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-user-heading" aria-describedby="delete-user-description" onKeyDown={(event) => { if (event.key === "Escape" && !deleting) setDeleteTarget(null); }}><h3 id="delete-user-heading">Delete {deleteTarget.userName}?</h3><p id="delete-user-description">This permanently removes this account and its access assignments. The user will no longer be able to sign in.</p>{deleteError && <p className="confirmation-error" role="alert">{deleteError}</p>}<div className="admin-form-actions"><button className="button button-dark danger-confirm" type="button" disabled={deleting} onClick={deleteUser}>{deleting ? "Deleting…" : "Delete user"}</button><button className="button button-quiet" type="button" autoFocus disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancel</button></div></section></div>}
    </section>
  );
}
