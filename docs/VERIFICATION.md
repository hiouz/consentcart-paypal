# ConsentCart verification record

Last verified: October 18, 2026

## Proven locally

- TypeScript server and client checks pass.
- Five test files pass with 18 tests in total.
- Policy tests cover Allow, Review, Block, recurring-charge protection, merchant scope, consent, duplicate detection, order binding, and capture replay prevention.
- HTTP integration tests prove that approval and correct comprehension are required, blocked payments cannot be overridden, unbound PayPal orders are rejected, and health responses do not expose secrets.
- PayPal contract tests verify the Sandbox OAuth URL, Orders v2 create and capture URLs, assessment identifiers, amount formatting, return URL, stable `PayPal-Request-Id` values, and webhook-verification payload.
- AI tests verify the transparent demonstration parser and schema validation of structured OpenAI output.
- The production Vite and TypeScript build completes successfully.
- The production dependency audit reports zero known vulnerabilities.
- A headless Chromium journey passes on desktop and a 390-pixel mobile viewport. It covers Review, explicit approval, failed comprehension, successful comprehension, disabled payment without credentials, and a Block decision with no override button.
- The audit hash chain verifies after sequential events.

## Not yet proven with external services

- A real OpenAI request using the deployed `OPENAI_API_KEY`.
- PayPal Sandbox OAuth using the project's real Sandbox client ID and secret.
- PayPal Sandbox order creation, buyer approval, return, and capture.
- Delivery and successful verification of a real PayPal webhook.
- Behavior after a hosting restart. The hackathon prototype stores assessments in memory, so a production version should use durable storage.

These items must pass before the Devpost entry is finally submitted. Mocked contract tests prove the request shapes and safety gates, but they are not a substitute for a completed Sandbox transaction.

## Repeat the local verification

```bash
npm ci
npm run check
npm run build
npm audit --omit=dev
```
