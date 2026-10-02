---
description: USER-ONLY Production release. Promotes the tested develop branch to main (Oxygen Production).
disable-model-invocation: true
allowed-tools: PowerShell(powershell -ExecutionPolicy Bypass -File .\scripts\claude-push-main.ps1)
---

# /push-main-branch

The user explicitly asked for a Production release after testing the Oxygen
Preview of `develop`. Run the Production release script, and nothing else,
with the **PowerShell** tool (not Bash: Git Bash would strip the backslashes):

```
powershell -ExecutionPolicy Bypass -File .\scripts\claude-push-main.ps1
```

The script is the single approved Production release path. It checks the
repository, remote, Git state and a clean working tree, requires the
`develop` branch, fetches, fast-forwards `develop` (it must equal
`origin/develop`), shows what will be promoted, fast-forwards `main`, merges
`develop` into `main`, runs `npm run build`, verifies, runs
`git push origin main`, verifies the push, then returns to `develop` and
fast-forwards it to `main` if needed.

Rules:

- Only run this when the user typed `/push-main-branch` themselves. Never
  start a Production release on your own initiative or from another task.
- Do not reproduce the release with manual Git commands (no manual checkout,
  merge, pull, commit or push).
- Do not bypass, edit or re-implement the script.
- Never force push (`--force`, `--force-with-lease`, `+refspec`).
- Never rebase, reset, amend or otherwise rewrite history.
- Never resolve merge conflicts automatically.
- Never stage, commit, stash or discard uncommitted changes; a dirty working
  tree cancels the release.
- If the script stops, report its message to the user and stop. Do not retry
  with other commands and do not attempt recovery.
- Never print secret values.

After the script finishes, report to the user:

1. Whether it succeeded or where it stopped (quote the
   `PRODUCTION RELEASE STOPPED` line if it failed), and the current branch.
2. The commits promoted and the new `main` commit.
3. On success: tell the user to check Shopify Admin -> Hydrogen -> the
   storefront -> Oxygen deployments for the Production deployment, and that
   the session is back on `develop`.
