#Requires -Version 5.1
<#
.SYNOPSIS
  Explicit Production release for this Hydrogen storefront (used ONLY by the
  user-invoked /push-main-branch command).

.DESCRIPTION
  Promotes the already-tested `develop` branch to `main`:

  pre-flight checks (repo, origin, Git state, clean tree, branch = develop)
  -> git fetch origin
  -> git pull --ff-only origin develop   (develop must equal origin/develop)
  -> show what will be promoted (stop if nothing)
  -> git checkout main
  -> git pull --ff-only origin main
  -> git merge --no-edit develop         (no squash, no rebase)
  -> npm run build
  -> verify (branch, clean tree, no conflicts, main contains develop)
  -> git push origin main                (the ONLY main push)
  -> verify main == origin/main
  -> git checkout develop
  -> git merge --ff-only main            (only if main has a merge commit)
  -> git push origin develop             (only if develop changed)

  Never force-pushes, never rebases, never resets, never rewrites history,
  never resolves conflicts, never stages or commits uncommitted work, never
  modifies remotes and never prints secret values.

.USAGE
  powershell -ExecutionPolicy Bypass -File .\scripts\claude-push-main.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$DevelopBranch = 'develop'
$MainBranch = 'main'
$RemoteName = 'origin'

# ------------------------------------------------------------------ helpers

function Stop-Release {
  param([string]$Message, [string]$Detail = '')
  Write-Host ''
  Write-Host "PRODUCTION RELEASE STOPPED: $Message" -ForegroundColor Red
  if ($Detail) { Write-Host $Detail -ForegroundColor Yellow }
  $current = (& git branch --show-current 2>$null) -join ''
  Write-Host "Current branch: $current" -ForegroundColor Yellow
  exit 1
}

function Write-Step {
  param([string]$Message)
  Write-Host ''
  Write-Host "==> $Message" -ForegroundColor Cyan
}

# Runs git; stops the release on a non-zero exit code unless -AllowFailure.
function Invoke-Git {
  param(
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [switch]$AllowFailure
  )
  $output = & git @Arguments
  if (-not $AllowFailure -and $LASTEXITCODE -ne 0) {
    Stop-Release "git $($Arguments -join ' ') failed (exit code $LASTEXITCODE)."
  }
  return @($output)
}

function Get-Rev {
  param([string]$Ref)
  $rev = (Invoke-Git -Arguments @('rev-parse', '--verify', '--quiet', "$Ref^{commit}") -AllowFailure) -join ''
  if ($LASTEXITCODE -ne 0) { return $null }
  return $rev
}

function Get-CurrentBranch {
  return (Invoke-Git -Arguments @('branch', '--show-current')) -join ''
}

function Get-InProgressOperations {
  $found = @()
  foreach ($marker in @('MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply', 'BISECT_LOG')) {
    $markerPath = (Invoke-Git -Arguments @('rev-parse', '--git-path', $marker)) -join ''
    if (Test-Path -LiteralPath $markerPath) { $found += $marker }
  }
  return $found
}

function Get-UnmergedFiles {
  return @(Invoke-Git -Arguments @('-c', 'core.quotepath=off', 'diff', '--name-only', '--diff-filter=U') | Where-Object { $_ })
}

function Get-StatusLines {
  return @(Invoke-Git -Arguments @('status', '--porcelain') | Where-Object { $_ })
}

# --------------------------------------------------- 2. Pre-flight safety

Write-Step 'Validating repository'
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Stop-Release 'git is not installed or not on PATH.'
}
$inside = Invoke-Git -Arguments @('rev-parse', '--is-inside-work-tree') -AllowFailure
if ($LASTEXITCODE -ne 0 -or ($inside -join '') -ne 'true') {
  Stop-Release 'This is not a Git repository.'
}
$repoRoot = (Invoke-Git -Arguments @('rev-parse', '--show-toplevel')) -join ''
Set-Location -LiteralPath $repoRoot
Write-Host "Repository: $repoRoot"

Write-Step 'Validating remote'
$remotes = Invoke-Git -Arguments @('remote')
if (-not ($remotes -contains $RemoteName)) {
  Stop-Release "Remote '$RemoteName' does not exist. Remotes were not modified."
}
$pushUrl = (Invoke-Git -Arguments @('remote', 'get-url', '--push', $RemoteName) -AllowFailure) -join ''
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($pushUrl)) {
  Stop-Release "Remote '$RemoteName' has no push URL. Remotes were not modified."
}
Write-Host "Push URL: $($pushUrl -replace '://[^/@]+@', '://***@')"

