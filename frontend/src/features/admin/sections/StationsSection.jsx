import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { departmentApi, servicesApi, stationsApi, usersApi } from "../../../api/client.js";
import AdminFeedback from "../components/AdminFeedback.jsx";
import AdminSectionHeader from "../components/AdminSectionHeader.jsx";

export default function StationsSection() {
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [services, setServices] = useState([]);
  const [stations, setStations] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newDepartmentId, setNewDepartmentId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    try {
      const [departmentRows, userRows, serviceRows, stationRows] = await Promise.all([
        departmentApi.adminList(signal), usersApi.list(signal), servicesApi.list(signal), stationsApi.list(signal),
      ]);
      setDepartments(departmentRows);
      setUsers(userRows);
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

  const staffForDepartment = (departmentId) => users.filter((user) =>
    user.role === "Staff" && user.active && user.departmentIds?.includes(departmentId));

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
      setNewDepartmentId("");
      setShowCreate(false);
    }
  }

  async function updateStation(event, station) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const serviceIds = [...form.elements.serviceIds.selectedOptions].map((option) => option.value);
    const staffUserIds = [...form.elements.staffUserIds.selectedOptions].map((option) => option.value);
    const result = await act(() => stationsApi.update(station.id, {
      name: data.get("name").trim(),
      active: data.get("active") === "on",
      serviceIds,
      staffUserIds,
    }), `Updated ${station.name}.`);
    if (result) setEditingId("");
  }

  const servicesForDepartment = (departmentId, activeOnly = false) => services.filter((service) =>
    service.departmentId === departmentId && (!activeOnly || service.active));

  return (
    <section className="content-panel admin-section" aria-labelledby="stations-heading">
      <AdminSectionHeader
        id="stations-heading"
        eyebrow="STAFF WORK AREAS"
        title="Stations"
        countLabel={`${stations.length} configured`}
        action={<button className="button button-dark" type="button" onClick={() => setShowCreate((value) => !value)} disabled={departments.filter((item) => item.active).length === 0}>{showCreate ? "Cancel" : "Add station"}</button>}
      />
      <AdminFeedback error={error} message={message} />
      {loading && <p role="status" className="panel-description">Loading stations…</p>}
      {!loading && departments.filter((item) => item.active).length === 0 && <p className="panel-description">Add an active department before creating stations. <Link to="/admin/departments">Go to Departments</Link></p>}
      {!loading && departments.some((item) => item.active) && services.filter((item) => item.active).length === 0 && <p className="panel-description">Add services before assigning them to stations. <Link to="/admin/services">Go to Services</Link></p>}
      {showCreate && <form className="admin-inline-form" onSubmit={createStation}>
        <h3>Add station</h3>
        <label htmlFor="new-station-name">Station name</label>
        <input id="new-station-name" name="name" required minLength="2" maxLength="100" />
        <label htmlFor="new-station-department">Station department</label>
        <select id="new-station-department" name="departmentId" required value={newDepartmentId} onChange={(event) => setNewDepartmentId(event.target.value)}>
          <option value="" disabled>Select a department</option>
          {departments.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <label htmlFor="new-station-services">Services handled</label>
        <select id="new-station-services" name="serviceIds" multiple size={Math.min(Math.max(servicesForDepartment(newDepartmentId, true).length, 2), 5)} disabled={!newDepartmentId}>
          {servicesForDepartment(newDepartmentId, true).map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
        </select>
        <label htmlFor="new-station-staff">Assigned staff</label>
        <select id="new-station-staff" name="staffUserIds" multiple size={Math.min(Math.max(staffForDepartment(newDepartmentId).length, 2), 5)} disabled={!newDepartmentId}>
          {staffForDepartment(newDepartmentId).map((user) => <option key={user.id} value={user.id}>{user.userName}</option>)}
        </select>
        <button className="button button-dark" type="submit" disabled={!newDepartmentId}>Save station</button>
      </form>}
      {!loading && stations.length === 0 && departments.some((item) => item.active) && <p className="panel-description">No stations are configured yet. Add a station to connect department services with staff.</p>}
      <div className="admin-record-list">{stations.map((station) => {
        const departmentName = departments.find((item) => item.id === station.departmentId)?.name ?? "Department unavailable";
        const eligibleStaff = staffForDepartment(station.departmentId);
        return (
          <article className="admin-record" key={station.id}>
            <div className="admin-record-summary">
              <strong>{station.name}</strong>
              <span>{departmentName} · {servicesForDepartment(station.departmentId).filter((item) => station.serviceIds.includes(item.id)).map((item) => item.name).join(", ") || "No services assigned"}</span>
              <span className="enabled-label">{station.active ? "Active" : "Inactive"}</span>
            </div>
            {editingId === station.id ? <form onSubmit={(event) => updateStation(event, station)}>
              <label htmlFor={`station-name-${station.id}`}>Station name</label>
              <input id={`station-name-${station.id}`} name="name" defaultValue={station.name} required minLength="2" maxLength="100" />
              <label htmlFor={`station-services-${station.id}`}>Services handled</label>
              <select id={`station-services-${station.id}`} name="serviceIds" multiple size={Math.min(Math.max(servicesForDepartment(station.departmentId).length, 2), 5)} defaultValue={station.serviceIds}>
                {servicesForDepartment(station.departmentId).map((service) => <option key={service.id} value={service.id}>{service.name}{service.active ? "" : " (inactive)"}</option>)}
              </select>
              <label htmlFor={`station-staff-${station.id}`}>Assigned staff</label>
              <select id={`station-staff-${station.id}`} name="staffUserIds" multiple size={Math.min(Math.max(eligibleStaff.length, 2), 5)} defaultValue={station.staffUserIds}>
                {eligibleStaff.map((user) => <option key={user.id} value={user.id}>{user.userName}{user.active ? "" : " (inactive)"}</option>)}
              </select>
              <label className="checkbox-row"><input type="checkbox" name="active" defaultChecked={station.active} /> Active</label>
              <div className="admin-form-actions"><button className="button button-dark" type="submit">Save station</button><button className="text-button" type="button" onClick={() => setEditingId("")}>Cancel</button></div>
            </form> : <>
              <span>{station.staffUserIds.map((id) => users.find((user) => user.id === id)?.userName).filter(Boolean).join(", ") || "No staff assigned"}</span>
              <button className="text-button" type="button" onClick={() => setEditingId(station.id)}>Edit station</button>
            </>}
          </article>
        );
      })}</div>
    </section>
  );
}
