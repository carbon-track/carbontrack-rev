# Mirror Sync Setup

## Repository Roles

`carbon-track/carbontrack-rev` is the only development repository.

- `main`: production source of truth
- `dev`: integration source of truth
- `feature/*`: feature branches that merge into `dev`

`carbon-track/frontend`, `carbon-track/backend`, `carbon-track/mobile`, and `carbon-track/miniprogram` are mirror repositories for deployment only.

- `frontend/main` mirrors `monorepo/main`
- `frontend/dev` mirrors `monorepo/dev`
- `backend/main` mirrors `monorepo/main`
- `backend/dev` mirrors `monorepo/dev`
- `mobile/main` mirrors `monorepo/main`
- `mobile/dev` mirrors `monorepo/dev`
- `miniprogram/main` mirrors `monorepo/main`
- `miniprogram/dev` mirrors `monorepo/dev`

Do not perform normal feature development in the split repositories. Any manual change there will be overwritten by the next sync run.

## Expected Flow

1. Create `feature/*` from `dev` in the monorepo.
2. Open PRs from `feature/*` into `dev`.
3. After merge to `dev`, `.github/workflows/sync-repositories.yml` pushes changed subtrees to `frontend/dev`, `backend/dev`, `mobile/dev`, and/or `miniprogram/dev`.
4. Development infrastructure pulls directly from the split repositories:
   - frontend preview/dev deployment reads `frontend/dev`
   - backend development server pulls `backend/dev`
   - mobile development deployment reads `mobile/dev`
   - WeChat Mini Program development upload reads `miniprogram/dev`
5. When ready to release, open a PR from `dev` into `main` in the monorepo.
6. After merge to `main`, the same sync workflow pushes changed subtrees to `frontend/main`, `backend/main`, `mobile/main`, and/or `miniprogram/main`.
7. Production infrastructure pulls directly from the split repositories:
   - Cloudflare Pages production reads `frontend/main`
   - production backend server pulls `backend/main`
   - production mobile deployment reads `mobile/main`
   - WeChat Mini Program release upload reads `miniprogram/main`

## GitHub Actions In This Repo

Two workflows support this model:

- [`.github/workflows/monorepo-ci.yml`](.github/workflows/monorepo-ci.yml): runs the required PR gates in the monorepo for frontend CI, backend CI, mobile CI, miniprogram CI, and split-repo deployment readiness
- [`.github/workflows/sync-repositories.yml`](.github/workflows/sync-repositories.yml): mirrors `frontend/`, `backend/`, `mobile/`, and `miniprogram/` to the corresponding split-repo branch after a push to `dev` or `main`

The sync workflow pushes directly to the target branch instead of opening PRs in the split repositories. That keeps the child repositories deployable while preserving a single human review surface in the monorepo.

The split repositories may still run push-time smoke checks after sync, but they are not the human merge gate. Required checks must be configured on the monorepo PR only.

## GitHub App Credentials

Do not use PATs for mirror sync.

Configure these values in the monorepo:

- repository variable: `MIRROR_SYNC_APP_ID`
- repository secret: `MIRROR_SYNC_APP_PRIVATE_KEY`

The workflow uses `actions/create-github-app-token` to mint short-lived installation tokens for `frontend`, `backend`, `mobile`, and `miniprogram` at runtime.

Install the GitHub App on:

- `carbon-track/carbontrack-rev`
- `carbon-track/frontend`
- `carbon-track/backend`
- `carbon-track/mobile`
- `carbon-track/miniprogram`

Minimum repository permissions for the app:

- `Contents: Read and write`
- `Metadata: Read`
- `Workflows: Read and write`

If branch protection is enabled on the child repositories, grant the app explicit bypass/push permission for `main` and `dev`.

## Branch Protection

### Monorepo

Protect `dev` and `main`.

- block direct push
- require pull requests
- require these status checks from the monorepo PR workflow:
  - `monorepo / frontend-ci`
  - `monorepo / frontend-cd-readiness`
  - `monorepo / backend-ci`
  - `monorepo / backend-cd-readiness`
  - `monorepo / mobile-ci`
  - `monorepo / mobile-cd-readiness`
  - `monorepo / miniprogram-ci`
  - `monorepo / miniprogram-cd-readiness`
- require at least one approval

Recommended extra rule for `main`:

- restrict merges so releases come from `dev`

### Frontend / Backend / Mobile / Miniprogram Mirrors

Protect `dev` and `main`, but keep them bot-writable.

- block human direct push
- allow only the sync GitHub App bot to update these branches
- do not use the split repos as the human review gate
- optional: keep push-time smoke checks only, not required PR checks

## Cloudflare Pages

Point Cloudflare Pages at `carbon-track/frontend`.

- production branch: `main`
- development branch: `dev`
- custom production domain -> `main`
- custom dev subdomain -> `dev`

## Backend Server Pull Strategy

Because deployment is front/back separated, let each environment pull directly from the backend mirror repository:

- development backend server tracks `carbon-track/backend:dev`
- production backend server tracks `carbon-track/backend:main`

This preserves a clean deployment surface while keeping the monorepo as the only place where code is authored and reviewed.

## WeChat Mini Program Pull Strategy

Keep WeChat Mini Program development in the monorepo under `miniprogram/`, then upload from the mirror repository branch that matches the target environment:

- development Mini Program builds track `carbon-track/miniprogram:dev`
- production Mini Program builds track `carbon-track/miniprogram:main`
