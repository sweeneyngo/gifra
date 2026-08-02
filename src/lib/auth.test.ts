import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { signToken, verifyToken, checkPassword } from "./auth";

describe("auth tokens", () => {
  const saved = process.env.ADMIN_PASSWORD;
  beforeEach(() => {
    process.env.ADMIN_PASSWORD = "hunter2";
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = saved;
  });

  it("signs a stable, non-empty token", () => {
    const t = signToken();
    expect(t).toBeTruthy();
    expect(t).toBe(signToken()); // deterministic for a given password
  });

  it("verifies its own token and rejects others", () => {
    expect(verifyToken(signToken())).toBe(true);
    expect(verifyToken("nope")).toBe(false);
    expect(verifyToken(undefined)).toBe(false);
  });

  it("checks the password in constant time semantics", () => {
    expect(checkPassword("hunter2")).toBe(true);
    expect(checkPassword("Hunter2")).toBe(false);
    expect(checkPassword("")).toBe(false);
  });

  it("treats everything as unauthenticated when ADMIN_PASSWORD is unset", () => {
    delete process.env.ADMIN_PASSWORD;
    expect(signToken()).toBeNull();
    expect(verifyToken("anything")).toBe(false);
    expect(checkPassword("anything")).toBe(false);
  });
});
