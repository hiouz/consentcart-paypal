import { useEffect, useMemo, useState } from "react";
import type { AuditEvent, Policy, RiskAssessment } from "../shared/types";

const initialPolicy: Policy = {
  maxPerPurchase: 100,
  autoApproveBelow: 50,
  allowedMerchants: ["DesignCloud"],
  blockRecurring: true,
  requireApprovalWhenUrgent: true
};

const scenarios = [
  { label: "Safe purchase", value: "Purchase a one-time design software workspace from DesignCloud for $39." },
  { label: "Needs review", value: "Purchase design software from DesignCloud for $79." },
  { label: "Blocked renewal", value: "Urgently purchase a monthly design software subscription from DesignCloud for $29." }
];

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body as T;
}

export default function App() {
  const [objective, setObjective] = useState(scenarios[1].value);
  const [policy, setPolicy] = useState(initialPolicy);
  const [assessment, setAssessment] = useState<RiskAssessment | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [verified, setVerified] = useState(false);
  const [provider, setProvider] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [paypalConfigured, setPaypalConfigured] = useState(false);
  const [order, setOrder] = useState<{ orderId: string; approvalUrl?: string } | null>(null);
  const [captureMessage, setCaptureMessage] = useState("");
  const [answers, setAnswers] = useState<Record<string, number>>({});

  useEffect(() => { api<{ paypalConfigured: boolean }>("/api/health").then((r) => setPaypalConfigured(r.paypalConfigured)).catch(() => {}); }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("token");
    const assessmentId = localStorage.getItem("consentcart-assessment-id");
    if (window.location.pathname === "/checkout/cancel") setCaptureMessage("PayPal checkout was cancelled. No payment was captured.");
    if (window.location.pathname === "/checkout/return" && orderId && assessmentId) {
      setCaptureMessage("Verifying and capturing the approved PayPal order…");
      api<{ capture: { status: string } }>(`/api/paypal/orders/${encodeURIComponent(orderId)}/capture`, { method: "POST", body: JSON.stringify({ assessmentId }) })
        .then((result) => {
          setCaptureMessage(`Payment verified: PayPal order is ${result.capture.status}.`);
          localStorage.removeItem("consentcart-assessment-id");
          history.replaceState({}, "", "/");
        })
        .catch((e) => setCaptureMessage(e instanceof Error ? e.message : "Capture could not be verified."));
    }
  }, []);
  useEffect(() => {
    if (!assessment) return;
    api<{ events: AuditEvent[]; verified: boolean }>(`/api/assessments/${assessment.id}/audit`).then((r) => { setEvents(r.events); setVerified(r.verified); });
  }, [assessment]);

  const meter = useMemo(() => Math.min(100, assessment?.score || 0), [assessment]);

  async function analyze() {
    setBusy(true); setError(""); setOrder(null); setAnswers({});
    try {
      const result = await api<{ assessment: RiskAssessment; provider: string }>("/api/analyze", { method: "POST", body: JSON.stringify({ objective, policy }) });
      setAssessment(result.assessment); setProvider(result.provider);
    } catch (e) { setError(e instanceof Error ? e.message : "Analysis failed"); }
    finally { setBusy(false); }
  }

  async function approve() {
    if (!assessment) return;
    setBusy(true); setError("");
    try { setAssessment((await api<{ assessment: RiskAssessment }>(`/api/assessments/${assessment.id}/approve`, { method: "POST" })).assessment); }
    catch (e) { setError(e instanceof Error ? e.message : "Approval failed"); }
    finally { setBusy(false); }
  }

  async function createPaypalOrder() {
    if (!assessment) return;
    setBusy(true); setError("");
    try {
      const created = await api<{ orderId: string; approvalUrl?: string }>(`/api/assessments/${assessment.id}/paypal-order`, { method: "POST" });
      localStorage.setItem("consentcart-assessment-id", assessment.id);
      setOrder(created);
    }
    catch (e) { setError(e instanceof Error ? e.message : "PayPal order failed"); }
    finally { setBusy(false); }
  }

  async function confirmUnderstanding() {
    if (!assessment) return;
    setBusy(true); setError("");
    try { setAssessment((await api<{ assessment: RiskAssessment }>(`/api/assessments/${assessment.id}/consent`, { method: "POST", body: JSON.stringify({ answers }) })).assessment); }
    catch (e) { setError(e instanceof Error ? e.message : "Confirmation failed"); }
    finally { setBusy(false); }
  }

  return <div className="shell">
    <header>
      <a className="brand" href="#top"><span className="brandMark">CC</span><span>ConsentCart</span></a>
      <div className="status"><span className={paypalConfigured ? "dot live" : "dot"}/>{paypalConfigured ? "PayPal Sandbox connected" : "Safe demo mode"}</div>
    </header>

    <main id="top">
      {captureMessage && <div className="captureBanner">{captureMessage}</div>}
      <section className="hero">
        <div className="eyebrow">INFORMED CHECKOUT FOR AGENTIC COMMERCE</div>
        <h1>Understand first.<br/><span>Then let PayPal move.</span></h1>
        <p>ConsentCart exposes hidden commitments, checks that the buyer understands them, and creates a PayPal order only after intent and consent agree.</p>
        <div className="proof"><span>01 Read terms</span><i/> <span>02 Expose risk</span><i/> <span>03 Confirm</span><i/> <span>04 PayPal</span><i/> <span>05 Receipt</span></div>
      </section>

      <section className="workspace">
        <div className="panel requestPanel">
          <div className="panelHead"><div><span className="step">01</span><h2>Delegate a purchase</h2></div><span className="tag">Natural language</span></div>
          <label>Agent objective</label>
          <textarea value={objective} onChange={(e) => setObjective(e.target.value)} aria-label="Agent objective" />
          <div className="scenarioRow">{scenarios.map((s) => <button key={s.label} className="chip" onClick={() => setObjective(s.value)}>{s.label}</button>)}</div>
          <div className="policyGrid">
            <label>Hard limit <div className="money"><span>$</span><input type="number" value={policy.maxPerPurchase} onChange={(e) => setPolicy({ ...policy, maxPerPurchase: Number(e.target.value) })}/></div></label>
            <label>Agent authority <div className="money"><span>$</span><input type="number" value={policy.autoApproveBelow} onChange={(e) => setPolicy({ ...policy, autoApproveBelow: Number(e.target.value) })}/></div></label>
          </div>
          <label>Allowed merchants<input value={policy.allowedMerchants.join(", ")} onChange={(e) => setPolicy({ ...policy, allowedMerchants: e.target.value.split(",").map((v) => v.trim()).filter(Boolean) })}/></label>
          <label className="toggle"><input type="checkbox" checked={policy.blockRecurring} onChange={(e) => setPolicy({ ...policy, blockRecurring: e.target.checked })}/><span/> Block recurring charges</label>
          <button className="primary" disabled={busy || objective.length < 10} onClick={analyze}>{busy ? "Evaluating…" : "Evaluate purchase →"}</button>
          {error && <div className="error">{error}</div>}
        </div>

        <div className="panel resultPanel">
          <div className="panelHead"><div><span className="step">02</span><h2>Decision trace</h2></div>{assessment && <span className={`decision ${assessment.decision.toLowerCase()}`}>{assessment.decision}</span>}</div>
          {!assessment ? <div className="empty"><div className="radar"><span/></div><h3>No transaction evaluated</h3><p>Choose a scenario or describe a purchase to see the safety engine work.</p></div> : <>
            <div className="riskLine"><div><small>RISK SCORE</small><strong>{assessment.score}<em>/100</em></strong></div><div className="meter"><span style={{ width: `${meter}%` }}/></div></div>
            <p className="summary">{assessment.summary}</p>
            <div className="intentCard"><div><small>MERCHANT</small><b>{assessment.intent.merchant}</b></div><div><small>AMOUNT</small><b>${assessment.intent.amount.toFixed(2)}</b></div><div><small>COMMITMENT</small><b>{assessment.intent.recurring ? "Recurring" : "One-time"}</b></div></div>
            <div className="checks">{assessment.checks.map((check) => <div className="check" key={check.id}><span className={check.status}>{check.status === "pass" ? "✓" : check.status === "warn" ? "!" : "×"}</span><div><b>{check.label}</b><p>{check.explanation}</p></div></div>)}</div>
            {assessment.approved && !assessment.consentPassed && <div className="consentQuiz"><h3>Confirm what you understand</h3><p>Checkout pauses until all three answers match the terms.</p>{assessment.consentQuestions.map((question) => <fieldset key={question.id}><legend>{question.prompt}</legend>{question.options.map((option, index) => <label key={option} className="quizOption"><input type="radio" name={question.id} checked={answers[question.id] === index} onChange={() => setAnswers({ ...answers, [question.id]: index })}/><span>{option}</span></label>)}</fieldset>)}<button className="approve" disabled={busy || Object.keys(answers).length !== assessment.consentQuestions.length} onClick={confirmUnderstanding}>Confirm understanding</button></div>}
            {assessment.approved && assessment.consentPassed && <div className="consentOk">✓ Price, commitment and payment boundary understood</div>}
            <div className="actions">
              {assessment.requiresHumanApproval && !assessment.approved && <button className="approve" onClick={approve} disabled={busy}>Approve once</button>}
              {assessment.approved && assessment.consentPassed && assessment.decision !== "BLOCK" && <button className="paypal" onClick={createPaypalOrder} disabled={busy || !paypalConfigured}>Create PayPal order</button>}
              {!paypalConfigured && assessment.approved && <p className="hint">Add Sandbox credentials to enable a real PayPal order. All safety logic remains active.</p>}
              {order?.approvalUrl && <a className="approvalLink" target="_blank" rel="noreferrer" href={order.approvalUrl}>Continue in PayPal Sandbox ↗</a>}
            </div>
          </>}
        </div>
      </section>

      <section className="audit panel">
        <div className="panelHead"><div><span className="step">03</span><h2>Proof, not promises</h2></div><span className={verified ? "verified" : "tag"}>{verified ? "✓ Chain verified" : "Awaiting events"}</span></div>
        <p>Every decision and payment event is chained to the one before it. A changed record breaks verification.</p>
        <div className="timeline">{events.length ? events.map((event, i) => <div className="event" key={event.id}><span>{String(i + 1).padStart(2, "0")}</span><div><b>{event.type.replaceAll("_", " ")}</b><p>{event.detail}</p><code>{event.hash.slice(0, 18)}…</code></div></div>) : <div className="noEvents">Your verifiable audit trail will appear here.</div>}</div>
      </section>

      <section className="principles"><article><span>BOUND</span><h3>Authority has edges</h3><p>Budgets, merchants and commitment types are enforced in code—not entrusted to a prompt.</p></article><article><span>EXPLAIN</span><h3>Every decision has a reason</h3><p>Users see the exact check that allowed, escalated or blocked a purchase.</p></article><article><span>PROVE</span><h3>Settlement is verified</h3><p>OAuth, idempotent Orders v2 calls and signed webhooks establish what actually happened.</p></article></section>
    </main>
    <footer><span>ConsentCart</span><p>Built for the PayPal AI Hackathon · Sandbox transactions only</p><span className="provider">AI: {provider || "ready"}</span></footer>
  </div>;
}
