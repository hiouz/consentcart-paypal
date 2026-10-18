export type Decision = "ALLOW" | "REVIEW" | "BLOCK";

export interface PurchaseIntent {
  objective: string;
  merchant: string;
  item: string;
  amount: number;
  currency: "USD";
  recurring: boolean;
  urgency: "normal" | "urgent";
}

export interface Policy {
  maxPerPurchase: number;
  autoApproveBelow: number;
  allowedMerchants: string[];
  blockRecurring: boolean;
  requireApprovalWhenUrgent: boolean;
}

export interface CheckResult {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  explanation: string;
}

export interface RiskAssessment {
  id: string;
  intent: PurchaseIntent;
  policy: Policy;
  decision: Decision;
  score: number;
  checks: CheckResult[];
  summary: string;
  requiresHumanApproval: boolean;
  approved: boolean;
  consentPassed: boolean;
  consentQuestions: Array<{ id: string; prompt: string; options: string[] }>;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  assessmentId: string;
  type: string;
  detail: string;
  timestamp: string;
  previousHash: string;
  hash: string;
}
