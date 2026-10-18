import { createHash, randomUUID } from "node:crypto";
import type { AuditEvent } from "../shared/types.js";

const events: AuditEvent[] = [];

export function appendAudit(assessmentId: string, type: string, detail: string): AuditEvent {
  const previous = [...events].reverse().find((event) => event.assessmentId === assessmentId);
  const event = {
    id: randomUUID(),
    assessmentId,
    type,
    detail,
    timestamp: new Date().toISOString(),
    previousHash: previous?.hash || "GENESIS"
  };
  const hash = createHash("sha256").update(JSON.stringify(event)).digest("hex");
  const complete = { ...event, hash };
  events.push(complete);
  return complete;
}

export function getAudit(assessmentId: string): AuditEvent[] {
  return events.filter((event) => event.assessmentId === assessmentId);
}

export function verifyAudit(assessmentId: string): boolean {
  const chain = getAudit(assessmentId);
  return chain.every((event, index) => {
    const { hash, ...unsigned } = event;
    const expectedPrevious = index === 0 ? "GENESIS" : chain[index - 1].hash;
    return unsigned.previousHash === expectedPrevious &&
      createHash("sha256").update(JSON.stringify(unsigned)).digest("hex") === hash;
  });
}
