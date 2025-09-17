# Repository Sync Setup Guide

This document explains how to set up automatic synchronization from the monorepo to individual frontend and backend repositories.

## Overview

The GitHub Actions workflow (`sync-repositories.yml`) automatically:
- Detects changes in `frontend/` or `backend/` directories
- Syncs changes to respective individual repositories
- Works on both direct pushes to main and merged pull requests
- Provides status updates in PR comments

## Setup Instructions

### 1. Create Personal Access Tokens

You need to create GitHub Personal Access Tokens (PATs) with appropriate permissions:

#### For Frontend Repository Token:
1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Name: `Frontend Repo Sync Token`
4. Expiration: Choose appropriate duration (recommend 1 year)
5. Scopes needed:
   - `repo` (Full control of private repositories)
   - `workflow` (Update GitHub Action workflows)
6. Generate token and **save it securely**

#### For Backend Repository Token:
1. Repeat the same process
2. Name: `Backend Repo Sync Token`
3. Same scopes as above
4. Generate and save the token

### 2. Add Secrets to Monorepo

In your `carbon-track/carbontrack-rev` repository:

1. Go to repository Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add these secrets:

   **Secret Name:** `FRONTEND_REPO_TOKEN`
   **Value:** [Your frontend repository PAT]

   **Secret Name:** `BACKEND_REPO_TOKEN`
   **Value:** [Your backend repository PAT]

### 3. Verify Repository Access

Make sure the tokens have access to:
- `https://github.com/carbon-track/frontend`
- `https://github.com/carbon-track/backend`

## How It Works

### Trigger Conditions
- **Direct Push to main**: Syncs immediately after push
- **PR Merge**: Syncs when a PR is merged into main
- **Manual**: Can be triggered manually from Actions tab

### Change Detection
- Uses `git diff` to detect changes in `frontend/` or `backend/` directories
- Only syncs repositories that have actual changes
- Preserves git history in target repositories

### Sync Process
1. Clones the target repository
2. Replaces all content with latest from monorepo
3. Commits changes with descriptive message
4. Pushes to main branch of target repository

### Safety Features
- Only runs on main branch changes
- Checks for actual changes before committing
- Uses secure token authentication
- Provides detailed logging

## Testing the Setup

1. **Commit this workflow file** to the monorepo
2. **Add the required secrets** as described above
3. **Make a test change** in either `frontend/` or `backend/`
4. **Push to main** or create a PR and merge it
5. **Check the Actions tab** to see the workflow run
6. **Verify the changes** appeared in the individual repositories

## Troubleshooting

### Common Issues:
1. **"Repository not found"**: Check token permissions and repository names
2. **"Permission denied"**: Ensure tokens have `repo` scope
3. **"No changes detected"**: Make sure you're changing files in `frontend/` or `backend/` directories
4. **Workflow doesn't run**: Check that secrets are properly named and added

### Logs:
- Check the Actions tab in your monorepo for detailed logs
- Each step shows what changes were detected and synced

## Alternative: PR-based Sync

If you prefer to create PRs instead of direct pushes to main branches of individual repositories, let me know and I can modify the workflow to:
- Create feature branches in target repositories
- Open PRs for review
- Auto-merge after approval (optional)

## Benefits

- ✅ **Automatic**: No manual intervention needed
- ✅ **Selective**: Only syncs when changes are detected
- ✅ **Safe**: Uses secure tokens and proper git practices
- ✅ **Traceable**: Clear commit messages linking back to monorepo
- ✅ **AI-friendly**: AI agents only need to work in monorepo