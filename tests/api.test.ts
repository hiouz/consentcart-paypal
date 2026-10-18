import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/server/index.js";

let server: Server;
let baseUrl: string;

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) }
  });
  return { response, body: await response.json().catch(() => ({})) as Record<string, any> };
}

beforeAll(async () => {
  server = await new Promise<Server>((resolve) => {
    const running = app.listen(0, "127.0.0.1", () => resolve(running));
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

describe("ConsentCart HTTP authorization flow", () => {
  it("reports service configuration without leaking credentials", async () => {
    const { response, body } = await request("/api/health");
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(typeof body.paypalConfigured).toBe("boolean");
    expect(typeof body.aiProvider).toBe("string");
    expect(body).not.toHaveProperty("paypalClientSecret");
    expect(body).not.toHaveProperty("openAiKey");
    expect(response.headers.get("x-powered-by")).toBeNull();
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("requires review, approval and correct comprehension before capture", async () => {
    const analysis = await request("/api/analyze", {
      method: "POST",
      body: JSON.stringify({
        objective: "Purchase design software from DesignCloud for $79.",
        policy: { maxPerPurchase: 100, autoApproveBelow: 50, allowedMerchants: ["DesignCloud"], blockRecurring: true, requireApprovalWhenUrgent: true }
      })
    });
    expect(analysis.response.status).toBe(200);
    expect(analysis.body.assessment.decision).toBe("REVIEW");
    const id = analysis.body.assessment.id as string;

    const beforeApproval = await request(`/api/paypal/orders/UNBOUND/capture`, {
      method: "POST",
      body: JSON.stringify({ assessmentId: id })
    });
    expect(beforeApproval.response.status).toBe(409);

    const approval = await request(`/api/assessments/${id}/approve`, { method: "POST" });
    expect(approval.body.assessment.approved).toBe(true);

    const wrong = await request(`/api/assessments/${id}/consent`, {
      method: "POST",
      body: JSON.stringify({ answers: { today: 1, repeat: 0, control: 1 } })
    });
    expect(wrong.body.assessment.consentPassed).toBe(false);

    const correct = await request(`/api/assessments/${id}/consent`, {
      method: "POST",
      body: JSON.stringify({ answers: { today: 0, repeat: 0, control: 1 } })
    });
    expect(correct.body.assessment.consentPassed).toBe(true);

    const mismatched = await request(`/api/paypal/orders/UNBOUND/capture`, {
      method: "POST",
      body: JSON.stringify({ assessmentId: id })
    });
    expect(mismatched.response.status).toBe(409);
    expect(mismatched.body.error).toMatch(/does not belong/);

    const audit = await request(`/api/assessments/${id}/audit`);
    expect(audit.body.verified).toBe(true);
    expect(audit.body.events.map((event: { type: string }) => event.type)).toContain("COMPREHENSION_FAILED");
    expect(audit.body.events.map((event: { type: string }) => event.type)).toContain("COMPREHENSION_CONFIRMED");
  });

  it("does not permit human override of a blocked recurring purchase", async () => {
    const analysis = await request("/api/analyze", {
      method: "POST",
      body: JSON.stringify({
        objective: "Purchase a monthly software subscription from DesignCloud for $29.",
        policy: { maxPerPurchase: 100, autoApproveBelow: 50, allowedMerchants: ["DesignCloud"], blockRecurring: true, requireApprovalWhenUrgent: true }
      })
    });
    expect(analysis.body.assessment.decision).toBe("BLOCK");
    const approval = await request(`/api/assessments/${analysis.body.assessment.id}/approve`, { method: "POST" });
    expect(approval.response.status).toBe(409);
    expect(approval.body.error).toMatch(/cannot be approved/);
  });
});
