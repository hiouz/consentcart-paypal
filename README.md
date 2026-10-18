# ConsentCart

ConsentCart is an informed-checkout layer for agentic commerce. It converts confusing purchase terms into structured intent, exposes price and recurring commitments, checks that the buyer understood the transaction, and only then creates an authorized PayPal Sandbox order.

The important design choice is separation of powers: an AI model may explain what the user is buying, but it cannot grant itself payment authority or declare that the buyer understood. Server-side policy and comprehension checks independently decide whether checkout can continue.

## What the demo proves

1. **Intent extraction** — AI converts a purchasing objective into merchant, item, amount, commitment type and urgency.
2. **Bounded authority** — hard budget, merchant allowlist, recurring-charge and urgency policies are enforced outside the model.
3. **Comprehension gate** — the buyer confirms the amount, recurring commitment and payment boundary before PayPal can be called.
4. **Risk escalation** — safe purchases proceed, ambiguous purchases require one-time human approval, and prohibited purchases cannot proceed.
5. **PayPal execution** — the server obtains OAuth credentials, creates an idempotent Orders v2 request, redirects the buyer for Sandbox approval and captures only after approval.
6. **Settlement proof** — PayPal webhooks are verified before processing.
7. **Consent proof** — each confirmation and payment event is hash-chained to the preceding event, making silent audit-history alteration detectable.

## Architecture

```text
User objective
     │
     ▼
AI intent extraction ──► structured purchase intent
                              │
                              ▼
                    deterministic policy engine
                       │          │          │
                     ALLOW      REVIEW     BLOCK
                       │          │          ╳
                       │     human approval
                       └──────────┬──────────┘
                                  ▼
                         PayPal Orders v2
                     create → approve → capture
                                  │
                                  ▼
                   verified webhook + audit chain
```

## Run locally

Requirements: Node.js 22 or newer and a PayPal Developer Sandbox application.

```bash
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`.

The application runs in safe demonstration mode without credentials. In this mode it shows all policy outcomes but cannot create a PayPal order. To demonstrate the complete payment lifecycle, configure the variables below.

## Configuration

```dotenv
PORT=3001
PUBLIC_URL=http://localhost:5173
PAYPAL_ENV=sandbox
PAYPAL_CLIENT_ID=your_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_sandbox_secret
PAYPAL_WEBHOOK_ID=your_registered_webhook_id
AI_PROVIDER=openai
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-4.1-mini
```

Never commit `.env`. PayPal credentials and the AI key are used only by the server.

For webhooks, register this HTTPS endpoint in the PayPal Developer Dashboard:

```text
https://YOUR-PUBLIC-HOST/api/paypal/webhook
```

Subscribe at minimum to checkout-order approved and payment-capture completed/denied events. Store the resulting webhook ID as `PAYPAL_WEBHOOK_ID`.

## Production build

```bash
npm run check
npm run build
npm start
```

Set `PUBLIC_URL` to the deployed HTTPS origin. The Express server serves both the API and the compiled interface.

## Security boundaries

- PayPal secrets never reach the browser.
- The server re-fetches the stored assessment before order creation and capture.
- Every PayPal order is bound to the assessment that created it; a different or already-captured order is rejected.
- A blocked assessment cannot be manually approved.
- `PayPal-Request-Id` makes create and capture operations idempotent.
- Webhook events are ignored unless PayPal verifies their signature.
- AI output is schema-validated and treated as untrusted input.
- Raw card data is never collected or processed by ConsentCart.
- All real-money use is intentionally disabled; the project targets PayPal Sandbox.

## Tests

```bash
npm test
```

The current suite covers allowed, review, budget-block, subscription-block and merchant-block outcomes, consent, order-to-assessment binding, capture replay prevention, completed-payment duplicate detection, audit-chain integrity, HTTP authorization gates, structured AI extraction, and the outbound PayPal create/capture/webhook contracts.

## Hackathon disclosure

Built for the PayPal AI Hackathon. PayPal Orders v2 and PayPal Sandbox are central to the transaction lifecycle. An OpenAI-compatible model performs structured intent extraction; deterministic application code owns authorization. Codex assisted with implementation, testing and documentation.

## License

MIT
