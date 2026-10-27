import { useEffect, useRef, useState } from "react";
import { kioskApi } from "../../api/client.js";
import "./kiosk.css";

const progressSteps = [
  { id: "department", label: "Department", step: "01" },
  { id: "service", label: "Service", step: "02" },
  { id: "confirm", label: "Confirm", step: "03" },
];

function DepartmentIcon() {
  return (
    <svg className="kiosk-card-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
    </svg>
  );
}

function ServiceIcon() {
  return (
    <svg className="kiosk-service-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M9 12h6M12 9v6" />
    </svg>
  );
}

export default function KioskPage() {
  const [departments, setDepartments] = useState([]);
  const [department, setDepartment] = useState(null);
  const [service, setService] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [stage, setStage] = useState("department");
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [issueError, setIssueError] = useState("");
  const [clockTime, setClockTime] = useState(new Date());
  const issueKey = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => setClockTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

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
    if (nextDepartment.services?.length === 1) {
      const singleService = nextDepartment.services[0];
      setService(singleService);
      setSelectedService(singleService);
      setStage("confirm");
    } else {
      setService(null);
      setSelectedService(null);
      setStage("service");
    }
  }

  function handleServiceSelect(item) {
    setSelectedService(item);
  }

  function confirmServiceSelection(nextService) {
    if (!nextService) return;
    setService(nextService);
    setSelectedService(nextService);
    setIssueError("");
    issueKey.current = null;
    setStage("confirm");
  }

  function back() {
    setIssueError("");
    issueKey.current = null;
    if (stage === "confirm") {
      if (department?.services?.length > 1) {
        setStage("service");
      } else {
        setDepartment(null);
        setService(null);
        setSelectedService(null);
        setStage("department");
      }
    } else if (stage === "service") {
      setDepartment(null);
      setService(null);
      setSelectedService(null);
      setStage("department");
    }
  }

  function generateKey() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
      (+c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))).toString(16)
    );
  }

  async function issueVisit() {
    setPending(true);
    setIssueError("");
    issueKey.current ??= generateKey();
    try {
      const activeServiceId = service?.id || selectedService?.id;
      const result = await kioskApi.issue({ initialServiceId: activeServiceId }, issueKey.current);
      setReceipt(result);
      issueKey.current = null;
      setStage("receipt");
    } catch (cause) {
      if (cause.status === 401 || cause.status === 403) {
        window.location.replace("/kiosk/pair");
      } else if (cause.status === 400 && cause.message === "Choose an active service.") {
        issueKey.current = null;
        setDepartment(null);
        setService(null);
        setSelectedService(null);
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
      } else {
        setIssueError(cause.message || "Failed to issue ticket. Please try again.");
      }
    } finally {
      setPending(false);
    }
  }

  function startOver() {
    setDepartment(null);
    setService(null);
    setSelectedService(null);
    setReceipt(null);
    setIssueError("");
    issueKey.current = null;
    setStage("department");
  }

  const activeIndex = stage === "department" ? 0 : stage === "service" ? 1 : 2;
  const formattedTime = clockTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const formattedDate = clockTime.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

  return (
    <main className="kiosk-shell">
      {/* Top Banner & Header */}
      <header className="kiosk-header">
        <div className="kiosk-brand-group">
          <a className="kiosk-wordmark" href="/kiosk" aria-label="Clinic queue kiosk home">
            <span className="kiosk-wordmark-badge" aria-hidden="true">Q</span>
            <div className="kiosk-brand-text">
              <span className="kiosk-brand-title">CLINIC QUEUE</span>
              <span className="kiosk-brand-subtitle">SELF-SERVICE KIOSK</span>
            </div>
          </a>
        </div>

        <div className="kiosk-header-status" aria-hidden="true">
          <span className="kiosk-status-pill">
            <span className="kiosk-status-dot" />
            <span>WALK-IN SERVICE</span>
          </span>
        </div>

        <div className="kiosk-header-info">
          <div className="kiosk-live-clock">
            <span className="kiosk-clock-time">{formattedTime}</span>
            <span className="kiosk-clock-date">{formattedDate}</span>
          </div>
        </div>
      </header>

      {/* Stepper Progress Bar */}
      {stage !== "receipt" && (
        <nav className="kiosk-stepper-wrap" aria-label="Ticket progress">
          <div className="kiosk-stepper">
            {progressSteps.map((stepItem, index) => {
              const isPassed = index < activeIndex;
              const isCurrent = index === activeIndex;
              return (
                <div
                  key={stepItem.id}
                  className={`kiosk-step-pill ${isPassed ? "is-complete" : ""} ${isCurrent ? "is-active" : ""}`}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  <span className="kiosk-step-number" aria-hidden="true">
                    {isPassed ? (
                      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m3 8 3.5 3.5L13 5" />
                      </svg>
                    ) : (
                      stepItem.step
                    )}
                  </span>
                  <span className="kiosk-step-label">{stepItem.label}</span>
                </div>
              );
            })}
          </div>
        </nav>
      )}

      {/* Main Content Stage */}
      <section className="kiosk-main" aria-labelledby="kiosk-stage-title">
        {/* Loading State */}
        {loading && (
          <div className="kiosk-panel kiosk-state-panel" role="status">
            <span className="kiosk-spinner" aria-hidden="true" />
            <h2 className="kiosk-state-title">Loading clinic services…</h2>
            <p className="kiosk-state-desc">Please wait while we prepare the department choices.</p>
          </div>
        )}

        {/* Global Error State */}
        {!loading && error && (
          <div className="kiosk-panel kiosk-state-panel kiosk-error-panel" role="alert">
            <div className="kiosk-error-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h2 className="kiosk-state-title">Unable to load clinic choices</h2>
            <p className="kiosk-state-desc">{error}</p>
            <button className="kiosk-btn kiosk-btn-primary kiosk-btn-large" type="button" onClick={() => window.location.reload()}>
              Try again
            </button>
          </div>
        )}

        {/* Empty Choices State */}
        {!loading && !error && departments.length === 0 && (
          <div className="kiosk-panel kiosk-state-panel">
            <div className="kiosk-info-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </div>
            <h2 className="kiosk-state-title">No services are available right now</h2>
            <p className="kiosk-state-desc">Please proceed directly to the Reception desk for assistance.</p>
            {issueError && <p className="kiosk-inline-banner" role="status">{issueError}</p>}
          </div>
        )}

        {/* STAGE 1: DEPARTMENT SELECTION */}
        {!loading && !error && departments.length > 0 && stage === "department" && (
          <div className="kiosk-stage-container">
            <div className="kiosk-stage-hero">
              <span className="kiosk-hero-tag">STEP 1 OF 3</span>
              <h1 id="kiosk-stage-title" className="kiosk-stage-heading">Where do you need to go today?</h1>
              <p className="kiosk-stage-subheading">Touch your destination department to view available medical services.</p>
            </div>

            {issueError && <p className="kiosk-inline-banner kiosk-inline-error" role="status">{issueError}</p>}

            <div className="kiosk-category-grid" role="group" aria-label="Department choices">
              {departments.map((dept) => {
                const serviceCount = dept.services?.length ?? 0;
                return (
                  <div className="kiosk-category-card" key={dept.id}>
                    <button
                      className="kiosk-card-main-action"
                      type="button"
                      onClick={() => chooseDepartment(dept)}
                      aria-label={`Select ${dept.name} department, ${serviceCount} service${serviceCount === 1 ? "" : "s"} available`}
                    >
                      <div className="kiosk-card-header">
                        <div className="kiosk-card-icon-wrap" aria-hidden="true">
                          <DepartmentIcon />
                        </div>
                      </div>

                      <div className="kiosk-card-body">
                        <span className="kiosk-card-title">{dept.name}</span>
                        <span className="kiosk-card-meta">
                          {serviceCount === 1
                            ? "1 service available"
                            : serviceCount === 0
                            ? "No services available"
                            : `${serviceCount} services available`}
                        </span>
                      </div>

                      <div className="kiosk-card-footer">
                        <div className="kiosk-card-action" aria-hidden="true">
                          <span>Select</span>
                          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m7 4 6 6-6 6" />
                          </svg>
                        </div>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STAGE 2: SERVICE SELECTION */}
        {!loading && !error && stage === "service" && department && (
          <div className="kiosk-stage-container">
            <div className="kiosk-context-header">
              <div className="kiosk-context-info">
                <span className="kiosk-context-eyebrow">SELECTED DEPARTMENT</span>
              </div>
              <div className="kiosk-context-name-wrap">
                <span className="kiosk-context-name">{department.name}</span>
              </div>
            </div>

            <div className="kiosk-stage-hero">
              <span className="kiosk-hero-tag">STEP 2 OF 3</span>
              <h1 id="kiosk-stage-title" className="kiosk-stage-heading">What service do you need?</h1>
              <p className="kiosk-stage-subheading">Choose a service below, then tap the Next button to review your visit.</p>
            </div>

            {department.services?.length === 0 ? (
              <div className="kiosk-panel kiosk-state-panel" role="status">
                <div className="kiosk-info-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </div>
                <h2 className="kiosk-state-title">No services available right now</h2>
                <p className="kiosk-state-desc">
                  There are currently no active services listed under {department.name}. Please choose another department or ask the reception team.
                </p>
              </div>
            ) : (
              <div className="kiosk-service-grid" role="group" aria-label={`Services in ${department.name}`}>
                {department.services.map((item) => {
                  const isSelected = selectedService?.id === item.id;
                  return (
                    <div className={`kiosk-service-card ${isSelected ? "is-selected" : ""}`} key={item.id}>
                      <button
                        className="kiosk-service-main-action"
                        type="button"
                        onClick={() => handleServiceSelect(item)}
                        aria-pressed={isSelected}
                        aria-label={`Select service ${item.name}`}
                      >
                        <div className="kiosk-service-icon-wrap" aria-hidden="true">
                          <ServiceIcon />
                        </div>
                        <div className="kiosk-service-info">
                          <span className="kiosk-service-name">{item.name}</span>
                        </div>
                        <div className="kiosk-card-action" aria-hidden="true">
                          <span>{isSelected ? "Selected ✓" : "Select"}</span>
                          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m7 4 6 6-6 6" />
                          </svg>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Responsive Dual Action Dock: Back + Next */}
            <div className="kiosk-footer-dock kiosk-footer-dock-spread">
              <button className="kiosk-btn kiosk-btn-secondary kiosk-btn-large" type="button" onClick={back}>
                ← Back to Departments
              </button>
              <button
                className="kiosk-btn kiosk-btn-primary kiosk-btn-large"
                type="button"
                onClick={() => confirmServiceSelection(selectedService)}
                disabled={!selectedService}
                aria-label="Proceed to visit confirmation"
              >
                <span>Next: Confirm Visit →</span>
              </button>
            </div>
          </div>
        )}

        {/* STAGE 3: CONFIRMATION */}
        {!loading && !error && stage === "confirm" && department && service && (
          <div className="kiosk-stage-container kiosk-confirm-container">
            <div className="kiosk-stage-hero">
              <span className="kiosk-hero-tag">STEP 3 OF 3</span>
              <h1 id="kiosk-stage-title" className="kiosk-stage-heading">Review your visit details</h1>
              <p className="kiosk-stage-subheading">Check your selections below. Tap the Next button to dispense your queue ticket.</p>
            </div>

            {issueError && (
              <p className="kiosk-inline-banner kiosk-inline-error" role="alert">
                {issueError} You can retry safely.
              </p>
            )}

            <div className="kiosk-confirm-card">
              <div className="kiosk-confirm-header">
                <span className="kiosk-confirm-pill">VISIT SUMMARY</span>
                <span className="kiosk-confirm-type">Walk-in</span>
              </div>

              <div className="kiosk-confirm-rows">
                <div className="kiosk-confirm-row">
                  <div className="kiosk-row-icon" aria-hidden="true">
                    <DepartmentIcon />
                  </div>
                  <div className="kiosk-row-text">
                    <span className="kiosk-row-label">Department</span>
                    <strong className="kiosk-row-value">{department.name}</strong>
                  </div>
                </div>

                <div className="kiosk-confirm-row">
                  <div className="kiosk-row-icon" aria-hidden="true">
                    <ServiceIcon />
                  </div>
                  <div className="kiosk-row-text">
                    <span className="kiosk-row-label">Service</span>
                    <strong className="kiosk-row-value">{service.name}</strong>
                  </div>
                </div>

                <div className="kiosk-confirm-row kiosk-confirm-row-subtle">
                  <div className="kiosk-row-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="18" height="18" x="3" y="4" rx="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" x2="21" y1="10" y2="10" />
                    </svg>
                  </div>
                  <div className="kiosk-row-text">
                    <span className="kiosk-row-label">Clinic Date</span>
                    <strong className="kiosk-row-value">{formattedDate}</strong>
                  </div>
                </div>
              </div>

              <div className="kiosk-privacy-note">
                <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                </svg>
                <span>Anonymous visit • No personal identification or medical records are collected.</span>
              </div>
            </div>

            <div className="kiosk-footer-dock kiosk-footer-dock-spread">
              <button
                className="kiosk-btn kiosk-btn-secondary kiosk-btn-large"
                type="button"
                onClick={back}
                disabled={pending}
              >
                ← Change Selection
              </button>
              <button
                className="kiosk-btn kiosk-btn-primary kiosk-btn-large"
                type="button"
                onClick={issueVisit}
                disabled={pending}
                aria-label="Issue ticket and proceed"
              >
                {pending ? (
                  <>
                    <span className="kiosk-spinner-btn" aria-hidden="true" />
                    <span>Issuing ticket…</span>
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m5 12 5 5L20 7" />
                    </svg>
                    <span>Get My Ticket →</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STAGE 4: RECEIPT / TICKET DISPENSED */}
        {!loading && !error && stage === "receipt" && receipt && (
          <div className="kiosk-stage-container kiosk-receipt-container" aria-live="polite">
            <div className="kiosk-receipt-celebration">
              <div className="kiosk-celebration-badge" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m4 12 6 6L20 6" />
                </svg>
              </div>
              <h1 id="kiosk-stage-title" className="kiosk-stage-heading kiosk-success-heading">Ticket Issued!</h1>
              <p className="kiosk-stage-subheading">Please take your number and proceed to the waiting area.</p>
            </div>

            {/* Ticket Card with Scalloped Edges & Authentic Perforation */}
            <article className="kiosk-ticket-card ticket-receipt" aria-label="Your printed queue ticket">
              <div className="kiosk-ticket-notch kiosk-ticket-notch-top" aria-hidden="true" />

              <div className="kiosk-ticket-header">
                <span className="kiosk-ticket-clinic">CLINIC QUEUE TICKET</span>
                <span className="kiosk-ticket-dept">{receipt.departmentName}</span>
              </div>

              <div className="kiosk-ticket-number-wrap">
                <span className="kiosk-ticket-num-label">YOUR NUMBER</span>
                <div className="kiosk-ticket-number" aria-label={`Ticket number ${receipt.ticketNumber ?? receipt.visitCode}`}>
                  {receipt.ticketNumber ?? receipt.visitCode}
                </div>
              </div>

              <div className="kiosk-ticket-perforation" aria-hidden="true">
                <div className="kiosk-ticket-dash" />
              </div>

              <div className="kiosk-ticket-details-grid">
                <div className="kiosk-detail-cell">
                  <span className="kiosk-detail-label">Service</span>
                  <span className="kiosk-detail-value">{receipt.serviceName}</span>
                </div>
                <div className="kiosk-detail-cell">
                  <span className="kiosk-detail-label">Date</span>
                  <span className="kiosk-detail-value">{receipt.clinicDate}</span>
                </div>
                <div className="kiosk-detail-cell kiosk-detail-cell-wide">
                  <span className="kiosk-detail-label">Visit Code</span>
                  <span className="kiosk-detail-value kiosk-detail-mono">{receipt.visitCode}</span>
                </div>
              </div>

              <div className="kiosk-ticket-guidance">
                <div className="kiosk-guidance-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="14" x="2" y="3" rx="2" />
                    <line x1="8" x2="16" y1="21" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                </div>
                <p>
                  Watch the lobby display monitors. When your ticket number is called,
                  please proceed to the assigned counter.
                </p>
              </div>

              <div className="kiosk-ticket-notch kiosk-ticket-notch-bottom" aria-hidden="true" />
            </article>

            {/* Action Bar for Receipt Screen */}
            <div className="kiosk-footer-dock kiosk-footer-dock-spread no-print">
              <button
                className="kiosk-btn kiosk-btn-secondary kiosk-btn-large"
                type="button"
                onClick={() => window.print()}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
                <span>Print Ticket</span>
              </button>

              <button
                className="kiosk-btn kiosk-btn-cta kiosk-btn-large"
                type="button"
                onClick={startOver}
                aria-label="Finish and prepare for next patient"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m5 12 5 5L20 7" />
                </svg>
                <span>Next Patient • Done</span>
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Friendly Bottom Bar */}
      <footer className="kiosk-footer">
        <div className="kiosk-footer-left">
          <span>Need assistance? Please ask the clinic reception desk.</span>
        </div>
        <div className="kiosk-footer-right">
          <span>Anonymous Visit • Walk-in Queue Authority</span>
        </div>
      </footer>
    </main>
  );
}