Write-Step 'Checking Git state'
$inProgress = @(Get-InProgressOperations)
if ($inProgress.Count -gt 0) {
  Stop-Release "A Git operation is in progress ($($inProgress -join ', ')). Manual Git attention is required."
}
$unmerged = @(Get-UnmergedFiles)
if ($unmerged.Count -gt 0) {
  Stop-Release "Unresolved conflicts in: $($unmerged -join ', '). Manual Git attention is required."
}
if ((@(Get-StatusLines)).Count -gt 0) {
  Stop-Release 'Production release cancelled: working tree is not clean.' `
    'Commit and push your changes with /safe-push (or stash them) first. Nothing was staged, committed or discarded.'
}
$trackedEnv = @(Invoke-Git -Arguments @('ls-files', '--', '.env') | Where-Object { $_ })
if ($trackedEnv.Count -gt 0) {
  Stop-Release '.env is tracked by Git. Remove it from the index manually and rotate any exposed secrets.'
}
Write-Host 'Working tree is clean; no merge, rebase, cherry-pick or conflicts in progress.'

# ------------------------------------------------ 3. Starting branch

Write-Step 'Validating starting branch'
$startBranch = Get-CurrentBranch
if ($startBranch -ne $DevelopBranch) {
  if ([string]::IsNullOrWhiteSpace($startBranch)) { $startBranch = '(detached HEAD)' }
  Stop-Release "Current branch is '$startBranch'. /push-main-branch must start from '$DevelopBranch'. The branch was not switched."
}
Write-Host "Branch: $startBranch"

# ------------------------------------------------------- 4. Fetch

Write-Step "Fetching $RemoteName"
& git fetch $RemoteName
if ($LASTEXITCODE -ne 0) { Stop-Release "git fetch $RemoteName failed. Nothing was changed." }

if (-not (Get-Rev "$RemoteName/$DevelopBranch")) { Stop-Release "$RemoteName/$DevelopBranch does not exist." }
if (-not (Get-Rev "$RemoteName/$MainBranch")) { Stop-Release "$RemoteName/$MainBranch does not exist." }

# ------------------------------------------------- 5. Update develop

Write-Step "Updating $DevelopBranch (fast-forward only)"
& git pull --ff-only $RemoteName $DevelopBranch
if ($LASTEXITCODE -ne 0) {
  Stop-Release "$DevelopBranch cannot be fast-forwarded to $RemoteName/$DevelopBranch (local and remote have diverged)." `
    'Resolve this manually. No merge commit was created.'
}
$developRev = Get-Rev $DevelopBranch
$originDevelopRev = Get-Rev "$RemoteName/$DevelopBranch"
if ($developRev -ne $originDevelopRev) {
  Stop-Release "Local $DevelopBranch is not identical to $RemoteName/$DevelopBranch (unpushed commits?)." `
    'Only code that is on origin/develop (tested on the Oxygen Preview) can be released. Push it with /safe-push first.'
}
Write-Host "$DevelopBranch = $RemoteName/$DevelopBranch = $($developRev.Substring(0, 7))"

# ---------------------------------------- 6. What will be promoted

Write-Step "Changes to promote ($RemoteName/$MainBranch..$DevelopBranch)"
$toPromote = @(Invoke-Git -Arguments @('log', '--oneline', '--no-decorate', "$RemoteName/$MainBranch..$DevelopBranch") | Where-Object { $_ })
if ($toPromote.Count -eq 0) {
  Write-Host 'main is already up to date with develop.' -ForegroundColor Green
  exit 0
}
$toPromote | Select-Object -First 30 | ForEach-Object { Write-Host "  $_" }
if ($toPromote.Count -gt 30) { Write-Host "  ... and $($toPromote.Count - 30) more" }
Invoke-Git -Arguments @('diff', '--stat', "$RemoteName/$MainBranch..$DevelopBranch") | Select-Object -Last 1 | ForEach-Object { Write-Host $_ }

# ---------------------------------------------- 7. Switch to main

Write-Step "Switching to $MainBranch"
& git checkout $MainBranch
if ($LASTEXITCODE -ne 0) { Stop-Release "git checkout $MainBranch failed." }

& git pull --ff-only $RemoteName $MainBranch
if ($LASTEXITCODE -ne 0) {
  Stop-Release "$MainBranch cannot be fast-forwarded to $RemoteName/$MainBranch (local $MainBranch has diverged)." `
    'Resolve this manually. Nothing was rebased, reset or forced.'
}
if ((Get-Rev $MainBranch) -ne (Get-Rev "$RemoteName/$MainBranch")) {
  Stop-Release "Local $MainBranch is not identical to $RemoteName/$MainBranch (it has unpushed local commits)." `
    'Resolve this manually before releasing.'
}
$mainBefore = Get-Rev $MainBranch

# ------------------------------------------- 8. Merge develop into main

Write-Step "Merging $DevelopBranch into $MainBranch"
& git merge --no-edit $DevelopBranch
$mergeExit = $LASTEXITCODE
if ($mergeExit -ne 0) {
  $conflicts = @(Get-UnmergedFiles)
  if ($conflicts.Count -gt 0 -or (@(Get-InProgressOperations)) -contains 'MERGE_HEAD') {
    Stop-Release "Merge conflict while merging $DevelopBranch into $MainBranch. main was NOT pushed." `
      ("Conflicting files: $($conflicts -join ', ')`n" +
       "The merge was left in progress on '$MainBranch' for manual attention. Resolve it yourself, " +
       "or cancel it with 'git merge --abort' and then 'git checkout $DevelopBranch'. Nothing was resolved automatically.")
  }
  Stop-Release "git merge $DevelopBranch failed (exit code $mergeExit). main was NOT pushed."
}
$mainAfterMerge = Get-Rev $MainBranch
# A fast-forward leaves main identical to develop; otherwise a merge commit
# was created on main.
$createdMergeCommit = $mainAfterMerge -ne $developRev
if ($createdMergeCommit) {
  Write-Host "Created merge commit $($mainAfterMerge.Substring(0, 7)) on $MainBranch."
} else {
  Write-Host "$MainBranch fast-forwarded to $($mainAfterMerge.Substring(0, 7))."
}

