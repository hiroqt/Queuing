import { useEffect, useRef, useState } from "react";
import { kioskApi } from "../../api/client.js";
import "./kiosk.css";

const progress = ["Department", "Service", "Confirm"];

export default function KioskPage() {
  const [departments, setDepartments] = useState([]);
  const [department, setDepartment] = useState(null);
  const [service, setService] = useState(null);
  const [stage, setStage] = useState("department");
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [issueError, setIssueError] = useState("");
  const issueKey = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve().then(async () => {
      try {
        setDepartments(await kioskApi.choices(controller.signal));
      } catch (cause) {
        if (cause.name === "AbortError") return;
        if (cause.status === 401 || cause.status === 403) window.location.replace("/kiosk/pair");
        else setError(cause.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    });
    return () => controller.abort();
  }, []);

  function chooseDepartment(nextDepartment) {
    setDepartment(nextDepartment);
    setIssueError("");
    issueKey.current = null;
    if (nextDepartment.services.length === 1) {
      setService(nextDepartment.services[0]);
      setStage("confirm");
    } else {
      setService(null);
      setStage("service");
    }
  }

  function chooseService(nextService) {
    setService(nextService);
    setIssueError("");
    issueKey.current = null;
    setStage("confirm");
  }

  function back() {
    setIssueError("");
    issueKey.current = null;
    if (stage === "confirm" && department?.services.length > 1) {
      setService(null);
      setStage("service");
    } else {
      setDepartment(null);
      setService(null);
      setStage("department");
    }
  }

  async function issueVisit() {
    setPending(true);
    setIssueError("");
    issueKey.current ??= crypto.randomUUID();
    try {
      const result = await kioskApi.issue({ initialServiceId: service.id }, issueKey.current);
      setReceipt(result);
      issueKey.current = null;
      setStage("receipt");
    } catch (cause) {
      if (cause.status === 401 || cause.status === 403) window.location.replace("/kiosk/pair");
      else if (cause.status === 400) {
        issueKey.current = null;
        setDepartment(null);
        setService(null);
        setStage("department");
        setLoading(true);
        setDepartments([]);
        try {
          setDepartments(await kioskApi.choices());
          setIssueError("The clinic’s choices changed. Please select your destination again.");
        } catch (refreshCause) {
          if (refreshCause.status === 401 || refreshCause.status === 403) window.location.replace("/kiosk/pair");
          else setError(refreshCause.message);
        } finally {
          setLoading(false);
        }
      }
      else setIssueError(cause.message);
    } finally {
      setPending(false);
    }
  }

  function startOver() {
    setDepartment(null);
    setService(null);
    setReceipt(null);
    setIssueError("");
    issueKey.current = null;
    setStage("department");
  }

  const activeStep = stage === "department" ? 0 : stage === "service" ? 1 : 2;

  return (
    <main className="kiosk-shell">
      <header className="kiosk-header">
        <a className="kiosk-wordmark" href="/kiosk" aria-label="Clinic queue kiosk home"><span className="kiosk-wordmark-mark" aria-hidden="true">Q</span><span>CLINIC QUEUE</span></a>
        <p>SELF-SERVICE TICKET</p>
      </header>
      <section className="kiosk-main" aria-labelledby="kiosk-title">
        <div className="kiosk-intro">
          <p className="kiosk-kicker">WELCOME</p>
          <h1 id="kiosk-title">Take a number</h1>
          <p>Choose where you are going. Your number will be called when it is your turn.</p>
        </div>

        {stage !== "receipt" && <nav className="kiosk-progress" aria-label="Ticket steps">
          {progress.map((label, index) => (
            <div className={`kiosk-progress-step${index <= activeStep ? " is-active" : ""}`} aria-current={index === activeStep ? "step" : undefined} key={label}>
              <span>{String(index + 1).padStart(2, "0")}</span><strong>{label}</strong>
            </div>
          ))}
        </nav>}

        {loading && <div className="kiosk-panel kiosk-state" role="status"><span className="kiosk-loader" aria-hidden="true" />Loading clinic services…</div>}
        {!loading && error && <div className="kiosk-panel kiosk-state kiosk-error" role="alert"><strong>We couldn’t load the choices.</strong><span>{error}</span><button className="kiosk-button kiosk-button-primary" type="button" onClick={() => window.location.reload()}>Try again</button></div>}
        {!loading && !error && departments.length === 0 && <div className="kiosk-panel kiosk-state"><strong>No services are available right now.</strong><span>Please ask the reception team for help.</span>{issueError && <span role="status">{issueError}</span>}</div>}

        {!loading && !error && departments.length > 0 && stage === "department" && <section className="kiosk-panel" aria-labelledby="department-heading">
          <div className="kiosk-panel-heading"><span className="kiosk-step-number">01</span><div><h2 id="department-heading">Choose a department</h2><p>Tap the place you need to visit.</p></div></div>
          {issueError && <p className="kiosk-inline-error" role="status">{issueError}</p>}
          <div className="kiosk-choice-grid">
            {departments.map((item) => <button className="kiosk-choice" type="button" key={item.id} onClick={() => chooseDepartment(item)}><span>{item.name}</span><span className="kiosk-choice-arrow" aria-hidden="true">→</span></button>)}
          </div>
        </section>}

        {!loading && !error && stage === "service" && department && <section className="kiosk-panel" aria-labelledby="service-heading">
          <div className="kiosk-panel-heading"><span className="kiosk-step-number">02</span><div><p className="kiosk-context-label">{department.name}</p><h2 id="service-heading">Choose a service</h2><p>Select the service you need today.</p></div></div>
          <div className="kiosk-choice-grid">
            {department.services.map((item) => <button className="kiosk-choice" type="button" key={item.id} onClick={() => chooseService(item)}><span>{item.name}</span><span className="kiosk-choice-arrow" aria-hidden="true">→</span></button>)}
          </div>
          <div className="kiosk-actions"><button className="kiosk-button kiosk-button-secondary" type="button" onClick={back}>Back</button></div>
        </section>}

        {!loading && !error && stage === "confirm" && department && service && <section className="kiosk-panel" aria-labelledby="confirm-heading">
          <div className="kiosk-panel-heading"><span className="kiosk-step-number">03</span><div><p className="kiosk-context-label">Almost ready</p><h2 id="confirm-heading">Confirm your visit</h2><p>Check your destination before taking a number.</p></div></div>
          <dl className="kiosk-confirmation"><div><dt>Department</dt><dd>{department.name}</dd></div><div><dt>Service</dt><dd>{service.name}</dd></div><div><dt>Visit type</dt><dd>Walk-in</dd></div></dl>
          {issueError && <p className="kiosk-inline-error" role="alert">{issueError} You can retry safely.</p>}
          <div className="kiosk-actions kiosk-actions-spread"><button className="kiosk-button kiosk-button-secondary" type="button" onClick={back} disabled={pending}>Back</button><button className="kiosk-button kiosk-button-primary" type="button" onClick={issueVisit} disabled={pending}>{pending ? "Issuing your number…" : "Get my number"}</button></div>
        </section>}

        {!loading && !error && stage === "receipt" && receipt && <section className="kiosk-panel kiosk-result" aria-labelledby="receipt-heading" aria-live="polite">
          <p className="kiosk-kicker">YOUR VISIT NUMBER</p>
          <h2 id="receipt-heading" className="kiosk-ticket-number">{receipt.visitCode}</h2>
          <div className="kiosk-perforation" aria-hidden="true" />
          <p className="kiosk-ticket-label">Please keep this number and listen for it to be called.</p>
          <dl className="kiosk-confirmation kiosk-ticket-details"><div><dt>Department</dt><dd>{receipt.departmentName}</dd></div><div><dt>Service</dt><dd>{receipt.serviceName}</dd></div><div><dt>Date</dt><dd>{receipt.clinicDate}</dd></div></dl>
          <div className="kiosk-actions kiosk-actions-spread no-print"><button className="kiosk-button kiosk-button-secondary" type="button" onClick={() => window.print()}>Print ticket</button><button className="kiosk-button kiosk-button-primary" type="button" onClick={startOver}>Start over</button></div>
        </section>}
      </section>
      <footer className="kiosk-footer"><span>Need help? Please ask the reception team.</span><span>Anonymous visit · No personal details collected</span></footer>
    </main>
  );
}
