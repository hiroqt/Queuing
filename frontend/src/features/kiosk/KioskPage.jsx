import { useEffect, useRef, useState } from "react";
import { kioskApi } from "../../api/client.js";
import "./kiosk.css";

const progressSteps = [
  { id: "department", label: "Department", step: "01" },
  { id: "service", label: "Service", step: "02" },
  { id: "confirm", label: "Confirm", step: "03" },
];

function getDepartmentDescription(name = "") {
  const normalized = name.toLowerCase();
  if (normalized.includes("dent") || normalized.includes("tooth") || normalized.includes("oral")) {
    return "Specialized in oral health examinations, dental checkups, tooth care, and routine oral procedures.";
  }
  if (normalized.includes("lab") || normalized.includes("blood") || normalized.includes("specimen") || normalized.includes("diagnostic")) {
    return "Handles diagnostic laboratory specimens, blood examinations, and routine clinical screenings.";
  }
  if (normalized.includes("pedia") || normalized.includes("child") || normalized.includes("baby") || normalized.includes("kid")) {
    return "Dedicated to healthcare checkups, pediatric consultations, and outpatient wellness for infants and children.";
  }
  if (normalized.includes("radio") || normalized.includes("x-ray") || normalized.includes("xray") || normalized.includes("scan") || normalized.includes("imaging")) {
    return "Provides diagnostic imaging, X-ray examinations, and outpatient radiological screening.";
  }
  if (normalized.includes("cardio") || normalized.includes("heart") || normalized.includes("ecg")) {
    return "Specialized in heart health assessments, ECG screenings, and cardiac consultations.";
  }
  if (normalized.includes("eye") || normalized.includes("optom") || normalized.includes("vision")) {
    return "Focuses on vision examinations, eye health evaluations, and general optical care.";
  }
  if (normalized.includes("pharm") || normalized.includes("med") || normalized.includes("drug")) {
    return "Dispensary services for prescription medications, pharmacy fulfillment, and dosage guidance.";
  }
  return "Provides outpatient medical evaluations, doctor consultations, and general walk-in healthcare services.";
}

function getServiceDescription(name = "", departmentName = "") {
  const normalized = name.toLowerCase();
  if (normalized.includes("clean") || normalized.includes("prophy")) {
    return "Routine preventive dental cleaning, plaque removal, and oral hygiene assessment.";
  }
  if (normalized.includes("extract") || normalized.includes("pull")) {
    return "Safe outpatient removal of problematic, impacted, or severely decayed teeth.";
  }
  if (normalized.includes("fill") || normalized.includes("restor")) {
    return "Restoration of decayed or damaged tooth structure using dental filling materials.";
  }
  if (normalized.includes("x-ray") || normalized.includes("xray") || normalized.includes("radiograph") || normalized.includes("scan")) {
    return "Diagnostic radiological imaging to evaluate internal structures and bone condition.";
  }
  if (normalized.includes("blood") || normalized.includes("cbc") || normalized.includes("hemat")) {
    return "Routine blood sampling and clinical laboratory hematology analysis.";
  }
  if (normalized.includes("urin") || normalized.includes("urinalysis")) {
    return "Laboratory urinalysis test for general health and diagnostic metabolic screening.";
  }
  if (normalized.includes("ecg") || normalized.includes("ekg")) {
    return "Electrocardiogram recording electrical signals to evaluate heart rhythm and function.";
  }
  if (normalized.includes("checkup") || normalized.includes("consult") || normalized.includes("exam")) {
    return "Clinical outpatient evaluation, medical history review, and healthcare recommendations.";
  }
  if (normalized.includes("vaccin") || normalized.includes("immun")) {
    return "Preventive vaccination and immunization administration according to health schedules.";
  }
  if (normalized.includes("refill") || normalized.includes("dispens")) {
    return "Verification and dispensing of prescribed medications with pharmacist guidance.";
  }
  return `Outpatient ${name} care provided within the ${departmentName || "assigned"} department.`;
}

