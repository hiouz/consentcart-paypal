import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  delete process.env.AI_PROVIDER;
  delete process.env.OPENAI_API_KEY;
});

describe("AI intent extraction", () => {
  it("parses amount, merchant, recurrence and urgency in safe demo mode", async () => {
    process.env.AI_PROVIDER = "demo";
    const { analyzeObjective } = await import("../src/server/ai.js");
    const result = await analyzeObjective("Urgently buy a monthly design subscription from DesignCloud for $29.");
    expect(result.provider).toBe("transparent-demo-parser");
    expect(result.intent).toMatchObject({ merchant: "DesignCloud", amount: 29, recurring: true, urgency: "urgent" });
  });

  it("schema-validates structured OpenAI output", async () => {
    process.env.AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ merchant: "DesignCloud", item: "Workspace", amount: 39, currency: "USD", recurring: false, urgency: "normal" }) } }]
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const { analyzeObjective } = await import("../src/server/ai.js");
    const result = await analyzeObjective("Purchase a one-time workspace from DesignCloud for $39.");
    expect(result.provider).toMatch(/^openai:/);
    expect(result.intent.amount).toBe(39);
    const request = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(request.response_format).toEqual({ type: "json_object" });
    expect(request.temperature).toBe(0);
  });
});
