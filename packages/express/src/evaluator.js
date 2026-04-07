const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+previous\s+instructions/i,
  /system\s+prompt/i,
  /send\s+credentials/i,
  /exfiltrat/i,
];

const TOOL_ABUSE_PATTERNS = [
  {
    toolName: "export_credentials",
    match: /export[_\s-]?credentials/i,
    reason: "The request attempted to export credentials.",
  },
  {
    toolName: "browser.open_external_url",
    match: /open\s+external\s+url/i,
    reason: "The request attempted to pivot to an external URL.",
  },
  {
    toolName: "shell.exec",
    match: /shell\.exec|run\s+shell\s+command/i,
    reason: "The request attempted to execute shell commands.",
  },
];

function readBodyText(req) {
  if (typeof req.body === "string") {
    return req.body;
  }

  if (req.body && typeof req.body === "object") {
    return JSON.stringify(req.body);
  }

  return "";
}

export function detectPromptInjection(req) {
  const bodyText = readBodyText(req);

  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(bodyText)) {
      return pattern.source;
    }
  }

  return null;
}

export function detectToolAbuse(req) {
  const bodyText = readBodyText(req);

  for (const pattern of TOOL_ABUSE_PATTERNS) {
    if (pattern.match.test(bodyText)) {
      return {
        toolName: pattern.toolName,
        reason: pattern.reason,
      };
    }
  }

  return null;
}

export function createInMemoryVelocityTracker({
  windowMs = 60_000,
  burstThreshold = 5,
} = {}) {
  const hits = new Map();

  return {
    record(key, nowMs) {
      const timestamps = hits.get(key) || [];
      const active = timestamps.filter((ts) => nowMs - ts <= windowMs);
      active.push(nowMs);
      hits.set(key, active);

      return {
        hitCount: active.length,
        burstDetected: active.length >= burstThreshold,
      };
    },
  };
}

export function createLocalEvaluator({
  velocityTracker = createInMemoryVelocityTracker(),
  now = () => Date.now(),
  burstThreshold = 5,
} = {}) {
  return function evaluate(currentEvents) {
    const hits = [];

    for (const event of currentEvents) {
      if (
        event.type === "velocity_burst" &&
        (event.metrics?.hitCount || 0) >= burstThreshold
      ) {
        hits.push({
          ruleId: "carapace.velocity-burst",
          flags: ["velocity_burst"],
          scoreContribution: 35,
          suggestedAction: "rate_limit",
        });
      }

      if (event.type === "prompt_injection_signal") {
        hits.push({
          ruleId: "carapace.prompt-injection",
          flags: ["prompt_injection"],
          scoreContribution: 80,
          suggestedAction: "block",
        });
      }

      if (event.type === "tool_abuse_signal") {
        hits.push({
          ruleId: "carapace.tool-abuse",
          flags: ["tool_abuse"],
          scoreContribution: 60,
          suggestedAction: "block",
        });
      }
    }

    const score = Math.min(
      100,
      hits.reduce((total, hit) => total + hit.scoreContribution, 0),
    );
    const flags = [...new Set(hits.flatMap((hit) => hit.flags))];
    const reasons = hits.map((hit) => hit.ruleId);
    let action = "allow";

    if (hits.some((hit) => hit.suggestedAction === "block") || score >= 80) {
      action = "block";
    } else if (
      hits.some((hit) => hit.suggestedAction === "rate_limit") ||
      score >= 50
    ) {
      action = "rate_limit";
    } else if (score >= 25) {
      action = "log";
    }

    return {
      action,
      flags,
      hits,
      reasons,
      score,
      telemetry: {
        evaluatedAtMs: now(),
      },
    };
  };
}
