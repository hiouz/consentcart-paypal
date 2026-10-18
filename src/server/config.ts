import "dotenv/config";

export const config = {
  port: Number(process.env.PORT || 3001),
  publicUrl: process.env.PUBLIC_URL || "http://localhost:5173",
  paypalEnv: process.env.PAYPAL_ENV === "live" ? "live" : "sandbox",
  paypalClientId: process.env.PAYPAL_CLIENT_ID || "",
  paypalClientSecret: process.env.PAYPAL_CLIENT_SECRET || "",
  paypalWebhookId: process.env.PAYPAL_WEBHOOK_ID || "",
  aiProvider: process.env.AI_PROVIDER || "demo",
  openAiKey: process.env.OPENAI_API_KEY || "",
  openAiModel: process.env.OPENAI_MODEL || "gpt-4.1-mini"
} as const;

export const paypalBaseUrl = config.paypalEnv === "live"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";
