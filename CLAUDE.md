@AGENTS.md

## Git and Deployment Workflow

- Development branch: `develop` (pushes create an Oxygen Preview deployment)
- Production branch: `main` (live custom domain)

Rules:

1. Normal development work must happen on `develop`.
2. Before development or deployment operations, verify the branch with
   `git branch --show-current`.
3. `main` is the Production branch.
4. Never automatically push `main`.
5. Never automatically merge `develop` into `main`.
6. `/safe-push` is the approved development push command.
7. `/safe-push` must execute (with the PowerShell tool):
   `powershell -ExecutionPolicy Bypass -File .\scripts\claude-auto-push.ps1`
8. Never bypass the safe-push script with a direct automatic `git push`.
9. Automatic Git push is allowed only for `develop`.
10. Never force push (`--force`, `--force-with-lease`, `+refspec`).
11. Never rewrite Git history (no amend, rebase, reset --hard, filter-branch).
12. Never commit secrets, tokens, passwords, private keys, `.env` files or
    other sensitive credentials. `.env.example` holds variable names only.
13. Build failures must prevent pushing (`npm run build` runs first).
14. Git conflicts and in-progress merges/rebases require manual attention;
    never resolve them automatically.
15. A successful `develop` push is expected to trigger an Oxygen Preview
    deployment.
16. The user must test the Oxygen Preview before a Production release.
17. A Production release requires explicit user approval.
18. Production release flow:
    `develop` -> Oxygen Preview -> user tests Preview -> user approves ->
    merge `develop` into `main` -> push `main` -> Oxygen Production.
19. Claude must NOT perform the `develop` -> `main` merge automatically unless
    the user explicitly asks for that specific Production release.

### Commands

- `/safe-push` = development deployment = `develop` only = Oxygen Preview.
  Runs `powershell -ExecutionPolicy Bypass -File .\scripts\claude-auto-push.ps1`.
- `/push-main-branch` = explicit Production promotion = `develop` -> `main` =
  Oxygen Production. Runs
  `powershell -ExecutionPolicy Bypass -File .\scripts\claude-push-main.ps1`.

### Production release rules (`/push-main-branch`)

1. Claude must NEVER invoke `/push-main-branch` automatically.
2. Only the user may explicitly initiate `/push-main-branch`.
3. The Oxygen Preview must be tested and approved before the user invokes it.
4. `/push-main-branch` must use `scripts/claude-push-main.ps1`.
5. Never bypass the Production script with direct Git commands.
6. Never force push.
7. Never automatically resolve merge conflicts.
8. Never include uncommitted changes in a Production release (a dirty working
   tree cancels it).
9. After a successful Production release, return to `develop`.

Pushing is never automatic: there are no hooks (Stop, PostToolUse, Git hooks
or other lifecycle events), and finishing a task does not push. `develop` is
pushed only when the user runs `/safe-push`; `main` is pushed only when the
user runs `/push-main-branch`.
