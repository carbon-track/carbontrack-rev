# CarbonTrack Miniprogram

This directory contains the WeChat Mini Program client for CarbonTrack. It is a
Taro + React project that builds only the `weapp` target.

## Repository Role

Author changes in the monorepo under `miniprogram/`. The mirror repository
`carbon-track/miniprogram` is deployment-only and is updated by
`.github/workflows/sync-repositories.yml` after `dev` or `main` receives
changes.

## Stack

- Taro `4.2.0`
- React `18.3.1`
- pnpm `10.16.1`
- Output root: `dist/`

## Environment

Copy `.env.example` to a local env file or inject the same values in CI/upload
automation:

```bash
TARO_APP_API_URL=http://localhost:8080/api/v1
TARO_APP_MOBILE_CLIENT_TOKEN=
```

`TARO_APP_MOBILE_CLIENT_TOKEN` is intentionally empty in source control. The v1
Mini Program client reuses the backend mobile PoW channel, so requests send
`client_type=mobile`, `X-Client-Platform: mobile`, and the configured mobile
client token.

## Development

```bash
pnpm install --frozen-lockfile
pnpm build:weapp
```

Open this directory in WeChat DevTools. `project.config.json` points
`miniprogramRoot` to `dist/`, so build before preview/upload.

## Validation

```bash
pnpm validate
```

`pnpm validate` checks the Taro page/config structure, runs Node unit tests for
API/PoW helpers, and builds the WeChat Mini Program output.
