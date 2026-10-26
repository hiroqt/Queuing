export const adminSectionGroups = [
  {
    label: "Overview",
    sections: [
      { path: "dashboard", label: "Dashboard", note: "Clinic and queue overview" },
    ],
  },
  {
    label: "Clinic setup",
    sections: [
      { path: "departments", label: "Departments", note: "Set up destinations" },
      { path: "services", label: "Services", note: "Configure clinic services" },
      { path: "stations", label: "Stations", note: "Assign services and staff" },
    ],
  },
  {
    label: "Access",
    sections: [
      { path: "users", label: "Users & access", note: "Manage staff access" },
    ],
  },
  {
    label: "Devices",
    sections: [
      { path: "displays", label: "Displays", note: "Register waiting room monitors" },
      { path: "kiosks", label: "Kiosks", note: "Enroll ticket kiosks" },
    ],
  },
];

export const adminSections = adminSectionGroups.flatMap(({ sections }) => sections);
