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

1. Define the middleware surface for `@carapacehq/express`.
2. Align emitted events with `carapace-schemas`.
3. Provide a local-first reference integration for `carapace-playground`.

## Development

This repo is intentionally skeletal until the shared schema contracts are stabilized.

## License

Apache-2.0
