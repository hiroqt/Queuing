# Security checklist
- [ ] Same-origin production, TLS/HSTS and secure HttpOnly session cookie
- [ ] CSRF token on all cookie-authenticated mutations; CORS locked down
- [ ] Role and specific counter/service ownership server-enforced
- [ ] Password/session reset, logout and rate limit addressed
- [ ] Public display device enrollment, credential rotation/revocation and scope checked
- [ ] No private identifiers, passwords, session tokens or PHI in public payload/logs
- [ ] Validated config schema; no arbitrary code, stored XSS or HTML injection
- [ ] Standard error responses and audit of sensitive actions
- [ ] Security/integration tests cover direct unauthorized API calls
