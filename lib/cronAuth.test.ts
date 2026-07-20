import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { verifyCronAuth } from "./cronAuth";

describe("verifyCronAuth", () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = "test-secret";
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalSecret;
  });

  it("rejects missing Authorization header", () => {
    const res = verifyCronAuth(new Request("http://x", { method: "POST" }));
    expect(res?.status).toBe(401);
  });

  it("rejects wrong secret", () => {
    const res = verifyCronAuth(
      new Request("http://x", { method: "POST", headers: { authorization: "Bearer wrong" } }),
    );
    expect(res?.status).toBe(401);
  });

  it("rejects when CRON_SECRET is unset", () => {
    delete process.env.CRON_SECRET;
    const res = verifyCronAuth(
      new Request("http://x", { method: "POST", headers: { authorization: "Bearer test-secret" } }),
    );
    expect(res?.status).toBe(401);
  });

  it("accepts correct Bearer secret", () => {
    const res = verifyCronAuth(
      new Request("http://x", { method: "POST", headers: { authorization: "Bearer test-secret" } }),
    );
    expect(res).toBeNull();
  });
});
