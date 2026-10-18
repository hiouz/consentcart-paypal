import { z } from "zod";
import { config } from "./config.js";
import type { PurchaseIntent } from "../shared/types.js";

const outputSchema = z.object({
  merchant: z.string().min(1).max(100),
  item: z.string().min(1).max(160),
  amount: z.number().positive().max(100000),
  currency: z.literal("USD"),
  recurring: z.boolean(),
  urgency: z.enum(["normal", "urgent"])
});

function demoAnalyze(objective: string): PurchaseIntent {
  const amountMatch = objective.match(/\$\s?(\d+(?:\.\d{1,2})?)/);
  const merchantMatch = objective.match(/(?:from|at|via)\s+([A-Za-z0-9 .&'-]{2,40})/i);
  return {
    objective,
    merchant: merchantMatch?.[1]?.replace(/\s+(?:for|under|with)\b.*$/i, "").trim() || "DesignCloud",
    item: /software|design/i.test(objective) ? "Design software workspace" : "Requested business purchase",
    amount: amountMatch ? Number(amountMatch[1]) : 79,
    currency: "USD",
    recurring: /subscription|monthly|recurring|per month|renew/i.test(objective),
    urgency: /urgent|immediately|right now|asap/i.test(objective) ? "urgent" : "normal"
  };
}

export async function analyzeObjective(objective: string): Promise<{ intent: PurchaseIntent; provider: string }> {
  if (config.aiProvider !== "openai" || !config.openAiKey) {
    return { intent: demoAnalyze(objective), provider: "transparent-demo-parser" };
  }
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${config.openAiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.openAiModel,
      response_format: { type: "json_object" },
      temperature: 0,
      messages: [
        { role: "system", content: "Extract a purchase request. Return JSON only with merchant, item, amount, currency='USD', recurring boolean, urgency='normal'|'urgent'. Never invent a higher amount than stated." },
        { role: "user", content: objective }
      ]
    })
  });
  if (!response.ok) throw new Error(`AI provider returned ${response.status}`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const parsed = outputSchema.parse(JSON.parse(payload.choices?.[0]?.message?.content || "{}"));
  return { intent: { objective, ...parsed }, provider: `openai:${config.openAiModel}` };
}