function getDepartmentIcon(name = "") {
  const normalized = name.toLowerCase();
  if (normalized.includes("dent") || normalized.includes("tooth") || normalized.includes("oral")) {
    return (
      <svg className="kiosk-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 3C4.5 5 3 8 3 11c0 4 2 8 4 10 1 1 2 1 3-1l1-4h2l1 4c1 2 2 2 3 1 2-2 4-6 4-10 0-3-1.5-6-4-8-1.5 0-3 1-4 2-1-1-2.5-2-4-2z" />
      </svg>
    );
  }
  if (normalized.includes("lab") || normalized.includes("blood") || normalized.includes("specimen") || normalized.includes("diagnostic")) {
    return (
      <svg className="kiosk-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 3h6M10 3v6l-5 8a2 2 0 0 0 1.7 3h10.6A2 2 0 0 0 19 17l-5-8V3" />
        <path d="M7.5 15h9" />
      </svg>
    );
  }
  if (normalized.includes("pedia") || normalized.includes("child") || normalized.includes("baby") || normalized.includes("kid")) {
    return (
      <svg className="kiosk-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="8" r="5" />
        <path d="M20 21a8 8 0 1 0-16 0" />
        <circle cx="9" cy="8" r="1" fill="currentColor" />
        <circle cx="15" cy="8" r="1" fill="currentColor" />
        <path d="M10 11c.7.7 2.3.7 3 0" />
      </svg>
    );
  }
  if (normalized.includes("radio") || normalized.includes("x-ray") || normalized.includes("xray") || normalized.includes("scan") || normalized.includes("imaging")) {
    return (
      <svg className="kiosk-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="12" cy="12" r="3" />
        <path d="m5 5 4 4M19 5l-4 4M5 19l4-4M19 19l-4-4" />
      </svg>
    );
  }
  if (normalized.includes("cardio") || normalized.includes("heart") || normalized.includes("ecg")) {
    return (
      <svg className="kiosk-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
        <path d="M7 11h2l2-3 2 6 2-3h2" />
      </svg>
    );
  }
  if (normalized.includes("eye") || normalized.includes("optom") || normalized.includes("vision")) {
    return (
      <svg className="kiosk-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  if (normalized.includes("pharm") || normalized.includes("med") || normalized.includes("drug")) {
    return (
      <svg className="kiosk-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="4" width="16" height="16" rx="4" />
        <path d="M9 12h6M12 9v6" />
      </svg>
    );
  }
  return (
    <svg className="kiosk-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
      <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" />
      <circle cx="20" cy="10" r="2" />
    </svg>
  );
}

function getServiceIcon(name = "", departmentName = "", className = "kiosk-service-icon") {
  const normName = (name || "").toLowerCase();
  const normDept = (departmentName || "").toLowerCase();

  // 1. Vaccination / Rabies / Tetanus / Immunization / Injections / Animal Bite
  if (
    normName.includes("vaccin") ||
    normName.includes("rabies") ||
    normName.includes("tetanus") ||
    normName.includes("immun") ||
    normName.includes("inject") ||
    normName.includes("shot") ||
    normName.includes("bite") ||
    normName.includes("anti-rabies") ||
    normName.includes("toxoid") ||
    normDept.includes("bite") ||
    normDept.includes("rabies") ||
    normDept.includes("vaccin")
  ) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m18 2 4 4" />
        <path d="m17 7 3-3" />
        <path d="M19 9 8.7 19.3c-.4.4-1 .6-1.6.6H3v-4.1c0-.6.2-1.2.6-1.6L14 3.9" />
        <path d="m5 19-3 3" />
        <path d="m14 4 6 6" />
      </svg>
    );
  }

  // 2. ECG / EKG / Cardiology / Heart / Rhythm / Pulse
  if (
    normName.includes("ecg") ||
    normName.includes("ekg") ||
    normName.includes("cardio") ||
    normName.includes("heart") ||
    normName.includes("rhythm") ||
    normName.includes("pulse") ||
    normDept.includes("ecg") ||
    normDept.includes("ekg") ||
    normDept.includes("cardio")
  ) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    );
  }

  // 3. X-Ray / Radiology / Chest X-Ray / Scan / Fluoroscopy
  if (
    normName.includes("x-ray") ||
    normName.includes("xray") ||
    normName.includes("radio") ||
    normName.includes("chest") ||
    normName.includes("scan") ||
    normName.includes("imaging") ||
    normDept.includes("x-ray") ||
    normDept.includes("xray") ||
    normDept.includes("radio")
  ) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <line x1="12" y1="6" x2="12" y2="18" />
        <path d="M8 9a4 4 0 0 0 8 0" />
        <path d="M8 12a4 4 0 0 0 8 0" />
        <path d="M8 15a4 4 0 0 0 8 0" />
      </svg>
    );
  }

  // 4. Dental / Teeth / Oral / Extraction / Cleaning / Prophylaxis / Filling
  if (
    normName.includes("dent") ||
    normName.includes("tooth") ||
    normName.includes("teeth") ||
    normName.includes("oral") ||
    normName.includes("clean") ||
    normName.includes("prophy") ||
    normName.includes("extract") ||
    normName.includes("fill") ||
    normName.includes("cavity") ||
    normDept.includes("dent") ||
    normDept.includes("tooth") ||
    normDept.includes("oral")
  ) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 3C4.5 5 3 8 3 11c0 4 2 8 4 10 1 1 2 1 3-1l1-4h2l1 4c1 2 2 2 3 1 2-2 4-6 4-10 0-3-1.5-6-4-8-1.5 0-3 1-4 2-1-1-2.5-2-4-2z" />
      </svg>
    );
  }

  // 5. Blood Test / CBC / Hematology / Phlebotomy / Blood Extraction
  if (
    normName.includes("blood") ||
    normName.includes("cbc") ||
    normName.includes("hemat") ||
    normName.includes("phlebo") ||
    normName.includes("glucose") ||
    normName.includes("sugar")
  ) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
        <path d="M12 11v6" />
        <path d="M9 14h6" />
      </svg>
    );
  }

  // 6. Laboratory / Urinalysis / Urine / Specimen / Diagnostic / Swab / Stool
  if (
    normName.includes("lab") ||
    normName.includes("urin") ||
    normName.includes("specimen") ||
    normName.includes("swab") ||
    normName.includes("stool") ||
    normName.includes("fecal") ||
    normName.includes("diagnost") ||
    normDept.includes("lab")
  ) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 3h6M10 3v6l-5 8a2 2 0 0 0 1.7 3h10.6A2 2 0 0 0 19 17l-5-8V3" />
        <path d="M7.5 15h9" />
      </svg>
    );
  }

  // 7. Ultrasound / Sonography / Echo
  if (
    normName.includes("ultra") ||
    normName.includes("sono") ||
    normName.includes("echo") ||
    normName.includes("doppler")
  ) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 12h2a8 8 0 0 1 8 8v2" />
        <path d="M2 7h1a13 13 0 0 1 13 13v1" />
        <rect width="8" height="8" x="13" y="3" rx="2" />
        <path d="m17 11 4 4" />
      </svg>
    );
  }

  // 8. Wound Care / Dressing / Suture / Stitch / First Aid / Minor Surgery
  if (
    normName.includes("wound") ||
    normName.includes("dress") ||
    normName.includes("suture") ||
    normName.includes("stitch") ||
    normName.includes("bandage") ||
    normName.includes("first aid") ||
    normName.includes("burn") ||
    normName.includes("trauma") ||
    normName.includes("surgery")
  ) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="7" width="20" height="10" rx="3" />
        <line x1="8" y1="7" x2="8" y2="17" />
        <line x1="16" y1="7" x2="16" y2="17" />
        <line x1="12" y1="10" x2="12" y2="14" />
        <line x1="10" y1="12" x2="14" y2="12" />
      </svg>
    );
  }

  // 9. Pharmacy / Medication / Medicine / Pill / Prescription / Dispensing / Refill
  if (
    normName.includes("pharm") ||
    normName.includes("med") ||
    normName.includes("drug") ||
    normName.includes("pill") ||
    normName.includes("refill") ||
    normName.includes("dispens") ||
    normName.includes("capsule") ||
    normName.includes("tablet") ||
    normDept.includes("pharm")
  ) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
        <path d="m8.5 8.5 7 7" />
      </svg>
    );
  }

  // 10. Eye / Vision / Ophthalmology / Optometry
  if (
    normName.includes("eye") ||
    normName.includes("optom") ||
    normName.includes("vision") ||
    normName.includes("sight") ||
    normDept.includes("eye") ||
    normDept.includes("vision")
  ) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }

  // 11. Pediatrics / Child / Well-Baby / Infant
  if (
    normName.includes("pedia") ||
    normName.includes("child") ||
    normName.includes("baby") ||
    normName.includes("kid") ||
    normDept.includes("pedia") ||
    normDept.includes("child")
  ) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="8" r="5" />
        <path d="M20 21a8 8 0 1 0-16 0" />
        <circle cx="9" cy="8" r="1" fill="currentColor" />
        <circle cx="15" cy="8" r="1" fill="currentColor" />
        <path d="M10 11c.7.7 2.3.7 3 0" />
      </svg>
    );
  }

  // 12. Physical Therapy / Rehab / Orthopedic
  if (
    normName.includes("therap") ||
    normName.includes("rehab") ||
    normName.includes("physio") ||
    normName.includes("ortho") ||
    normDept.includes("rehab") ||
    normDept.includes("therap")
  ) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="5" r="2" />
        <path d="m9 20 3-6 3 6" />
        <path d="m6 8 6 2 6-2" />
        <path d="M12 10v4" />
      </svg>
    );
  }

  // Default: Consultation / Doctor Exam / General Medical Care (Stethoscope)
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
      <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" />
      <circle cx="20" cy="10" r="2" />
    </svg>
  );
}

