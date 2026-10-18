import { afterEach, describe, expect, it, vi } from "vitest";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  delete process.env.PAYPAL_CLIENT_ID;
  delete process.env.PAYPAL_CLIENT_SECRET;
  delete process.env.PAYPAL_WEBHOOK_ID;
  delete process.env.PUBLIC_URL;
});

describe("PayPal API contract", () => {
  it("creates a bound idempotent Sandbox order with the expected amount and redirect URLs", async () => {
    process.env.PAYPAL_CLIENT_ID = "sandbox-client";
    process.env.PAYPAL_CLIENT_SECRET = "sandbox-secret";
    process.env.PUBLIC_URL = "https://consentcart.example";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "sandbox-token" }))
      .mockResolvedValueOnce(jsonResponse({ id: "ORDER-123", status: "CREATED" }, 201));
    vi.stubGlobal("fetch", fetchMock);

    const { createOrder } = await import("../src/server/paypal.js");
    await createOrder({ assessmentId: "assessment-123", item: "Design software", amount: 79, currency: "USD" });

    expect(fetchMock.mock.calls[0][0]).toBe("https://api-m.sandbox.paypal.com/v1/oauth2/token");
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("https://api-m.sandbox.paypal.com/v2/checkout/orders");
    expect((init.headers as Record<string, string>)["PayPal-Request-Id"]).toBe("consentcart-create-assessment-123");
    const payload = JSON.parse(init.body as string);
    expect(payload.purchase_units[0]).toMatchObject({
      reference_id: "assessment-123",
      custom_id: "assessment-123",
      amount: { currency_code: "USD", value: "79.00" }
    });
    expect(payload.payment_source.paypal.experience_context.return_url).toBe("https://consentcart.example/checkout/return");
  });

  it("captures using a stable idempotency key", async () => {
    process.env.PAYPAL_CLIENT_ID = "sandbox-client";
    process.env.PAYPAL_CLIENT_SECRET = "sandbox-secret";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "sandbox-token" }))
      .mockResolvedValueOnce(jsonResponse({ id: "ORDER-123", status: "COMPLETED" }));
    vi.stubGlobal("fetch", fetchMock);

    const { captureOrder } = await import("../src/server/paypal.js");
    await captureOrder("ORDER-123");
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("https://api-m.sandbox.paypal.com/v2/checkout/orders/ORDER-123/capture");
    expect((init.headers as Record<string, string>)["PayPal-Request-Id"]).toBe("consentcart-capture-ORDER-123");
  });

  it("posts every required field to PayPal webhook verification", async () => {
    process.env.PAYPAL_CLIENT_ID = "sandbox-client";
    process.env.PAYPAL_CLIENT_SECRET = "sandbox-secret";
    process.env.PAYPAL_WEBHOOK_ID = "WH-123";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "sandbox-token" }))
      .mockResolvedValueOnce(jsonResponse({ verification_status: "SUCCESS" }));
    vi.stubGlobal("fetch", fetchMock);

    const { verifyWebhook } = await import("../src/server/paypal.js");
    const event = { id: "WH-EVENT", event_type: "PAYMENT.CAPTURE.COMPLETED" };
    await verifyWebhook({
      "paypal-transmission-id": "transmission",
      "paypal-transmission-time": "2026-10-18T00:00:00Z",
      "paypal-cert-url": "https://api-m.sandbox.paypal.com/cert",
      "paypal-auth-algo": "SHA256withRSA",
      "paypal-transmission-sig": "signature"
    }, event);
    const payload = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string);
    expect(payload).toMatchObject({
      transmission_id: "transmission",
      transmission_time: "2026-10-18T00:00:00Z",
      webhook_id: "WH-123",
      webhook_event: event
    });
  });
});
