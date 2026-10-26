import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { departmentApi, servicesApi } from "../../../api/client.js";
import AdminActions from "../components/AdminActions.jsx";
import AdminDialog from "../components/AdminDialog.jsx";
import AdminFeedback from "../components/AdminFeedback.jsx";
import AdminListControls from "../components/AdminListControls.jsx";
import AdminSectionHeader from "../components/AdminSectionHeader.jsx";
import AdminStatusBadge from "../components/AdminStatusBadge.jsx";

export default function ServicesSection() {
  const [departments, setDepartments] = useState([]);
  const [services, setServices] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    try {
      const [departmentRows, serviceRows] = await Promise.all([departmentApi.adminList(signal), servicesApi.list(signal)]);
      setDepartments(departmentRows);
      setServices(serviceRows);
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

  async function createService(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = await act(() => servicesApi.create({
      name: data.get("name").trim(),
      departmentId: data.get("departmentId"),
    }), "Service added.");
    if (result) {
      form.reset();
      setShowCreate(false);
    }
  }

  async function updateService(event, service) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const result = await act(() => servicesApi.update(service.id, {
      name: data.get("name").trim(),
    }), `Updated ${service.name}.`);
    if (result) setEditingId("");
  }

  return (
    <section className="content-panel admin-section" aria-labelledby="services-heading">
      <AdminSectionHeader
        id="services-heading"
        eyebrow="CLINIC OFFERINGS"
        title="Services"
        countLabel={`${services.length} configured`}
        action={<button className="button button-dark" type="button" onClick={() => setShowCreate(true)} disabled={loading || departments.filter((item) => item.active).length === 0}>Add service</button>}
      />
      <AdminFeedback error={showCreate || editingId ? "" : error} message={message} />
      {loading && <p role="status" className="panel-description">Loading services…</p>}
      {!loading && !error && departments.filter((item) => item.active).length === 0 && <p className="panel-description">Add an active department before creating services. <Link to="/admin/departments">Go to Departments</Link></p>}
      {!loading && departments.some((item) => item.active) && services.length === 0 && <p className="panel-description">No services are configured yet. Add a service and assign it to a department.</p>}
      {showCreate && <AdminDialog title="Add service" onClose={() => setShowCreate(false)} busy={submitting}>
        <form onSubmit={createService}>
          <label htmlFor="new-service-name">Service name</label>
          <input id="new-service-name" name="name" required minLength="2" maxLength="100" autoFocus />
          <label htmlFor="new-service-department">Department</label>
          <select id="new-service-department" name="departmentId" required defaultValue="">
            <option value="" disabled>Select a department</option>
            {departments.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          {error && <p className="action-message" role="alert">{error}</p>}
          <div className="admin-form-actions"><button className="button button-dark" type="submit" disabled={submitting}>{submitting ? "Saving service…" : "Save service"}</button><button className="button button-quiet" type="button" onClick={() => setShowCreate(false)} disabled={submitting}>Cancel</button></div>
        </form>
      </AdminDialog>}
      {editingId && <AdminDialog title="Edit service" onClose={() => setEditingId("")} busy={submitting}>
        {services.filter((item) => item.id === editingId).map((service) => <form key={service.id} onSubmit={(event) => updateService(event, service)}>
          <label htmlFor={`service-name-${service.id}`}>Service name</label>
          <input id={`service-name-${service.id}`} name="name" defaultValue={service.name} required minLength="2" maxLength="100" autoFocus />
          <p className="field-hint">Department: {departments.find((item) => item.id === service.departmentId)?.name ?? "Department unavailable"}</p>
          {error && <p className="action-message" role="alert">{error}</p>}
          <div className="admin-form-actions"><button className="button button-dark" type="submit" disabled={submitting}>{submitting ? "Saving service…" : "Save service"}</button><button className="button button-quiet" type="button" onClick={() => setEditingId("")} disabled={submitting}>Cancel</button></div>
        </form>)}
      </AdminDialog>}
      {services.length > 0 && <AdminListControls
        items={services}
        searchLabel="services"
        searchPlaceholder="Service or department name"
        alwaysShowSearch
        getSearchText={(item) => `${item.name} ${departments.find((department) => department.id === item.departmentId)?.name ?? ""}`}
        getStatus={(item) => item.active ? "active" : "inactive"}
      >
        {(filteredServices) => <div className="admin-group-list">{departments.map((department) => {
          const departmentServices = filteredServices.filter((service) => service.departmentId === department.id);
          return departmentServices.length > 0 && <section className="admin-record-group" key={department.id} aria-label={department.name}>
            <h3>{department.name}</h3>
            <div className="admin-record-list">{departmentServices.map((service) => <article className="admin-record" key={service.id}>
              <div className="admin-record-summary"><strong>{service.name}</strong><AdminStatusBadge status={service.active ? "active" : "inactive"} /></div>
              <AdminActions>
                <button className="text-button" type="button" onClick={() => setEditingId(service.id)}>Edit service</button>
                <button className="text-button" type="button" disabled={submitting} onClick={() => {
                  const active = !service.active;
                  return act(() => servicesApi.update(service.id, { active }), `${service.name} ${active ? "reactivated" : "deactivated"}.`);
                }}>{service.active ? "Deactivate" : "Reactivate"}</button>
              </AdminActions>
            </article>)}</div>
          </section>;
        })}</div>}
      </AdminListControls>}
    </section>
  );
}
