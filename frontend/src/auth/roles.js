export function homeForRole(role) {
  switch (role?.toLowerCase()) {
    case "admin": return "/admin";
    case "reception": return "/reception";
    case "staff": return "/department";
    default: return "/login";
  }
}

export function canAccessRole(currentRole, allowedRoles) {
  return allowedRoles.includes(currentRole?.toLowerCase());
}
