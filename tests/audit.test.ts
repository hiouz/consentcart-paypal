import { describe, expect, it } from "vitest";
import { appendAudit, getAudit, verifyAudit } from "../src/server/audit.js";

describe("audit hash chain", () => {
  it("links and verifies sequential events", () => {
    const id = crypto.randomUUID();
    appendAudit(id, "CREATED", "Intent created");
    appendAudit(id, "APPROVED", "Human approved");
    const events = getAudit(id);
    expect(events[1].previousHash).toBe(events[0].hash);
    expect(verifyAudit(id)).toBe(true);
  });
});
