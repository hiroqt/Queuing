import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { departmentApi, servicesApi, stationsApi, usersApi } from "../../../api/client.js";
import AdminActions from "../components/AdminActions.jsx";
import AdminCheckboxList from "../components/AdminCheckboxList.jsx";
import AdminDialog from "../components/AdminDialog.jsx";
import AdminFeedback from "../components/AdminFeedback.jsx";
import AdminListControls from "../components/AdminListControls.jsx";
import AdminSectionHeader from "../components/AdminSectionHeader.jsx";
import AdminStatusBadge from "../components/AdminStatusBadge.jsx";

export default function StationsSection() {
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [services, setServices] = useState([]);
  const [stations, setStations] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newDepartmentId, setNewDepartmentId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [submitting, setSubmitting] = useState(false);
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

  const staffForDepartment = (departmentId) => users.filter((user) =>
    user.role === "Staff" && user.active && user.departmentIds?.includes(departmentId));

  async function createStation(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const serviceIds = data.getAll("serviceIds");
    const staffUserIds = data.getAll("staffUserIds");
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
    const serviceIds = data.getAll("serviceIds");
    const staffUserIds = data.getAll("staffUserIds");
    const result = await act(() => stationsApi.update(station.id, {
      name: data.get("name").trim(),
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
        action={<button className="button button-dark" type="button" onClick={() => setShowCreate(true)} disabled={loading || departments.filter((item) => item.active).length === 0}>Add station</button>}
      />
      <AdminFeedback error={showCreate || editingId ? "" : error} message={message} />
      {loading && <p role="status" className="panel-description">Loading stations…</p>}
      {!loading && departments.filter((item) => item.active).length === 0 && <p className="panel-description">Add an active department before creating stations. <Link to="/admin/departments">Go to Departments</Link></p>}
      {!loading && departments.some((item) => item.active) && services.filter((item) => item.active).length === 0 && <p className="panel-description">Add services before assigning them to stations. <Link to="/admin/services">Go to Services</Link></p>}
      {showCreate && <AdminDialog title="Add station" onClose={() => { setShowCreate(false); setNewDepartmentId(""); }} busy={submitting}>
        <form className="admin-assignment-form" onSubmit={createStation}>
          <label htmlFor="new-station-name">Station name</label>
          <input id="new-station-name" name="name" required minLength="2" maxLength="100" autoFocus />
          <label htmlFor="new-station-department">Department</label>
          <select id="new-station-department" name="departmentId" required value={newDepartmentId} onChange={(event) => setNewDepartmentId(event.target.value)}>
            <option value="" disabled>Select a department</option>
            {departments.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          {newDepartmentId && <>
            <AdminCheckboxList key={`new-services-${newDepartmentId}`} id="new-station-services" name="serviceIds" label="Services handled" options={servicesForDepartment(newDepartmentId, true).map((service) => ({ value: service.id, label: service.name }))} emptyMessage="No active Services in this Department." />
            <AdminCheckboxList key={`new-staff-${newDepartmentId}`} id="new-station-staff" name="staffUserIds" label="Assigned staff" options={staffForDepartment(newDepartmentId).map((user) => ({ value: user.id, label: user.userName }))} emptyMessage="No active Staff assigned to this Department." />
          </>}
          {error && <p className="action-message" role="alert">{error}</p>}
          <div className="admin-form-actions"><button className="button button-dark" type="submit" disabled={!newDepartmentId || submitting}>{submitting ? "Saving station…" : "Save station"}</button><button className="button button-quiet" type="button" onClick={() => { setShowCreate(false); setNewDepartmentId(""); }} disabled={submitting}>Cancel</button></div>
        </form>
      </AdminDialog>}
      {!loading && stations.length === 0 && departments.some((item) => item.active) && <p className="panel-description">No stations are configured yet. Add a station to connect department services with staff.</p>}
      {editingId && <AdminDialog title="Edit station" onClose={() => setEditingId("")} busy={submitting}>
        {stations.filter((item) => item.id === editingId).map((station) => <form className="admin-assignment-form" key={station.id} onSubmit={(event) => updateStation(event, station)}>
          <label htmlFor={`station-name-${station.id}`}>Station name</label>
          <input id={`station-name-${station.id}`} name="name" defaultValue={station.name} required minLength="2" maxLength="100" autoFocus />
          <p className="field-hint">Department: {departments.find((item) => item.id === station.departmentId)?.name ?? "Department unavailable"}</p>
          <AdminCheckboxList id={`station-services-${station.id}`} name="serviceIds" label="Services handled" options={servicesForDepartment(station.departmentId).map((service) => ({ value: service.id, label: `${service.name}${service.active ? "" : " (inactive)"}` }))} defaultValue={station.serviceIds} emptyMessage="No Services in this Department." />
          <AdminCheckboxList id={`station-staff-${station.id}`} name="staffUserIds" label="Assigned staff" options={staffForDepartment(station.departmentId).map((user) => ({ value: user.id, label: user.userName }))} defaultValue={station.staffUserIds.filter((id) => staffForDepartment(station.departmentId).some((user) => user.id === id))} emptyMessage="No active Staff assigned to this Department." />
          {error && <p className="action-message" role="alert">{error}</p>}
          <div className="admin-form-actions"><button className="button button-dark" type="submit" disabled={submitting}>{submitting ? "Saving station…" : "Save station"}</button><button className="button button-quiet" type="button" onClick={() => setEditingId("")} disabled={submitting}>Cancel</button></div>
        </form>)}
      </AdminDialog>}
      {stations.length > 0 && <AdminListControls items={stations} searchLabel="stations" searchPlaceholder="Station, department, service, or staff" alwaysShowSearch getSearchText={(station) => {
        const departmentName = departments.find((item) => item.id === station.departmentId)?.name ?? "";
        const serviceNames = servicesForDepartment(station.departmentId).filter((item) => station.serviceIds.includes(item.id)).map((item) => item.name).join(" ");
        const staffNames = station.staffUserIds.map((id) => users.find((user) => user.id === id)?.userName).filter(Boolean).join(" ");
        return `${station.name} ${departmentName} ${serviceNames} ${staffNames}`;
      }} getStatus={(item) => item.active ? "active" : "inactive"}>
        {(filteredStations) => <div className="admin-group-list">{departments.map((department) => {
          const departmentStations = filteredStations.filter((station) => station.departmentId === department.id);
          return departmentStations.length > 0 && <section className="admin-record-group" key={department.id} aria-label={department.name}>
            <h3>{department.name}</h3>
            <div className="admin-record-list">{departmentStations.map((station) => {
              const serviceNames = servicesForDepartment(station.departmentId).filter((item) => station.serviceIds.includes(item.id)).map((item) => item.name).join(", ");
              const staffNames = station.staffUserIds.map((id) => users.find((user) => user.id === id)?.userName).filter(Boolean).join(", ");
              return <article className="admin-record" key={station.id}>
                <div className="admin-record-summary"><strong>{station.name}</strong><AdminStatusBadge status={station.active ? "active" : "inactive"} /></div>
                <div className="admin-record-details"><span>Services: {serviceNames || "None assigned"}</span><span>Staff: {staffNames || "None assigned"}</span></div>
                <AdminActions>
                  <button className="text-button" type="button" onClick={() => setEditingId(station.id)}>Edit station</button>
                  <button className="text-button" type="button" disabled={submitting} onClick={() => {
                    const active = !station.active;
                    return act(() => stationsApi.update(station.id, { active }), `${station.name} ${active ? "reactivated" : "deactivated"}.`);
                  }}>{station.active ? "Deactivate" : "Reactivate"}</button>
                </AdminActions>
              </article>;
            })}</div>
          </section>;
        })}</div>}
      </AdminListControls>}
    </section>
  );
}
