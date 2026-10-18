import { describe, expect, it } from "vitest";
import { authorizeCapture, bindPayPalOrder, evaluatePurchase, findAssessmentIdByOrder, markPaymentCaptured, submitConsent } from "../src/server/policy.js";
import type { Policy, PurchaseIntent } from "../src/shared/types.js";

const policy: Policy = { maxPerPurchase: 100, autoApproveBelow: 50, allowedMerchants: ["DesignCloud"], blockRecurring: true, requireApprovalWhenUrgent: true };
const intent: PurchaseIntent = { objective: "test", merchant: "DesignCloud", item: "Workspace", amount: 39, currency: "USD", recurring: false, urgency: "normal" };

describe("fail-closed payment policy", () => {
  it("allows a purchase inside delegated authority", () => expect(evaluatePurchase(intent, policy).decision).toBe("ALLOW"));
  it("requires review above the auto-approval threshold", () => expect(evaluatePurchase({ ...intent, amount: 79 }, policy).decision).toBe("REVIEW"));
  it("blocks spending beyond the hard limit", () => expect(evaluatePurchase({ ...intent, amount: 101 }, policy).decision).toBe("BLOCK"));
  it("blocks recurring charges when prohibited", () => expect(evaluatePurchase({ ...intent, recurring: true }, policy).decision).toBe("BLOCK"));
  it("blocks merchants outside the allowlist", () => expect(evaluatePurchase({ ...intent, merchant: "Unknown Shop" }, policy).decision).toBe("BLOCK"));
  it("requires correct comprehension answers before payment", () => {
    const assessment = evaluatePurchase({ ...intent, amount: 42.37 }, policy);
    expect(submitConsent(assessment.id, { today: 0, repeat: 0, control: 1 }).consentPassed).toBe(true);
  });
  it("rejects capture when the PayPal order is not bound to the assessment", () => {
    const assessment = evaluatePurchase({ ...intent, item: "Binding test" }, policy);
    submitConsent(assessment.id, { today: 0, repeat: 0, control: 1 });
    bindPayPalOrder(assessment.id, "ORDER-ONE");
    expect(findAssessmentIdByOrder("ORDER-ONE")).toBe(assessment.id);
    expect(() => authorizeCapture(assessment.id, "ORDER-TWO")).toThrow(/does not belong/);
  });
  it("prevents a PayPal order from being captured twice", () => {
    const assessment = evaluatePurchase({ ...intent, item: "Replay test" }, policy);
    submitConsent(assessment.id, { today: 0, repeat: 0, control: 1 });
    bindPayPalOrder(assessment.id, "ORDER-REPLAY");
    markPaymentCaptured(assessment.id, "ORDER-REPLAY");
    expect(() => authorizeCapture(assessment.id, "ORDER-REPLAY")).toThrow(/already been captured/);
  });
  it("warns about duplicates only after a matching payment was captured", () => {
    const uniqueIntent = { ...intent, item: `Completed ${crypto.randomUUID()}` };
    const first = evaluatePurchase(uniqueIntent, policy);
    expect(first.checks.find((check) => check.id === "duplicate")?.status).toBe("pass");
    submitConsent(first.id, { today: 0, repeat: 0, control: 1 });
    bindPayPalOrder(first.id, "ORDER-COMPLETED");
    markPaymentCaptured(first.id, "ORDER-COMPLETED");
    const second = evaluatePurchase(uniqueIntent, policy);
    expect(second.checks.find((check) => check.id === "duplicate")?.status).toBe("warn");
  });
});