const IDLE_TIMEOUT_SECONDS = 45;

export default function KioskPage() {
  const [departments, setDepartments] = useState([]);
  const [department, setDepartment] = useState(null);
  const [service, setService] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [stage, setStage] = useState("start");
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [issueError, setIssueError] = useState("");
  const [clockTime, setClockTime] = useState(() => new Date());
  const [infoDepartment, setInfoDepartment] = useState(null);
  const [infoService, setInfoService] = useState(null);
  const [isIdle, setIsIdle] = useState(false);
  const issueKey = useRef(null);
  const lastActivityRef = useRef(0);

  function dismissIdle() {
    lastActivityRef.current = Date.now();
    setIsIdle(false);
  }

  useEffect(() => {
    if (lastActivityRef.current === 0) {
      lastActivityRef.current = Date.now();
    }

    function resetActivity() {
      // While idle, do not automatically dismiss on window events - only clicking "Yes" dismisses it
      if (!isIdle) {
        lastActivityRef.current = Date.now();
      }
    }

    const events = ["pointerdown", "touchstart", "mousemove", "keydown", "scroll"];
    events.forEach((ev) => window.addEventListener(ev, resetActivity, { passive: true }));

    const timer = setInterval(() => {
      // Pause idle evaluation during initial loading, ticket mutation, while already in idle state, or on the start screen
      if (loading || pending || isIdle || stage === "start") {
        return;
      }

      const elapsed = Math.floor((Date.now() - lastActivityRef.current) / 1000);
      if (elapsed >= IDLE_TIMEOUT_SECONDS) {
        setIsIdle(true);
      }
    }, 1000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, resetActivity));
      clearInterval(timer);
    };
  }, [isIdle, loading, pending, stage]);

  useEffect(() => {
    const timer = setInterval(() => setClockTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!infoDepartment && !infoService) return;
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setInfoDepartment(null);
        setInfoService(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [infoDepartment, infoService]);

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
    setInfoService(null);
    if (nextDepartment.services.length === 1) {
      setService(nextDepartment.services[0]);
      setSelectedService(nextDepartment.services[0]);
      setStage("confirm");
    } else {
      setService(null);
      setSelectedService(null);
      setStage("service");
    }
  }

  function handleServiceCardClick(item) {
    setSelectedService(item);
  }

  function chooseService(nextService) {
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
    setInfoService(null);
    if (stage === "confirm" && department?.services.length > 1) {
      setStage("service");
    } else if (stage === "service") {
      setDepartment(null);
      setService(null);
      setSelectedService(null);
      setStage("department");
    } else {
      setDepartment(null);
      setService(null);
      setSelectedService(null);
      setStage("start");
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
    setInfoDepartment(null);
    setInfoService(null);
    setStage("start");
  }

  const activeIndex = stage === "department" ? 0 : stage === "service" ? 1 : 2;

  const formattedTime = clockTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const formattedDate = clockTime.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

  return (
    <main className="kiosk-shell">
      {/* Top Banner & Header (Admin Evergreen & Amber theme) */}
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
      {stage !== "receipt" && stage !== "start" && (
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
            <div className="kiosk-error-icon" aria-hidden="true">⚠️</div>
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
            <div className="kiosk-info-icon" aria-hidden="true">ℹ️</div>
            <h2 className="kiosk-state-title">No services are available right now</h2>
            <p className="kiosk-state-desc">Please proceed directly to the Reception desk for assistance.</p>
            {issueError && <p className="kiosk-inline-banner" role="status">{issueError}</p>}
          </div>
        )}

        {/* STAGE 0: START / ATTRACT SCREEN (Fast-Food Kiosk Style) */}
        {!loading && !error && departments.length > 0 && stage === "start" && (
          <div className="kiosk-stage-container kiosk-start-container">
            <div className="kiosk-start-hero">
              <div className="kiosk-start-badge">
                <span className="kiosk-start-badge-dot" />
                <span>SELF-SERVICE CLINIC QUEUE</span>
              </div>
              <h1 id="kiosk-stage-title" className="kiosk-start-title">
                Welcome to Clinic Queue
              </h1>
              <p className="kiosk-start-desc">
                Fast, anonymous walk-in ticket dispenser. Please touch the button below to begin taking your number.
              </p>
            </div>

            {/* Massive Fast-Food Style Touch to Start Button */}
            <div className="kiosk-start-action-wrap">
              <button
                className="kiosk-start-action-card"
                type="button"
                onClick={() => setStage("department")}
                aria-label="Touch screen to start getting your queue ticket"
              >
                <div className="kiosk-start-icon-wrap" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="16" rx="3" />
                    <line x1="7" y1="8" x2="17" y2="8" />
                    <line x1="7" y1="12" x2="13" y2="12" />
                    <circle cx="16" cy="16" r="2" />
                  </svg>
                </div>
                <div className="kiosk-start-btn-content">
                  <span className="kiosk-start-main-text">TOUCH TO START</span>
                  <span className="kiosk-start-sub-text">Tap anywhere here to begin • Pindutin para magsimula</span>
                </div>
                <div className="kiosk-start-arrow-badge" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </div>
              </button>
            </div>

            {/* 3 Simple Steps Preview */}
            <div className="kiosk-start-steps-preview" aria-label="3 steps to get your ticket">
              <div className="kiosk-start-step-item">
                <div className="kiosk-start-step-num">1</div>
                <div className="kiosk-start-step-info">
                  <strong>Choose Department</strong>
                  <span>Select where you need care</span>
                </div>
              </div>
              <div className="kiosk-start-step-divider" aria-hidden="true">→</div>
              <div className="kiosk-start-step-item">
                <div className="kiosk-start-step-num">2</div>
                <div className="kiosk-start-step-info">
                  <strong>Pick Your Service</strong>
                  <span>Select consultation or treatment</span>
                </div>
              </div>
              <div className="kiosk-start-step-divider" aria-hidden="true">→</div>
              <div className="kiosk-start-step-item">
                <div className="kiosk-start-step-num">3</div>
                <div className="kiosk-start-step-info">
                  <strong>Get Queue Ticket</strong>
                  <span>Take your printed receipt & wait</span>
                </div>
              </div>
            </div>

            {/* Helpful Trust & Accessibility Footer Note */}
            <div className="kiosk-start-trust-bar">
              <div className="kiosk-start-trust-item">
                <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                </svg>
                <span>No appointments or ID needed</span>
              </div>
              <span className="kiosk-start-trust-dot">•</span>
              <div className="kiosk-start-trust-item">
                <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                <span>Fast 15-second issue</span>
              </div>
              <span className="kiosk-start-trust-dot">•</span>
              <div className="kiosk-start-trust-item">
                <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor" aria-hidden="true">
                  <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                </svg>
                <span>Reception assistance available</span>
              </div>
            </div>
          </div>
        )}

        {/* STAGE 1: DEPARTMENT SELECTION (With Info Icon) */}
        {!loading && !error && departments.length > 0 && stage === "department" && (
          <div className="kiosk-stage-container">
            <div className="kiosk-stage-hero">
              <span className="kiosk-hero-tag">STEP 1 OF 3</span>
              <h1 id="kiosk-stage-title" className="kiosk-stage-heading">Where do you need to go today?</h1>
              <p className="kiosk-stage-subheading">Touch your destination department to view available medical services, or tap the info icon for details.</p>
            </div>

            {issueError && <p className="kiosk-inline-banner kiosk-inline-error" role="status">{issueError}</p>}

            <div className="kiosk-category-grid" role="group" aria-label="Department choices">
              {departments.map((dept) => {
                const serviceCount = dept.services?.length ?? 0;
                return (
                  <div className="kiosk-category-card" key={dept.id}>
                    {/* Top-Right Information Icon Button */}
                    <button
                      className="kiosk-card-info-btn"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInfoDepartment(dept);
                      }}
                      aria-label={`View summary of ${dept.name} services`}
                      title={`View ${dept.name} services summary`}
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                    </button>

                    {/* Main Select Action */}
                    <button
                      className="kiosk-card-main-action"
                      type="button"
                      onClick={() => chooseDepartment(dept)}
                      aria-label={`Select ${dept.name} department, ${serviceCount} service${serviceCount === 1 ? "" : "s"} available`}
                    >
                      <div className="kiosk-card-header">
                        <div className="kiosk-card-icon-wrap" aria-hidden="true">
                          {getDepartmentIcon(dept.name)}
                        </div>
                      </div>

                      <div className="kiosk-card-body">
                        <span className="kiosk-card-title">{dept.name}</span>
                        <span className="kiosk-card-meta">
                          {serviceCount === 1 ? "1 service • Fast-track" : `${serviceCount} services available`}
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

            {/* Back Dock: Return to Welcome Screen */}
            <div className="kiosk-footer-dock">
              <button
                className="kiosk-btn kiosk-btn-secondary kiosk-btn-large"
                type="button"
                onClick={startOver}
              >
                ← Back
              </button>
            </div>
          </div>
        )}

        {/* STAGE 2: SERVICE SELECTION */}
        {!loading && !error && stage === "service" && department && (
          <div className="kiosk-stage-container">
            {/* Context breadcrumb header with Department Name in place of button */}
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
              <p className="kiosk-stage-subheading">Choose a service below or tap the info icon for details, then tap the Next button to review your visit.</p>
            </div>

            <div className="kiosk-service-grid" role="group" aria-label={`Services in ${department.name}`}>
              {department.services.map((item) => {
                const isSelected = selectedService?.id === item.id;
                return (
                  <div className={`kiosk-service-card ${isSelected ? "is-selected" : ""}`} key={item.id}>
                    {/* Top-Right Info Symbol Button */}
                    <button
                      className="kiosk-card-info-btn"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInfoService(item);
                      }}
                      aria-label={`View summary of ${item.name} service`}
                      title={`View ${item.name} service summary`}
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                    </button>

                    {/* Main Select Button */}
                    <button
                      className="kiosk-service-main-action"
                      type="button"
                      onClick={() => handleServiceCardClick(item)}
                      aria-pressed={isSelected}
                      aria-label={`Select service ${item.name}`}
                    >
                      <div className="kiosk-service-icon-wrap" aria-hidden="true">
                        {getServiceIcon(item.name, department.name)}
                      </div>
                      <div className="kiosk-service-info">
                        <span className="kiosk-service-name">{item.name}</span>
                        <span className="kiosk-service-tag">{isSelected ? "Selected Service ✓" : "Walk-in Consultation"}</span>
                      </div>
                      <div className="kiosk-card-action" aria-hidden="true">
                        <span>{isSelected ? "Selected" : "Select"}</span>
                        <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m7 4 6 6-6 6" />
                        </svg>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Responsive Dual Action Dock: Back + Next */}
            <div className="kiosk-footer-dock kiosk-footer-dock-spread">
              <button className="kiosk-btn kiosk-btn-secondary kiosk-btn-large" type="button" onClick={back}>
                ← Back to Departments
              </button>
              <button
                className="kiosk-btn kiosk-btn-primary kiosk-btn-large"
                type="button"
                onClick={() => chooseService(selectedService)}
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
                <span className="kiosk-confirm-type">Walk-in Patient</span>
              </div>

              <div className="kiosk-confirm-rows">
                <div className="kiosk-confirm-row">
                  <div className="kiosk-row-icon" aria-hidden="true">
                    {getDepartmentIcon(department.name)}
                  </div>
                  <div className="kiosk-row-text">
                    <span className="kiosk-row-label">Department</span>
                    <strong className="kiosk-row-value">{department.name}</strong>
                  </div>
                </div>

                <div className="kiosk-confirm-row">
                  <div className="kiosk-row-icon" aria-hidden="true">
                    {getServiceIcon(service.name, department.name)}
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
                      <line x1="16" x2="16" y1="2" y2="6" />
                      <line x1="8" x2="8" y1="2" y2="6" />
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
                <span>Anonymous visit • No personal identification or medical records are stored.</span>
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
                    <span>Next: Get My Ticket →</span>
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
                <div className="kiosk-guidance-icon" aria-hidden="true">📢</div>
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

      {/* Department Services Summary Modal Dialog */}
      {infoDepartment && (
        <div
          className="kiosk-modal-backdrop"
          role="presentation"
          onClick={() => setInfoDepartment(null)}
        >
          <div
            className="kiosk-modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="kiosk-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="kiosk-modal-header">
              <div className="kiosk-modal-header-left">
                <div className="kiosk-modal-icon-wrap" aria-hidden="true">
                  {getDepartmentIcon(infoDepartment.name)}
                </div>
                <div className="kiosk-modal-title-group">
                  <span className="kiosk-modal-eyebrow">DEPARTMENT OVERVIEW</span>
                  <h2 id="kiosk-modal-title" className="kiosk-modal-title">{infoDepartment.name}</h2>
                </div>
              </div>
              <button
                className="kiosk-modal-close-btn"
                type="button"
                onClick={() => setInfoDepartment(null)}
                aria-label="Close summary modal"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="kiosk-modal-body">
              <p className="kiosk-modal-desc">
                {getDepartmentDescription(infoDepartment.name)}
              </p>

              <div className="kiosk-modal-services-section">
                <h3 className="kiosk-modal-section-title">
                  AVAILABLE SERVICES ({infoDepartment.services?.length ?? 0})
                </h3>
                <div className="kiosk-modal-services-list">
                  {infoDepartment.services?.map((srv) => (
                    <div className="kiosk-modal-service-item" key={srv.id}>
                      <span className="kiosk-modal-service-name">{srv.name}</span>
                      <span className="kiosk-modal-service-tag">Walk-in</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="kiosk-privacy-note">
                <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                </svg>
                <span>No appointment required. Simply take a number when ready.</span>
              </div>
            </div>

            <div className="kiosk-modal-footer">
              <button
                className="kiosk-btn kiosk-btn-secondary kiosk-btn-compact"
                type="button"
                onClick={() => setInfoDepartment(null)}
              >
                Close
              </button>
              <button
                className="kiosk-btn kiosk-btn-primary kiosk-btn-compact"
                type="button"
                onClick={() => {
                  const dept = infoDepartment;
                  setInfoDepartment(null);
                  chooseDepartment(dept);
                }}
              >
                Select this Department →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Service Details Summary Modal Dialog */}
      {infoService && (
        <div
          className="kiosk-modal-backdrop"
          role="presentation"
          onClick={() => setInfoService(null)}
        >
          <div
            className="kiosk-modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="kiosk-service-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="kiosk-modal-header">
              <div className="kiosk-modal-header-left">
                <div className="kiosk-modal-icon-wrap" aria-hidden="true">
                  {getServiceIcon(infoService.name, department?.name)}
                </div>
                <div className="kiosk-modal-title-group">
                  <span className="kiosk-modal-eyebrow">SERVICE OVERVIEW</span>
                  <h2 id="kiosk-service-modal-title" className="kiosk-modal-title">{infoService.name}</h2>
                </div>
              </div>
              <button
                className="kiosk-modal-close-btn"
                type="button"
                onClick={() => setInfoService(null)}
                aria-label="Close summary modal"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="kiosk-modal-body">
              <p className="kiosk-modal-desc">
                {getServiceDescription(infoService.name, department?.name)}
              </p>

              <div className="kiosk-modal-services-section">
                <h3 className="kiosk-modal-section-title">SERVICE DETAILS</h3>
                <div className="kiosk-modal-services-list">
                  <div className="kiosk-modal-service-item">
                    <span className="kiosk-modal-service-name">Department</span>
                    <span className="kiosk-modal-service-tag">{department?.name}</span>
                  </div>
                  <div className="kiosk-modal-service-item">
                    <span className="kiosk-modal-service-name">Visit Type</span>
                    <span className="kiosk-modal-service-tag">Walk-in Consultation</span>
                  </div>
                </div>
              </div>

              <div className="kiosk-privacy-note">
                <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                </svg>
                <span>No appointment required. Simply select to proceed.</span>
              </div>
            </div>

            <div className="kiosk-modal-footer">
              <button
                className="kiosk-btn kiosk-btn-secondary kiosk-btn-compact"
                type="button"
                onClick={() => setInfoService(null)}
              >
                Close
              </button>
              <button
                className="kiosk-btn kiosk-btn-primary kiosk-btn-compact"
                type="button"
                onClick={() => {
                  const srv = infoService;
                  setInfoService(null);
                  setSelectedService(srv);
                }}
              >
                Select this Service
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kiosk Idle Prompt & Video Box Indicator Overlay */}
      {isIdle && (
        <div
          className="kiosk-idle-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kiosk-idle-title"
        >
          <div
            className="kiosk-idle-modal"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Friendly Center Header */}
            <div className="kiosk-idle-header">
              <div className="kiosk-idle-icon-wrap" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <h2 id="kiosk-idle-title" className="kiosk-idle-title">Are you still there?</h2>
              <p className="kiosk-idle-subtitle">
                Touch the button below to continue taking your queue ticket.
              </p>
            </div>

            {/* Simple Video Box Indicator */}
            <div className="kiosk-idle-video-box" aria-label="Idle video box">
              <div className="kiosk-video-placeholder">
                <div className="kiosk-video-play-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
                    <polygon points="6 4 20 12 6 20 6 4" />
                  </svg>
                </div>
                <span className="kiosk-video-placeholder-label">Clinic Information Video</span>
                <span className="kiosk-video-placeholder-hint">Video imported by admin will play here during idle time</span>
              </div>
            </div>

            {/* Simple, Large, Accessible Actions */}
            <div className="kiosk-idle-actions">
              <button
                className="kiosk-btn kiosk-btn-primary kiosk-btn-large kiosk-idle-confirm-btn"
                type="button"
                onClick={dismissIdle}
              >
                <span>Yes, I'm still here</span>
              </button>

              <button
                className="kiosk-idle-cancel-btn"
                type="button"
                onClick={() => {
                  setIsIdle(false);
                  startOver();
                }}
              >
                Start Over
              </button>
            </div>
          </div>
        </div>
      )}

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
