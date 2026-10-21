import { useCallback, useEffect, useState } from "react";
import { departmentApi, displaysApi, servicesApi, stationsApi, usersApi } from "../../api/client.js";

const roles = ["Reception", "Staff", "Admin"];

export default function AdminPage() {
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [displays, setDisplays] = useState([]);
  const [services, setServices] = useState([]);
  const [stations, setStations] = useState([]);
  const [newStationDepartmentId, setNewStationDepartmentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [credential, setCredential] = useState("");
  const [pairingCode, setPairingCode] = useState("");

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    try {
      const [departmentRows, userRows, displayRows, serviceRows, stationRows] = await Promise.all([
        departmentApi.adminList(signal), usersApi.list(signal), displaysApi.list(signal),
        servicesApi.list(signal), stationsApi.list(signal),
      ]);
      setDepartments(departmentRows);
      setUsers(userRows);
      setDisplays(displayRows);
      setServices(serviceRows);
      setStations(stationRows);
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

  async function createService(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = await act(() => servicesApi.create({
      name: data.get("name").trim(),
      departmentId: data.get("departmentId"),
    }), "Service added.");
    if (result) form.reset();
  }

  async function updateService(event, service) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    await act(() => servicesApi.update(service.id, {
      name: data.get("name").trim(),
      active: data.get("active") === "on",
    }), `Updated ${service.name}.`);
  }

  async function createStation(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const serviceIds = [...form.elements.serviceIds.selectedOptions].map((option) => option.value);
    const staffUserIds = [...form.elements.staffUserIds.selectedOptions].map((option) => option.value);
    const result = await act(() => stationsApi.create({
      name: data.get("name").trim(),
      departmentId: data.get("departmentId"),
      serviceIds,
      staffUserIds,
    }), "Station added.");
    if (result) {
      form.reset();
      setNewStationDepartmentId("");
    }
  }

  async function updateStation(event, station) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const serviceIds = [...form.elements.serviceIds.selectedOptions].map((option) => option.value);
    const staffUserIds = [...form.elements.staffUserIds.selectedOptions].map((option) => option.value);
    await act(() => stationsApi.update(station.id, {
      name: data.get("name").trim(),
      active: data.get("active") === "on",
      serviceIds,
      staffUserIds,
    }), `Updated ${station.name}.`);
  }

  const staffForDepartment = (departmentId) => users.filter((user) =>
    user.role === "Staff" && user.active && user.departmentIds?.includes(departmentId));

  async function issuePairingCode(display) {
    const result = await act(() => displaysApi.pairingCode(display.id), `Pairing code created for ${display.name}.`);
    setPairingCode(result?.code ?? "");
  }

  return (
    <section aria-labelledby="admin-heading">
      <div className="page-heading"><div><p className="eyebrow">ADMINISTRATION</p><h1 id="admin-heading">Clinic configuration</h1><p>Manage departments, services, stations, staff access, and assigned displays.</p></div><span className="surface-tag">API managed</span></div>
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

        <section className="content-panel" aria-labelledby="services-heading">
          <div className="section-heading"><div><p className="eyebrow">CLINIC OFFERINGS</p><h2 id="services-heading">Services</h2></div><span className="count-label">{services.length} configured</span></div>
          {services.length === 0 && !loading && <p className="panel-description">No services are configured.</p>}
          <div className="admin-record-list">{services.map((service) => (
            <form className="admin-record" key={service.id} onSubmit={(event) => updateService(event, service)}>
              <strong>{service.name}</strong>
              <span>{departments.find((item) => item.id === service.departmentId)?.name ?? "Department unavailable"}</span>
              <label htmlFor={`service-name-${service.id}`}>Service name</label>
              <input id={`service-name-${service.id}`} name="name" defaultValue={service.name} required maxLength="100" />
              <label className="checkbox-row"><input type="checkbox" name="active" defaultChecked={service.active} /> Active</label>
              <button className="button button-dark" type="submit">Save service</button>
            </form>
          ))}</div>
          <form className="admin-inline-form" onSubmit={createService}>
            <h3>Add service</h3>
            <label htmlFor="new-service-name">Service name</label>
            <input id="new-service-name" name="name" required minLength="2" maxLength="100" />
            <label htmlFor="new-service-department">Service department</label>
            <select id="new-service-department" name="departmentId" required defaultValue="">
              <option value="" disabled>Select a department</option>
              {departments.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <button className="button button-dark" type="submit">Add service</button>
          </form>
        </section>

        <section className="content-panel" aria-labelledby="stations-heading">
          <div className="section-heading"><div><p className="eyebrow">STAFF WORK AREAS</p><h2 id="stations-heading">Stations</h2></div><span className="count-label">{stations.length} configured</span></div>
          {stations.length === 0 && !loading && <p className="panel-description">No stations are configured.</p>}
          <div className="admin-record-list">{stations.map((station) => {
            const departmentName = departments.find((item) => item.id === station.departmentId)?.name ?? "Department unavailable";
            const eligibleStaff = staffForDepartment(station.departmentId);
            return (
              <form className="admin-record" key={station.id} onSubmit={(event) => updateStation(event, station)}>
                <strong>{station.name}</strong>
                <span>{departmentName}</span>
                <label htmlFor={`station-name-${station.id}`}>Station name</label>
                <input id={`station-name-${station.id}`} name="name" defaultValue={station.name} required maxLength="100" />
                <label htmlFor={`station-services-${station.id}`}>Services handled</label>
                <select id={`station-services-${station.id}`} name="serviceIds" multiple size={Math.min(Math.max(services.filter((item) => item.departmentId === station.departmentId).length, 2), 5)} defaultValue={station.serviceIds}>
                  {services.filter((item) => item.departmentId === station.departmentId).map((service) => <option key={service.id} value={service.id}>{service.name}{service.active ? "" : " (inactive)"}</option>)}
                </select>
                <label htmlFor={`station-staff-${station.id}`}>Assigned staff</label>
                <select id={`station-staff-${station.id}`} name="staffUserIds" multiple size={Math.min(Math.max(eligibleStaff.length, 2), 5)} defaultValue={station.staffUserIds}>
                  {eligibleStaff.map((user) => <option key={user.id} value={user.id}>{user.userName}{user.active ? "" : " (inactive)"}</option>)}
                </select>
                <label className="checkbox-row"><input type="checkbox" name="active" defaultChecked={station.active} /> Active</label>
                <button className="button button-dark" type="submit">Save station</button>
              </form>
            );
          })}</div>
          <form className="admin-inline-form" onSubmit={createStation}>
            <h3>Add station</h3>
            <label htmlFor="new-station-name">Station name</label>
            <input id="new-station-name" name="name" required minLength="2" maxLength="100" />
            <label htmlFor="new-station-department">Station department</label>
            <select id="new-station-department" name="departmentId" required value={newStationDepartmentId} onChange={(event) => setNewStationDepartmentId(event.target.value)}>
              <option value="" disabled>Select a department</option>
              {departments.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <label htmlFor="new-station-services">Services handled</label>
            <select id="new-station-services" name="serviceIds" multiple size={Math.min(Math.max(services.filter((item) => item.departmentId === newStationDepartmentId && item.active).length, 2), 5)} disabled={!newStationDepartmentId}>
              {services.filter((item) => item.departmentId === newStationDepartmentId && item.active).map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
            </select>
            <label htmlFor="new-station-staff">Assigned staff</label>
            <select id="new-station-staff" name="staffUserIds" multiple size={Math.min(Math.max(staffForDepartment(newStationDepartmentId).length, 2), 5)} disabled={!newStationDepartmentId}>
              {staffForDepartment(newStationDepartmentId).map((user) => <option key={user.id} value={user.id}>{user.userName}</option>)}
            </select>
            <button className="button button-dark" type="submit" disabled={!newStationDepartmentId}>Add station</button>
          </form>
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
