import assert from "node:assert/strict";
import test from "node:test";
import { canAccessRole, homeForRole } from "../../src/auth/roles.js";

test("routes each supported role to its own workspace", () => {
  assert.equal(homeForRole("Admin"), "/admin");
  assert.equal(homeForRole("Reception"), "/reception");
  assert.equal(homeForRole("Staff"), "/department");
  assert.equal(homeForRole(undefined), "/login");
});

test("role gates compare role names without granting another role access", () => {
  assert.equal(canAccessRole("ADMIN", ["admin"]), true);
  assert.equal(canAccessRole("Reception", ["admin"]), false);
  assert.equal(canAccessRole(undefined, ["staff"]), false);
});
