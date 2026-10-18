import { randomUUID } from "node:crypto";
import { config, paypalBaseUrl } from "./config.js";

async function accessToken(): Promise<string> {
  if (!config.paypalClientId || !config.paypalClientSecret) throw new Error("PayPal Sandbox credentials are not configured");
  const auth = Buffer.from(`${config.paypalClientId}:${config.paypalClientSecret}`).toString("base64");
  const response = await fetch(`${paypalBaseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials"
  });
  if (!response.ok) throw new Error(`PayPal authentication failed (${response.status})`);
  return ((await response.json()) as { access_token: string }).access_token;
}

async function paypalRequest(path: string, init: RequestInit, requestId?: string) {
  const token = await accessToken();
  const response = await fetch(`${paypalBaseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(requestId ? { "PayPal-Request-Id": requestId } : {}),
      ...(init.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`PayPal request failed (${response.status}): ${JSON.stringify(payload)}`);
  return payload;
}

export function isConfigured() { return Boolean(config.paypalClientId && config.paypalClientSecret); }

export async function createOrder(input: { assessmentId: string; item: string; amount: number; currency: string }) {
  return paypalRequest("/v2/checkout/orders", {
    method: "POST",
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{
        reference_id: input.assessmentId,
        custom_id: input.assessmentId,
        description: input.item,
        amount: { currency_code: input.currency, value: input.amount.toFixed(2) }
      }],
      payment_source: {
        paypal: {
          experience_context: {
            user_action: "PAY_NOW",
            return_url: `${config.publicUrl}/checkout/return`,
            cancel_url: `${config.publicUrl}/checkout/cancel`
          }
        }
      }
    })
  }, `consentcart-create-${input.assessmentId}`);
}

export async function captureOrder(orderId: string) {
  return paypalRequest(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, { method: "POST", body: "{}" }, `consentcart-capture-${orderId}`);
}

export async function verifyWebhook(headers: Record<string, string | undefined>, event: unknown) {
  if (!config.paypalWebhookId) throw new Error("PAYPAL_WEBHOOK_ID is not configured");
  const required = ["paypal-transmission-id", "paypal-transmission-time", "paypal-cert-url", "paypal-auth-algo", "paypal-transmission-sig"] as const;
  for (const name of required) if (!headers[name]) throw new Error(`Missing ${name} header`);
  return paypalRequest("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: JSON.stringify({
      transmission_id: headers["paypal-transmission-id"],
      transmission_time: headers["paypal-transmission-time"],
      cert_url: headers["paypal-cert-url"],
      auth_algo: headers["paypal-auth-algo"],
      transmission_sig: headers["paypal-transmission-sig"],
      webhook_id: config.paypalWebhookId,
      webhook_event: event
    })
  }, randomUUID()) as Promise<{ verification_status: string }>;
}