# --------------------------------------------------- 9. Production build

Write-Step 'Running production build (npm run build)'
& npm run build
if ($LASTEXITCODE -ne 0) {
  $detail = "Local $MainBranch now points to $($mainAfterMerge.Substring(0, 7)) (before: $($mainBefore.Substring(0, 7)))"
  if ($createdMergeCommit) { $detail += ', including a local merge commit' }
  $detail += ". It was left local and NOT pushed; nothing was reset. You are on '$MainBranch'."
  Stop-Release 'Production build failed. main was not pushed.' $detail
}
Write-Host 'Build succeeded.' -ForegroundColor Green

# ------------------------------------------------ 10. Verify before push

Write-Step 'Verifying release'
if ((Get-CurrentBranch) -ne $MainBranch) { Stop-Release "Current branch is not $MainBranch. main was not pushed." }
$unmerged = @(Get-UnmergedFiles)
if ($unmerged.Count -gt 0) { Stop-Release "Unresolved conflicts in: $($unmerged -join ', '). main was not pushed." }
$dirty = @(Get-StatusLines)
if ($dirty.Count -gt 0) {
  Stop-Release 'The working tree changed during the build (e.g. regenerated files). main was not pushed.' `
    "Changed paths: $((@($dirty) | ForEach-Object { $_.Substring(3) }) -join ', '). Commit them on develop with /safe-push, then release again."
}
& git merge-base --is-ancestor $DevelopBranch $MainBranch
if ($LASTEXITCODE -ne 0) { Stop-Release "$MainBranch does not contain $DevelopBranch HEAD. main was not pushed." }

Write-Host "Release summary:"
Write-Host "  $RemoteName/$MainBranch : $($mainBefore.Substring(0, 7))"
Write-Host "  new $MainBranch     : $($mainAfterMerge.Substring(0, 7))"
Write-Host "  $DevelopBranch         : $($developRev.Substring(0, 7))"
Write-Host "  commits promoted : $($toPromote.Count)"

# --------------------------------------------------- 11. Push Production

Write-Step "Pushing $MainBranch to $RemoteName (Production)"
# The ONE permitted push of main. No --force, no --force-with-lease.
& git push origin main
if ($LASTEXITCODE -ne 0) {
  Stop-Release "git push origin main was rejected (see the Git error above). Remote main may have changed. Nothing was forced." `
    "Local $MainBranch ($($mainAfterMerge.Substring(0, 7))) was left as is. You are on '$MainBranch'."
}

# ----------------------------------------------- 12. Verify the push

& git fetch $RemoteName $MainBranch
if ((Get-Rev $MainBranch) -ne (Get-Rev "$RemoteName/$MainBranch")) {
  Stop-Release "After pushing, local $MainBranch does not match $RemoteName/$MainBranch. Check GitHub manually."
}
Write-Host ''
Write-Host 'Production main push completed successfully. Oxygen Production deployment should now be triggered.' -ForegroundColor Green

# ----------------------------------------------- 13. Return to develop

Write-Step "Returning to $DevelopBranch"
& git checkout $DevelopBranch
if ($LASTEXITCODE -ne 0) {
  Stop-Release "Production was released, but switching back to $DevelopBranch failed. Switch manually."
}

& git merge-base --is-ancestor $MainBranch $DevelopBranch
if ($LASTEXITCODE -eq 0) {
  Write-Host "$DevelopBranch already contains $MainBranch; nothing to sync."
} else {
  & git merge --ff-only $MainBranch
  if ($LASTEXITCODE -ne 0) {
    Stop-Release "Production was released, but $DevelopBranch cannot be fast-forwarded to $MainBranch. Sync it manually." `
      'No extra merge was created.'
  }
  Write-Host "$DevelopBranch fast-forwarded to $MainBranch."
  & git push origin develop
  if ($LASTEXITCODE -ne 0) {
    Stop-Release "Production was released, but pushing the synced $DevelopBranch failed (see above). Nothing was forced."
  }
}

if ((Get-CurrentBranch) -ne $DevelopBranch) {
  Stop-Release "Production was released, but the current branch is not $DevelopBranch."
}
Write-Host ''
Write-Host "Done. Production release complete; you are back on $DevelopBranch." -ForegroundColor Green
exit 0
