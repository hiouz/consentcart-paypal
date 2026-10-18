import express from "express";
import path from "node:path";
import { z } from "zod";
import { config } from "./config.js";
import { analyzeObjective } from "./ai.js";
import { approveAssessment, authorizeCapture, bindPayPalOrder, evaluatePurchase, findAssessmentIdByOrder, getAssessment, markPaymentCaptured, submitConsent } from "./policy.js";
import { appendAudit, getAudit, verifyAudit } from "./audit.js";
import { captureOrder, createOrder, isConfigured, verifyWebhook } from "./paypal.js";

export const app = express();
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});
app.use(express.json({ limit: "200kb" }));
const processedWebhookIds = new Set<string>();

const analyzeSchema = z.object({
  objective: z.string().min(10).max(1000),
  policy: z.object({
    maxPerPurchase: z.number().positive().max(100000),
    autoApproveBelow: z.number().min(0).max(100000),
    allowedMerchants: z.array(z.string().min(1).max(100)).max(25),
    blockRecurring: z.boolean(),
    requireApprovalWhenUrgent: z.boolean()
  })
});

app.get("/api/health", (_req, res) => res.json({ ok: true, paypalConfigured: isConfigured(), aiProvider: config.aiProvider }));

app.post("/api/analyze", async (req, res, next) => {
  try {
    const input = analyzeSchema.parse(req.body);
    if (input.policy.autoApproveBelow > input.policy.maxPerPurchase) {
      return res.status(400).json({ error: "Auto-approval threshold cannot exceed the hard purchase limit." });
    }
    const { intent, provider } = await analyzeObjective(input.objective);
    const assessment = evaluatePurchase(intent, input.policy);
    appendAudit(assessment.id, "INTENT_PARSED", `Purchase intent extracted by ${provider}.`);
    appendAudit(assessment.id, "POLICY_EVALUATED", `${assessment.decision} at risk score ${assessment.score}.`);
    res.json({ assessment, provider });
  } catch (error) { next(error); }
});

app.post("/api/assessments/:id/approve", (req, res, next) => {
  try {
    const assessment = approveAssessment(req.params.id);
    appendAudit(assessment.id, "HUMAN_APPROVED", "A human explicitly approved the reviewed transaction.");
    res.json({ assessment });
  } catch (error) { next(error); }
});

app.post("/api/assessments/:id/consent", (req, res, next) => {
  try {
    const answers = z.record(z.string(), z.number().int().min(0).max(5)).parse(req.body.answers);
    const assessment = submitConsent(req.params.id, answers);
    appendAudit(assessment.id, assessment.consentPassed ? "COMPREHENSION_CONFIRMED" : "COMPREHENSION_FAILED", assessment.consentPassed ? "Buyer correctly confirmed the price, commitment and payment boundary." : "Checkout paused because the buyer's answers did not match the purchase terms.");
    res.json({ assessment });
  } catch (error) { next(error); }
});

app.get("/api/assessments/:id/audit", (req, res) => {
  res.json({ events: getAudit(req.params.id), verified: verifyAudit(req.params.id) });
});

app.post("/api/assessments/:id/paypal-order", async (req, res, next) => {
  try {
    const assessment = getAssessment(req.params.id);
    if (!assessment) return res.status(404).json({ error: "Assessment not found" });
    if (assessment.decision === "BLOCK" || !assessment.approved || !assessment.consentPassed) return res.status(409).json({ error: "Payment requires both authority and confirmed understanding." });
    appendAudit(assessment.id, "PAYPAL_ORDER_REQUESTED", "Server revalidated authority before contacting PayPal.");
    const order = await createOrder({
      assessmentId: assessment.id,
      item: assessment.intent.item,
      amount: assessment.intent.amount,
      currency: assessment.intent.currency
    }) as { id: string; status: string; links?: Array<{ rel: string; href: string }> };
    bindPayPalOrder(assessment.id, order.id);
    appendAudit(assessment.id, "PAYPAL_ORDER_CREATED", `PayPal Sandbox order ${order.id} created with status ${order.status}.`);
    res.json({ orderId: order.id, status: order.status, approvalUrl: order.links?.find((link) => link.rel === "payer-action" || link.rel === "approve")?.href });
  } catch (error) { next(error); }
});

app.post("/api/paypal/orders/:orderId/capture", async (req, res, next) => {
  try {
    const assessmentId = z.string().uuid().parse(req.body.assessmentId);
    authorizeCapture(assessmentId, req.params.orderId);
    const capture = await captureOrder(req.params.orderId) as { id: string; status: string };
    if (capture.status === "COMPLETED") markPaymentCaptured(assessmentId, req.params.orderId);
    appendAudit(assessmentId, "PAYPAL_PAYMENT_CAPTURED", `PayPal order ${capture.id} reached ${capture.status}.`);
    res.json({ capture });
  } catch (error) { next(error); }
});

app.post("/api/paypal/webhook", async (req, res, next) => {
  try {
    const headers = Object.fromEntries(Object.entries(req.headers).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
    const verification = await verifyWebhook(headers, req.body);
    if (verification.verification_status !== "SUCCESS") return res.status(400).json({ error: "Invalid PayPal webhook signature" });
    const event = req.body as {
      id?: string;
      event_type?: string;
      resource?: {
        id?: string;
        custom_id?: string;
        purchase_units?: Array<{ custom_id?: string }>;
        supplementary_data?: { related_ids?: { order_id?: string } };
      };
    };
    if (event.id && processedWebhookIds.has(event.id)) return res.sendStatus(204);
    const orderId = event.resource?.supplementary_data?.related_ids?.order_id || event.resource?.id;
    const assessmentId = event.resource?.custom_id || event.resource?.purchase_units?.[0]?.custom_id || (orderId ? findAssessmentIdByOrder(orderId) : undefined);
    if (assessmentId) appendAudit(assessmentId, "VERIFIED_WEBHOOK", `Verified ${event.event_type || "PayPal event"}.`);
    if (event.id) processedWebhookIds.add(event.id);
    res.sendStatus(204);
  } catch (error) { next(error); }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof z.ZodError ? error.issues.map((issue) => issue.message).join("; ") : error instanceof Error ? error.message : "Unexpected error";
  console.error(error);
  const status = error instanceof z.ZodError
    ? 400
    : /not found/i.test(message)
      ? 404
      : /cannot|missing|does not belong|already been captured/i.test(message)
        ? 409
        : 500;
  res.status(status).json({ error: message });
});

const publicPath = path.resolve(process.cwd(), "dist/public");
app.use(express.static(publicPath));
app.get("/{*splat}", (_req, res) => res.sendFile(path.join(publicPath, "index.html")));

if (process.env.NODE_ENV !== "test" && process.env.VITEST !== "true") {
  app.listen(config.port, () => console.log(`ConsentCart listening on http://localhost:${config.port}`));
}
