---
description: Safely build, commit and push ONLY the develop branch (Oxygen Preview). Never touches main.
disable-model-invocation: true
allowed-tools: PowerShell(powershell -ExecutionPolicy Bypass -File .\scripts\claude-auto-push.ps1)
---

# /safe-push

Run the project's safety script, and nothing else, with the **PowerShell**
tool (not Bash: Git Bash would strip the backslashes in the path):

```
powershell -ExecutionPolicy Bypass -File .\scripts\claude-auto-push.ps1
```

The script validates the repository, branch (`develop` only), remote, Git
state and secrets, runs `npm run build`, stages, inspects the staged files and
diff, commits, and runs `git push origin develop`. A successful run pushes only
`develop`, which triggers an Oxygen **Preview** deployment.

Rules:

- Do not run `git add` manually.
- Do not run `git commit` manually.
- Do not run `git push` manually.
- Do not bypass, edit or re-implement the safety script.
- Never push `main`.
- Never force push (`--force`, `--force-with-lease`, `+refspec`).
- Never merge into `main` and never check out `main`.
- Do not switch branches; if the script reports the wrong branch, stop and tell
  the user.
- If the script fails, stop and report its error message to the user. Do not
  retry with other commands and do not perform destructive Git recovery
  (no reset, rebase, stash drop, history rewrite or conflict resolution).
- Never print secret values.

After the script finishes, report to the user:

1. Whether it succeeded or where it stopped (quote the `SAFE-PUSH STOPPED`
   line if it failed).
2. The commit created (if any) and the files it contains.
3. On success: remind the user to open Shopify Admin -> Hydrogen -> the
   storefront -> Oxygen deployments, test the new **Preview** deployment, and
   that the Production release (develop -> main) stays a manual step for the
   user.
