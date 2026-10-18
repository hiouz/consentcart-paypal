# ConsentCart demo video script

Target length: 2 minutes 20 seconds. Record the deployed application at 1080p and upload the result to YouTube as unlisted or public.

## 0:00–0:15 — The problem

“AI can recommend a purchase, but understanding a request is not permission to spend. ConsentCart adds informed consent between an AI shopping decision and PayPal.”

Show the landing page and the five-stage flow.

## 0:15–0:38 — Delegated authority

“The buyer sets hard limits: maximum spend, automatic-approval authority, allowed merchants, and whether recurring charges are permitted. These rules run in application code, outside the AI model.”

Point to the policy controls.

## 0:38–1:00 — Explainable review

Select **Needs review**, then select **Evaluate purchase**.

“OpenAI converts the request into structured purchase details. ConsentCart independently checks those details. This purchase is valid, but it exceeds the agent's automatic authority, so it requires a human.”

Show the Review result and its reasons.

## 1:00–1:25 — Comprehension gate

Select **Approve once**.

“Approval alone is not enough. The buyer must identify the amount due today, whether the charge repeats, and who can finally move the money.”

Choose one wrong answer and submit it.

“A wrong answer keeps checkout paused.”

Then answer all three correctly.

## 1:25–1:50 — Real PayPal Sandbox checkout

Select **Create PayPal order**, approve it with the judge-safe Sandbox buyer account, and return to ConsentCart.

“Only now does the server create the PayPal order. After buyer approval, ConsentCart verifies that the returned order belongs to this assessment and captures it once. PayPal webhook signatures are verified before events enter the audit record.”

Show the completed status and payment event. Do not edit or simulate this section.

## 1:50–2:08 — Hard block

Select **Blocked renewal**, then **Evaluate purchase**.

“This monthly purchase conflicts with the buyer's no-subscription rule. It is blocked before PayPal is contacted, and no human override is offered.”

## 2:08–2:20 — Closing

Show the audit trail.

“ConsentCart makes AI-assisted checkout understandable before PayPal makes it final.”
