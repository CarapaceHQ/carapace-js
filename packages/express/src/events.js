function sanitizePath(path) {
  if (!path || typeof path !== "string") {
    return "/";
  }

  return path.split("?")[0] || "/";
}

function buildActor(req) {
  const ip =
    req.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    "unknown";

  return {
    ip,
    userAgent: req.headers?.["user-agent"] || "unknown",
    method: req.method || "GET",
    path: sanitizePath(req.originalUrl || req.url || req.path),
  };
}

export function createRequestEvent(req, { now = () => new Date() } = {}) {
  const actor = buildActor(req);

  return {
    type: "api_request",
    ts: now().toISOString(),
    actor,
    request: {
      method: actor.method,
      path: actor.path,
      userAgent: actor.userAgent,
    },
    tags: [],
  };
}

export function createAuthFailureEvent(req, res, { now = () => new Date() } = {}) {
  const actor = buildActor(req);

  return {
    type: "auth_failure",
    ts: now().toISOString(),
    actor,
    response: {
      statusCode: res.statusCode,
    },
    tags: ["auth"],
  };
}

export function createVelocityBurstEvent(req, hitCount, { now = () => new Date() } = {}) {
  const actor = buildActor(req);

  return {
    type: "velocity_burst",
    ts: now().toISOString(),
    actor,
    metrics: {
      hitCount,
      windowMs: 60_000,
    },
    tags: ["velocity"],
  };
}

export function createPromptInjectionSignal(req, matchedPattern, { now = () => new Date() } = {}) {
  const actor = buildActor(req);

  return {
    type: "prompt_injection_signal",
    ts: now().toISOString(),
    actor,
    signal: {
      matchedPattern,
    },
    tags: ["prompt_injection"],
  };
}

export function createToolAbuseSignal(
  req,
  { toolName, reason },
  { now = () => new Date() } = {},
) {
  const actor = buildActor(req);

  return {
    type: "tool_abuse_signal",
    ts: now().toISOString(),
    actor,
    signal: {
      toolName,
      reason,
    },
    tags: ["tool_abuse"],
  };
}

export function createPolicyActionEvent(req, outcome, reasons, { now = () => new Date() } = {}) {
  const actor = buildActor(req);

  return {
    type: "policy_action",
    ts: now().toISOString(),
    actor,
    policy: {
      action: outcome.action,
      flags: outcome.flags || [],
      score: outcome.score,
      reasons,
    },
    tags: ["policy"],
  };
}
