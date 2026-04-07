# carapace-js

JavaScript SDKs and middleware for Carapace.

Support Carapace on Patreon: <https://www.patreon.com/carapacehq>

## First Package

The first package owned by this repo is:

- `@carapacehq/express`

Its job is to capture risk telemetry from an Express app, normalize those events, and hand them to local scoring and policy hooks.

## Scope

This repo will own:

- JavaScript install paths for Carapace
- middleware and helper packages
- local integration examples
- test fixtures for the first API protection loop

## Layout

- `packages/express/`

## Near-Term Milestones

The first middleware surface is now live:

- request, auth-failure, velocity-burst, prompt-injection, tool-abuse, and policy events
- an event-sequence evaluator hook so rule packs stay separate from the SDK repo
- a local inspector surface for event capture and policy summaries
- a reference integration consumed by `carapace-playground`

## `@carapacehq/express`

The first package exports:

- `createCarapaceMiddleware()`
- `createCarapaceInspector()`
- event factory helpers for the first supported event set
- detection helpers for prompt injection and tool abuse
- a default local evaluator for narrow local-first installs

## Development

```bash
npm test
```

## Development

This repo is intentionally skeletal until the shared schema contracts are stabilized.

## License

Apache-2.0
