import {
  DEFAULT_POLICY_HEADER,
  DEFAULT_SCORE_HEADER,
} from "./constants.js";
import {
  createAuthFailureEvent,
  createPolicyActionEvent,
  createPromptInjectionSignal,
  createRequestEvent,
  createToolAbuseSignal,
  createVelocityBurstEvent,
} from "./events.js";
import {
  createInMemoryVelocityTracker,
  createLocalEvaluator,
  detectPromptInjection,
  detectToolAbuse,
} from "./evaluator.js";
import { createAgentActionReceipt } from "./receipts.js";
import { createEventStore } from "./store.js";

function setHeader(res, name, value) {
  if (typeof res.setHeader === "function") {
    res.setHeader(name, value);
    return;
  }

  if (typeof res.header === "function") {
    res.header(name, value);
  }
}

function sendBlocked(res, body) {
  if (typeof res.status === "function" && typeof res.json === "function") {
    res.status(429).json(body);
    return;
  }

  res.statusCode = 429;
  if (typeof res.end === "function") {
    res.end(JSON.stringify(body));
  }
}

function normalizeOutcome(outcome = {}) {
  return {
    action: outcome.action || "allow",
    flags: [...new Set(outcome.flags || [])],
    hits: outcome.hits || [],
    reasons: outcome.reasons || [],
    score: outcome.score || 0,
  };
}

function attachOutcome(req, res, outcome, { policyHeader, scoreHeader }) {
  req.carapace = outcome;

  if (res.locals && typeof res.locals === "object") {
    res.locals.carapace = outcome;
  }

  setHeader(res, policyHeader, outcome.action);
  setHeader(res, scoreHeader, String(outcome.score));
}

export function createCarapaceMiddleware({
  onEvent,
  evaluateEvents = createLocalEvaluator(),
  now = () => new Date(),
  policyHeader = DEFAULT_POLICY_HEADER,
  scoreHeader = DEFAULT_SCORE_HEADER,
  eventStore = createEventStore(),
  receiptStore = createEventStore(),
  velocityTracker = createInMemoryVelocityTracker(),
  burstThreshold = 5,
  onReceipt,
} = {}) {
  const emit = (event) => {
    eventStore.add(event);
    if (onEvent) {
      onEvent(event);
    }
  };
  const emitReceipt = (receipt) => {
    receiptStore.add(receipt);
    if (onReceipt) {
      onReceipt(receipt);
    }
  };

  return function carapaceMiddleware(req, res, next) {
    const priorEvents = eventStore.list();
    const requestEvent = createRequestEvent(req, { now });
    const currentEvents = [requestEvent];
    const velocity = velocityTracker.record(
      `${requestEvent.actor.ip}:${requestEvent.actor.method}:${requestEvent.actor.path}`,
      now().getTime(),
    );
    const injectionPattern = detectPromptInjection(req);
    const toolAbuse = detectToolAbuse(req);

    if (velocity.hitCount >= burstThreshold) {
      currentEvents.push(createVelocityBurstEvent(req, velocity.hitCount, { now }));
    }

    if (injectionPattern) {
      currentEvents.push(createPromptInjectionSignal(req, injectionPattern, { now }));
    }

    if (toolAbuse) {
      currentEvents.push(createToolAbuseSignal(req, toolAbuse, { now }));
    }

    const requestOutcome = normalizeOutcome(
      evaluateEvents(currentEvents, priorEvents),
    );

    for (const event of currentEvents) {
      emit(event);
    }

    attachOutcome(req, res, requestOutcome, { policyHeader, scoreHeader });

    if (requestOutcome.action === "block") {
      const policyEvent = createPolicyActionEvent(
        req,
        requestOutcome,
        requestOutcome.reasons,
        { now },
      );
      emit(policyEvent);
      emitReceipt(
        createAgentActionReceipt({
          events: [...currentEvents, policyEvent],
          outcome: requestOutcome,
          now,
        }),
      );
      sendBlocked(res, {
        error: "Request blocked by Carapace policy.",
        action: requestOutcome.action,
        flags: requestOutcome.flags,
        reasons: requestOutcome.reasons,
        score: requestOutcome.score,
      });
      return;
    }

    const originalEnd = typeof res.end === "function" ? res.end.bind(res) : null;

    if (originalEnd) {
      let finalized = false;
      res.end = function patchedEnd(...args) {
        if (!finalized) {
          finalized = true;

          const responseEvents = [];
          if (res.statusCode >= 401) {
            responseEvents.push(createAuthFailureEvent(req, res, { now }));
          }

          const finalOutcome =
            responseEvents.length > 0
              ? normalizeOutcome(
                  evaluateEvents([...currentEvents, ...responseEvents], priorEvents),
                )
              : requestOutcome;

          for (const event of responseEvents) {
            emit(event);
          }

          attachOutcome(req, res, finalOutcome, { policyHeader, scoreHeader });
          const policyEvent = createPolicyActionEvent(
            req,
            finalOutcome,
            finalOutcome.reasons,
            { now },
          );
          emit(policyEvent);
          emitReceipt(
            createAgentActionReceipt({
              events: [...currentEvents, ...responseEvents, policyEvent],
              outcome: finalOutcome,
              now,
            }),
          );
        }

        return originalEnd(...args);
      };
    }

    next();
  };
}

export function createCarapaceInspector(options = {}) {
  const eventStore = options.eventStore || createEventStore();
  const receiptStore = options.receiptStore || createEventStore();
  const middleware = createCarapaceMiddleware({
    ...options,
    eventStore,
    receiptStore,
  });

  return {
    middleware,
    listEvents() {
      return eventStore.list();
    },
    clearEvents() {
      eventStore.clear();
      receiptStore.clear();
    },
    getLatestOutcome() {
      const policyActions = eventStore
        .list()
        .filter((event) => event.type === "policy_action");

      return policyActions.at(-1)?.policy || null;
    },
    listReceipts() {
      return receiptStore.list();
    },
    getLatestReceipt() {
      return receiptStore.list().at(-1) || null;
    },
  };
}
