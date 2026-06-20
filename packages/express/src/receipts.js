function receiptIdFrom({ actor, ts }) {
  const actorPart = [
    actor?.ip || "unknown",
    actor?.method || "GET",
    actor?.path || "/",
  ]
    .join(":")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  const tsPart = ts.replace(/[^0-9]/g, "");

  return `receipt_${tsPart}_${actorPart || "unknown"}`;
}

function summarizeAction(actor) {
  const method = actor?.method || "GET";
  const path = actor?.path || "/";

  return `${method} ${path}`;
}

function normalizeHit(hit) {
  return {
    ruleId: hit.ruleId,
    ...(hit.title ? { title: hit.title } : {}),
    ...(hit.severity ? { severity: hit.severity } : {}),
    ...(hit.eventType ? { eventType: hit.eventType } : {}),
    flags: hit.flags || [],
    scoreContribution: hit.scoreContribution || 0,
    suggestedAction: hit.suggestedAction || "log",
  };
}

export function createAgentActionReceipt({
  events,
  outcome,
  now = () => new Date(),
} = {}) {
  const observedEvents = events || [];
  const firstEvent = observedEvents[0] || {};
  const actor = firstEvent.actor || {
    ip: "unknown",
    userAgent: "unknown",
    method: "GET",
    path: "/",
  };
  const ts = now().toISOString();
  const summary = summarizeAction(actor);

  return {
    type: "agent_action_receipt",
    receiptId: receiptIdFrom({ actor, ts }),
    ts,
    actor,
    action: {
      kind: "api_request",
      target: {
        type: "http_route",
        name: summary,
        method: actor.method,
        path: actor.path,
      },
      summary,
    },
    observedEvents: observedEvents.map((event) => ({
      type: event.type,
      ts: event.ts,
    })),
    ruleHits: (outcome?.hits || []).map(normalizeHit),
    risk: {
      score: outcome?.score || 0,
      flags: outcome?.flags || [],
      reasons: outcome?.reasons || [],
    },
    policy: {
      action: outcome?.action || "allow",
      applied: true,
    },
    tags: ["receipt", "agent_action"],
  };
}
