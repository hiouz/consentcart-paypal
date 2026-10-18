import type { CheckResult, Decision, Policy, PurchaseIntent, RiskAssessment } from "../shared/types.js";
import { randomUUID } from "node:crypto";

const assessments = new Map<string, RiskAssessment>();
const consentAnswers = new Map<string, Record<string, number>>();
const paymentOrders = new Map<string, { orderId: string; captured: boolean }>();
const completedPurchaseFingerprints = new Set<string>();

function purchaseFingerprint(intent: PurchaseIntent): string {
  return [intent.merchant, intent.item, intent.amount.toFixed(2), intent.currency]
    .map((part) => part.toLowerCase().trim())
    .join("|");
}

export function evaluatePurchase(intent: PurchaseIntent, policy: Policy): RiskAssessment {
  const checks: CheckResult[] = [];
  const merchantAllowed = policy.allowedMerchants.length === 0 ||
    policy.allowedMerchants.some((merchant) => merchant.toLowerCase() === intent.merchant.toLowerCase());
  const duplicate = completedPurchaseFingerprints.has(purchaseFingerprint(intent));

  checks.push({
    id: "budget",
    label: "Budget boundary",
    status: intent.amount <= policy.maxPerPurchase ? "pass" : "fail",
    explanation: intent.amount <= policy.maxPerPurchase
      ? `$${intent.amount.toFixed(2)} is within the $${policy.maxPerPurchase.toFixed(2)} limit.`
      : `$${intent.amount.toFixed(2)} exceeds the hard limit by $${(intent.amount - policy.maxPerPurchase).toFixed(2)}.`
  });
  checks.push({
    id: "merchant",
    label: "Merchant scope",
    status: merchantAllowed ? "pass" : "fail",
    explanation: merchantAllowed ? `${intent.merchant} is inside the approved merchant scope.` : `${intent.merchant} is not approved.`
  });
  checks.push({
    id: "recurring",
    label: "Recurring-charge protection",
    status: intent.recurring && policy.blockRecurring ? "fail" : "pass",
    explanation: intent.recurring && policy.blockRecurring ? "A recurring charge conflicts with the no-subscription policy." : "No prohibited recurring commitment detected."
  });
  checks.push({
    id: "urgency",
    label: "Urgency manipulation",
    status: intent.urgency === "urgent" && policy.requireApprovalWhenUrgent ? "warn" : "pass",
    explanation: intent.urgency === "urgent" && policy.requireApprovalWhenUrgent ? "Urgent language requires deliberate human review." : "No policy-relevant urgency pressure detected."
  });
  checks.push({
    id: "duplicate",
    label: "Duplicate-payment defense",
    status: duplicate ? "warn" : "pass",
    explanation: duplicate ? "An identical merchant, item and amount was already captured in this session." : "No matching completed payment was found."
  });
  checks.push({
    id: "approval",
    label: "Delegated authority",
    status: intent.amount <= policy.autoApproveBelow && intent.urgency === "normal" ? "pass" : "warn",
    explanation: intent.amount <= policy.autoApproveBelow ? "Amount is eligible for delegated approval." : "Amount exceeds the agent's auto-approval authority."
  });

  const fails = checks.filter((check) => check.status === "fail").length;
  const warnings = checks.filter((check) => check.status === "warn").length;
  const score = Math.min(100, fails * 45 + warnings * 18 + Math.round((intent.amount / Math.max(policy.maxPerPurchase, 1)) * 12));
  const decision: Decision = fails > 0 ? "BLOCK" : warnings > 0 ? "REVIEW" : "ALLOW";
  const assessment: RiskAssessment = {
    id: randomUUID(), intent, policy, decision, score, checks,
    summary: decision === "BLOCK" ? "Payment blocked by a hard safety boundary." : decision === "REVIEW" ? "Payment is valid but requires human approval." : "Payment is within the agent's delegated authority.",
    requiresHumanApproval: decision === "REVIEW",
    approved: decision === "ALLOW",
    consentPassed: false,
    consentQuestions: [
      { id: "today", prompt: "How much will PayPal charge today?", options: [`$${intent.amount.toFixed(2)}`, "$0.00", `$${(intent.amount * 2).toFixed(2)}`] },
      { id: "repeat", prompt: "Will this purchase create a repeating charge?", options: ["No, this is one-time", "Yes, it repeats", "The terms do not say"] },
      { id: "control", prompt: "Who can finally move the money?", options: ["The AI model", "PayPal after the approved checkout", "The merchant without approval"] }
    ],
    createdAt: new Date().toISOString()
  };
  consentAnswers.set(assessment.id, { today: 0, repeat: intent.recurring ? 1 : 0, control: 1 });
  assessments.set(assessment.id, assessment);
  return assessment;
}

export function getAssessment(id: string): RiskAssessment | undefined { return assessments.get(id); }

export function approveAssessment(id: string): RiskAssessment {
  const assessment = assessments.get(id);
  if (!assessment) throw new Error("Assessment not found");
  if (assessment.decision === "BLOCK") throw new Error("Blocked assessments cannot be approved");
  assessment.approved = true;
  return assessment;
}

export function submitConsent(id: string, answers: Record<string, number>): RiskAssessment {
  const assessment = assessments.get(id);
  const expected = consentAnswers.get(id);
  if (!assessment || !expected) throw new Error("Assessment not found");
  assessment.consentPassed = Object.entries(expected).every(([key, value]) => answers[key] === value);
  return assessment;
}

export function bindPayPalOrder(assessmentId: string, orderId: string): void {
  if (!assessments.has(assessmentId)) throw new Error("Assessment not found");
  const existing = paymentOrders.get(assessmentId);
  if (existing && existing.orderId !== orderId) throw new Error("Assessment is already bound to another PayPal order");
  paymentOrders.set(assessmentId, existing || { orderId, captured: false });
}

export function findAssessmentIdByOrder(orderId: string): string | undefined {
  for (const [assessmentId, payment] of paymentOrders) {
    if (payment.orderId === orderId) return assessmentId;
  }
  return undefined;
}

export function authorizeCapture(assessmentId: string, orderId: string): RiskAssessment {
  const assessment = assessments.get(assessmentId);
  if (!assessment?.approved || !assessment.consentPassed || assessment.decision === "BLOCK") {
    throw new Error("Payment authority or informed confirmation is missing");
  }
  const payment = paymentOrders.get(assessmentId);
  if (!payment || payment.orderId !== orderId) throw new Error("PayPal order does not belong to this assessment");
  if (payment.captured) throw new Error("PayPal order has already been captured");
  return assessment;
}

export function markPaymentCaptured(assessmentId: string, orderId: string): void {
  const assessment = authorizeCapture(assessmentId, orderId);
  paymentOrders.set(assessmentId, { orderId, captured: true });
  completedPurchaseFingerprints.add(purchaseFingerprint(assessment.intent));
}
