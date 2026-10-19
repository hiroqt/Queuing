// shortcut: this static snapshot is non-authoritative, replace it with an approved server projection when the queue API is integrated.
export const demoSnapshot = {
  waiting: [
    { id: "demo-queue-01", number: "042", service: "Consultation", waitMinutes: 12, status: "waiting" },
    { id: "demo-queue-02", number: "043", service: "Laboratory", waitMinutes: 9, status: "waiting" },
    { id: "demo-queue-03", number: "044", service: "Consultation", waitMinutes: 7, status: "waiting" },
    { id: "demo-queue-04", number: "045", service: "Follow-up", waitMinutes: 4, status: "waiting" },
  ],
  called: [
    { id: "demo-called-01", number: "041", service: "Consultation", counter: "Counter 2", status: "called" },
  ],
  services: ["Consultation", "Laboratory", "Follow-up"],
  counters: ["Counter 1", "Counter 2", "Counter 3"],
  displays: ["Main waiting room", "Consultation area"],
};
