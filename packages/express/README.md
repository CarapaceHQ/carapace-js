# @carapacehq/express

First-package middleware for the Carapace JavaScript surface.

This package now supports the first Carapace slice:

- capture request and auth telemetry
- emit normalized events
- emit `velocity_burst`, `prompt_injection_signal`, and `tool_abuse_signal`
- run local rules or scoring hooks
- expose narrow policy outcomes: `allow`, `log`, `rate_limit`, `block`
- attach `action`, `flags`, `reasons`, and `score` to the request context

## Quick Start

```js
import { createCarapaceInspector } from "@carapacehq/express";

const inspector = createCarapaceInspector();
app.use(inspector.middleware);
```

For shared rule evaluation, pass an `evaluateEvents(currentEvents, priorEvents)` function.

The function should return:

- `hits`
- `flags`
- `reasons`
- `score`
- `action`
