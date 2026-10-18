# ConsentCart — Devpost submission copy

This file contains ready-to-paste text. Replace every `[ADD ...]` placeholder before submitting.

## Step 1 — Project overview

### Project name

ConsentCart

### Elevator pitch

ConsentCart reveals price and recurring commitments, checks that the buyer understood them, and only then allows an AI-assisted purchase to proceed through PayPal.

## Step 2 — Public project page

### About the project

## Inspiration

AI shopping agents can compare products and fill a cart, but a fluent recommendation is not the same thing as informed consent. A buyer can still miss a renewal, misunderstand what will be charged today, or give an agent more spending authority than intended. We built ConsentCart to place a clear checkpoint between an AI's interpretation and PayPal moving money.

## What it does

The buyer describes a purchase and sets firm limits: a maximum price, an automatic-approval threshold, approved merchants, and whether recurring charges are allowed. AI turns the request and purchase terms into a structured intent. ConsentCart then applies deterministic rules that the model cannot override.

Each purchase receives one of three decisions:

- **Allow** — the purchase is inside the buyer's delegated authority.
- **Review** — the purchase is permitted only after explicit human approval.
- **Block** — a hard limit, merchant restriction, or recurring-charge rule was violated.

Before checkout, the buyer answers three plain-language questions about the amount due now, whether the charge repeats, and who can finally move the money. A PayPal Sandbox order is created only when the policy decision and the buyer's answers agree.

ConsentCart also binds each PayPal order to the assessment that created it, rejects mismatched or repeated capture attempts, verifies PayPal webhook signatures, and records the decision trail in a hash chain so later changes are detectable.

## How we built it

The interface uses React, TypeScript, and Vite. An Express server keeps credentials and payment decisions away from the browser. OpenAI converts natural-language purchase details into schema-validated fields. Zod rejects malformed model or user input, while a separate policy engine owns authorization.

PayPal OAuth 2.0 supplies server credentials. PayPal Orders v2 creates and captures Sandbox orders, and `PayPal-Request-Id` makes retries idempotent. PayPal's webhook verification endpoint authenticates asynchronous payment events before ConsentCart records them.

## Challenges we faced

The hardest problem was preventing the AI from becoming its own approver. We separated interpretation from authority: the model can explain a purchase, but only server-side rules can approve it. We also had to make the redirect flow safe, so an approved assessment cannot be used to capture a different PayPal order.

## What we learned

Safe agentic commerce is not only a model-quality problem. It needs explicit authority, informed buyer confirmation, idempotent payment operations, and evidence of settlement. PayPal's order lifecycle gives the project a strong boundary between recommendation, buyer approval, and capture.

## Accomplishments that we're proud of

- A visible comprehension gate instead of a hidden consent checkbox.
- Clear allow, review, and block outcomes with an explanation for every rule.
- Server-side binding between an assessment and its PayPal order.
- Duplicate-capture and completed-payment duplicate defenses.
- Verified webhook handling and a tamper-evident audit trail.
- Ten automated tests, a clean production build, and no known production dependency vulnerabilities at the time of submission.

## What's next for ConsentCart

Next we would add durable multi-user storage, merchant-supplied checkout-term ingestion, expiring delegation grants, invoice matching, subscription monitoring, and multi-person approval for business purchasing teams.

### Built with tags

Use these tags:

`PayPal`, `PayPal Sandbox`, `Orders API`, `OAuth 2.0`, `Webhooks`, `OpenAI`, `TypeScript`, `React`, `Express`, `Zod`, `Vite`, `Vitest`, `Node.js`, `Render`

Remove `Render` if the final demo is hosted elsewhere.

### Try it out links

- Live demo: `[ADD DEPLOYED HTTPS URL]`
- Source code: `[ADD PUBLIC GITHUB URL]`

### Recommended gallery

Upload 3:2 PNG or JPG images, each under 5 MB:

1. ConsentCart landing page and purchase-policy controls.
2. A review decision with the reasons visible.
3. The three-question comprehension gate.
4. A recurring purchase blocked by policy.
5. A completed PayPal Sandbox flow and verified audit trail.

### Demo video plan — keep it near two minutes

1. **0:00–0:15:** State the problem: AI can understand a request but should not grant itself permission to spend.
2. **0:15–0:40:** Show the price limit, approved merchant, and recurring-charge rule.
3. **0:40–1:05:** Run the review scenario and show why it needs a human.
4. **1:05–1:25:** Answer one question incorrectly to show checkout remains paused, then answer correctly.
5. **1:25–1:50:** Create and approve the PayPal Sandbox order, return, and capture it.
6. **1:50–2:10:** Show the verified event chain and the blocked-renewal scenario.
7. **2:10–2:20:** Close with: “ConsentCart makes AI-assisted checkout understandable before PayPal makes it final.”

Upload the video to YouTube as public or unlisted with no password. Put the important proof inside the first three minutes.

## Step 3 — Additional information

### Optional file upload

Leave this empty unless you have a useful architecture PDF. Do not upload source code here; the public repository is required separately.

### Submitter type

Choose **Individual** if you built it alone. Choose **Team** only if another person materially contributed and is listed on the entry.

### Country, province, and organization

- Country: choose your actual country of residence.
- Canadian province: enter `N/A` if no team member lives in Canada.
- Organization: enter `N/A` if this is a personal entry.

### New or pre-existing

Choose **New project** if no version existed before October 1, 2026 at 9:15 AM PT.

For the follow-up explanation, enter:

`N/A — ConsentCart was started during the hackathon submission period.`

Only use that statement if it is true.

### Main technology requirement

ConsentCart uses the PayPal Developer Sandbox as its payment execution layer. The server uses PayPal OAuth 2.0 to obtain an access token, PayPal Orders v2 to create and capture an order after authorization and buyer confirmation, PayPal-Request-Id for idempotent retries, and PayPal's verify-webhook-signature API to authenticate payment events before recording them. OpenAI GPT-4.1 mini converts natural-language purchase requests and terms into structured merchant, item, amount, recurrence, and urgency fields. Zod validates that AI output, while deterministic server-side rules—not the model—make every payment decision.

### Additional sponsor tools

- Select **Render** only if the working demo is actually deployed on Render.
- If no listed optional sponsor is used, select **None, used other AI tools**.
- Do not select a sponsor merely because its name appears in a configuration file.

### Public repository

`[ADD PUBLIC GITHUB, GITLAB, OR BITBUCKET URL]`

Before pasting it, confirm the repository is public and contains `LICENSE` and `README.md`.

### Working demo

`[ADD PUBLIC HTTPS DEMO URL]`

### Testing instructions

Open the live demo and select **Needs review**. Click **Evaluate purchase**, inspect the reasons, and choose **Approve once**. First answer one comprehension question incorrectly to confirm that checkout remains paused. Then answer all three correctly. Click **Create PayPal order**, sign in with the provided PayPal Sandbox buyer account, approve the payment, and return to ConsentCart. The page should report a completed capture and show the hash-chained audit events. Finally, run **Blocked renewal** to see a recurring purchase stopped before PayPal is contacted.

Sandbox buyer email: `[ADD JUDGE-SAFE SANDBOX BUYER EMAIL]`

Sandbox buyer password: `[ADD JUDGE-SAFE SANDBOX BUYER PASSWORD]`

Never provide your PayPal Developer account password or API secret.

### PayPal integration rating and feedback

Choose the score that matches your real experience after the Sandbox flow has passed. A reasonable answer after a successful integration is **8/10**:

PayPal's OAuth and Orders v2 flow made the create, approve, and capture boundaries clear, and the Sandbox was useful for testing a complete buyer journey without real money. The most time-consuming part was connecting redirected order approval with webhook verification and keeping the local authorization state bound to the correct PayPal order. More end-to-end examples that combine Orders v2 redirects, capture, and webhook verification in one current TypeScript project would make onboarding faster.

Choose **Yes** or **No** for follow-up contact according to your preference.

### Optional sponsor feedback

Leave APIMatic and AG Grid feedback blank because ConsentCart does not use them.

### Eligibility checkboxes

Check each statement only if it is factually true for you and every team member. These are legal eligibility declarations, not project settings.

### AI tools used while building

`OpenAI GPT-4.1 mini for structured purchase-intent extraction; OpenAI Codex for implementation assistance, testing, debugging, and documentation.`

### Learning and career value

Recommended truthful selections if they match your experience:

- Learning derived: **A great deal / significant learning**.
- AI value for your career: **Yes**.

## Step 4

The supplied portal text ends immediately after the words “Step 4,” so its fields are not available in the upload. Do not guess or submit yet. Open Step 4 and capture its full screen or copy its text; then complete it from the actual fields shown.

Before the final submit action, verify that the public repository, live demo, PayPal Sandbox checkout, AI extraction, judge credentials, video, and all eligibility answers are complete.
