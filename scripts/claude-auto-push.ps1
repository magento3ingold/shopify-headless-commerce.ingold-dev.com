#Requires -Version 5.1
<#
.SYNOPSIS
  Safe development push for this Hydrogen storefront (used by /safe-push).

.DESCRIPTION
  validate repository -> validate branch -> validate Git state
  -> validate secrets -> detect changes -> npm run build -> stage changes
  -> inspect staged files -> inspect staged diff -> commit
  -> push ONLY origin/develop

  Pushing `develop` triggers an Oxygen Preview deployment. Production
  (`main`) is NEVER pushed, merged or checked out by this script; the
  Production release stays a manual step by the user.

  The script never force-pushes, never rewrites history, never modifies
  remotes, never switches branches and never prints secret values.

.USAGE
  powershell -ExecutionPolicy Bypass -File .\scripts\claude-auto-push.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# The ONLY branch this script may commit on and push.
$AllowedBranch = 'develop'
# The ONLY remote this script may push to.
$RemoteName = 'origin'

# ------------------------------------------------------------------ helpers

function Stop-SafePush {
  param([string]$Message)
  Write-Host ''
  Write-Host "SAFE-PUSH STOPPED: $Message" -ForegroundColor Red
  Write-Host 'Nothing was pushed.' -ForegroundColor Red
  exit 1
}

function Write-Step {
  param([string]$Message)
  Write-Host ''
  Write-Host "==> $Message" -ForegroundColor Cyan
}

# Runs git and returns its stdout lines. Stops on a non-zero exit code
# unless -AllowFailure is given (then $LASTEXITCODE tells the result).
function Invoke-Git {
  param(
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [switch]$AllowFailure
  )
  $output = & git @Arguments
  if (-not $AllowFailure -and $LASTEXITCODE -ne 0) {
    Stop-SafePush "git $($Arguments -join ' ') failed (exit code $LASTEXITCODE)."
  }
  return @($output)
}

# Files that must never be committed. Paths use forward slashes.
function Test-ForbiddenPath {
  param([string]$Path)
  $name = ($Path -split '/')[-1].ToLowerInvariant()
  $lower = $Path.ToLowerInvariant()

  if ($name -eq '.env.example') { return $false }
  if ($name -eq '.env' -or $name.StartsWith('.env.')) { return $true }
  if ($name -match '\.(pem|key|p12|pfx|jks|keystore|ppk|asc|gpg)$') { return $true }
  if ($name -match '^id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$') { return $true }
  if ($name -match '^(\.npmrc|\.netrc|\.htpasswd|\.pgpass)$') { return $true }
  if ($name -match '(secret|credential|password|passwd|private[-_]?key|service[-_]?account)') { return $true }
  if ($lower -eq '.claude/settings.local.json') { return $true }
  return $false
}

# Generated / dependency output that should never be committed.
function Test-GeneratedPath {
  param([string]$Path)
  $lower = $Path.ToLowerInvariant()
  return ($lower -match '^(node_modules|dist|build|\.cache|\.mf|\.shopify|\.react-router|public/build|coverage|playwright-report|test-results)/' -or
    $lower -match '\.log$')
}

# Patterns for credentials in ADDED lines of the staged diff. Only the
# rule name and file path are ever reported, never the matched text.
$SecretPatterns = [ordered]@{
  'Shopify access token'      = 'shp(at|ss|ca|pa)_[A-Fa-f0-9]{32}'
  'Private key block'         = '-----BEGIN [A-Z ]*PRIVATE KEY-----'
  'GitHub token'              = '(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{40,}'
  'AWS access key'            = 'AKIA[0-9A-Z]{16}'
  'Stripe live key'           = '(sk|rk)_live_[A-Za-z0-9]{20,}'
  'Slack token'               = 'xox[abprs]-[A-Za-z0-9-]{10,}'
  'Resend API key'            = '\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{8,}'
  'Hard-coded secret value'   = '(?i)\b[A-Z0-9_]*(SECRET|PASSWORD|PASSWD|TOKEN|API_KEY|PRIVATE_KEY)[A-Z0-9_]*\b\s*[:=]\s*[''"][^''"\s$]{12,}[''"]'
}

# --------------------------------------------------- A. Git repository

Write-Step 'Validating repository'
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Stop-SafePush 'git is not installed or not on PATH.'
}
$inside = Invoke-Git -Arguments @('rev-parse', '--is-inside-work-tree') -AllowFailure
if ($LASTEXITCODE -ne 0 -or ($inside -join '') -ne 'true') {
  Stop-SafePush 'This is not a Git repository.'
}
$repoRoot = (Invoke-Git -Arguments @('rev-parse', '--show-toplevel')) -join ''
Set-Location -LiteralPath $repoRoot
Write-Host "Repository: $repoRoot"

# ------------------------------------------------ B/C. Branch protection

Write-Step 'Validating branch'
$branch = (Invoke-Git -Arguments @('branch', '--show-current')) -join ''
if ([string]::IsNullOrWhiteSpace($branch)) {
  Stop-SafePush 'HEAD is detached (no current branch). Switch to develop manually.'
}
if ($branch -eq 'main' -or $branch -eq 'master') {
  Stop-SafePush 'Automatic push to main is blocked. Switch to develop.'
}
if ($branch -ne $AllowedBranch) {
  Stop-SafePush "Current branch is '$branch'. /safe-push only works on '$AllowedBranch'. The branch was not switched."
}
Write-Host "Branch: $branch"

# ------------------------------------------------------- D. Remote

Write-Step 'Validating remote'
$remotes = Invoke-Git -Arguments @('remote')
if (-not ($remotes -contains $RemoteName)) {
  Stop-SafePush "Remote '$RemoteName' does not exist. Remotes were not modified."
}
$pushUrl = (Invoke-Git -Arguments @('remote', 'get-url', '--push', $RemoteName) -AllowFailure) -join ''
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($pushUrl)) {
  Stop-SafePush "Remote '$RemoteName' has no push URL. Remotes were not modified."
}
# Print the URL without any embedded credentials (https://user:token@host).
$safeUrl = $pushUrl -replace '://[^/@]+@', '://***@'
Write-Host "Push URL: $safeUrl"

# ---------------------------------------- E. Conflicted / in-progress state

Write-Step 'Checking Git state'
$inProgress = @()
foreach ($marker in @('MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply', 'BISECT_LOG')) {
  $markerPath = (Invoke-Git -Arguments @('rev-parse', '--git-path', $marker)) -join ''
  if (Test-Path -LiteralPath $markerPath) { $inProgress += $marker }
}
if ($inProgress.Count -gt 0) {
  Stop-SafePush "A Git operation is in progress ($($inProgress -join ', ')). Manual Git attention is required."
}
$unmerged = Invoke-Git -Arguments @('-c', 'core.quotepath=off', 'diff', '--name-only', '--diff-filter=U')
if (@($unmerged | Where-Object { $_ }).Count -gt 0) {
  Stop-SafePush "Unresolved conflicts in: $($unmerged -join ', '). Manual Git attention is required."
}
Write-Host 'No merge, rebase, cherry-pick or conflicts in progress.'

# ------------------------------------------------- F. Secret protection

Write-Step 'Validating secrets'
$trackedEnv = Invoke-Git -Arguments @('ls-files', '--', '.env')
if (@($trackedEnv | Where-Object { $_ }).Count -gt 0) {
  Stop-SafePush '.env is tracked by Git. Remove it from the index manually (git rm --cached .env) and rotate any exposed secrets.'
}
$trackedForbidden = Invoke-Git -Arguments @('-c', 'core.quotepath=off', 'ls-files') |
  Where-Object { $_ -and (Test-ForbiddenPath $_) }
if (@($trackedForbidden).Count -gt 0) {
  Stop-SafePush "Secret-like files are tracked by Git: $(@($trackedForbidden) -join ', '). Resolve this manually."
}
$envIgnored = Invoke-Git -Arguments @('check-ignore', '-q', '.env') -AllowFailure
if ($LASTEXITCODE -ne 0) {
  Stop-SafePush '.env is not ignored by .gitignore.'
}

# .env.example may only contain variable names with empty values.
if (Test-Path -LiteralPath '.env.example') {
  $lineNumber = 0
  $badLines = @()
  foreach ($line in Get-Content -LiteralPath '.env.example') {
    $lineNumber++
    if ($line -match '^\s*$' -or $line -match '^\s*#') { continue }
    if ($line -notmatch '^\s*[A-Za-z_][A-Za-z0-9_]*\s*=\s*$') { $badLines += $lineNumber }
  }
  if ($badLines.Count -gt 0) {
    Stop-SafePush ".env.example must contain variable names with empty values only (check line(s) $($badLines -join ', '); values are not shown)."
  }
}
Write-Host '.env is untracked and ignored; no secret files are tracked.'

# ------------------------------------------------------ G. Changes

Write-Step 'Detecting changes'
$status = Invoke-Git -Arguments @('status', '--porcelain')
if (@($status | Where-Object { $_ }).Count -eq 0) {
  Write-Host 'No changes to commit.' -ForegroundColor Green
  exit 0
}
Write-Host "$(@($status | Where-Object { $_ }).Count) changed path(s)."

# ------------------------------------------------------- H. Build

Write-Step 'Running production build (npm run build)'
& npm run build
if ($LASTEXITCODE -ne 0) {
  Stop-SafePush 'Production build failed. Push cancelled.'
}
Write-Host 'Build succeeded.' -ForegroundColor Green

# ----------------------------------------------------- 3. Stage + validate

Write-Step 'Staging changes'
Invoke-Git -Arguments @('add', '.') | Out-Null

$staged = @(Invoke-Git -Arguments @('-c', 'core.quotepath=off', 'diff', '--cached', '--name-only') | Where-Object { $_ })

$dangerous = @($staged | Where-Object { Test-ForbiddenPath $_ })
if ($dangerous.Count -gt 0) {
  Invoke-Git -Arguments (@('restore', '--staged', '--') + $dangerous) | Out-Null
  Stop-SafePush "Prohibited secret/private file(s) were staged and have been unstaged: $($dangerous -join ', ')"
}

$generated = @($staged | Where-Object { Test-GeneratedPath $_ })
if ($generated.Count -gt 0) {
  Invoke-Git -Arguments (@('restore', '--staged', '--') + $generated) | Out-Null
  Stop-SafePush "Generated/dependency file(s) were staged and have been unstaged: $($generated -join ', '). Check .gitignore."
}

if ($staged.Count -eq 0) {
  Write-Host 'No changes to commit.' -ForegroundColor Green
  exit 0
}

# ----------------------------------------------------- 4. Review the diff

Write-Step 'Staged files'
Invoke-Git -Arguments @('diff', '--cached', '--stat') | ForEach-Object { Write-Host $_ }

Write-Step 'Scanning staged changes for credentials'
$diff = Invoke-Git -Arguments @('-c', 'core.quotepath=off', 'diff', '--cached', '--no-color', '--unified=0', '--no-ext-diff')
$currentFile = ''
$findings = @{}
foreach ($line in $diff) {
  if ($line.StartsWith('+++ ')) {
    $currentFile = $line.Substring(4) -replace '^b/', ''
    continue
  }
  if (-not $line.StartsWith('+') -or $line.StartsWith('+++')) { continue }
  foreach ($rule in $SecretPatterns.Keys) {
    if ($line -match $SecretPatterns[$rule]) {
      $key = "$currentFile ($rule)"
      $findings[$key] = $true
    }
  }
}
if ($findings.Count -gt 0) {
  # Unstage everything; the working tree is left untouched.
  Invoke-Git -Arguments @('restore', '--staged', '--', '.') | Out-Null
  Stop-SafePush "Possible credentials found in staged changes (values not shown): $(@($findings.Keys | Sort-Object) -join '; '). All changes were unstaged."
}
Write-Host 'No credentials detected.'

# --------------------------------------------------------- 5. Commit

Write-Step 'Committing'
$timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
$names = @($staged | ForEach-Object { ($_ -split '/')[-1] })
if ($names.Count -ge 1 -and $names.Count -le 3) {
  $title = "Update $($names -join ', ')"
} elseif ($names.Count -gt 3) {
  $areas = @($staged | ForEach-Object {
      $parts = $_ -split '/'
      if ($parts.Count -gt 2) { "$($parts[0])/$($parts[1])" } elseif ($parts.Count -eq 2) { $parts[0] } else { '(root)' }
    } | Select-Object -Unique)
  $shown = ($areas | Select-Object -First 3) -join ', '
  if ($areas.Count -gt 3) { $shown += ', ...' }
  $title = "Update $($names.Count) files in $shown"
} else {
  $title = "Claude Code update - $timestamp"
}
if ($title.Length -gt 72) { $title = "Claude Code update - $timestamp" }

$bodyLines = @("Claude Code update - $timestamp", '', 'Files:')
$bodyLines += Invoke-Git -Arguments @('-c', 'core.quotepath=off', 'diff', '--cached', '--name-status') | ForEach-Object { "  $_" }
$body = $bodyLines -join "`n"

& git commit -m $title -m $body
if ($LASTEXITCODE -ne 0) {
  Stop-SafePush 'git commit failed (see the error above). Changes remain staged.'
}

# ------------------------------------------------------ 6. Push develop

Write-Step "Pushing $AllowedBranch to $RemoteName"
# Re-check right before pushing: never push anything but develop.
$branchNow = (Invoke-Git -Arguments @('branch', '--show-current')) -join ''
if ($branchNow -ne $AllowedBranch) {
  Stop-SafePush "Branch changed to '$branchNow' during the run. Not pushing."
}

# The one and only push this script performs. No --force, no main.
& git push origin develop
if ($LASTEXITCODE -ne 0) {
  Stop-SafePush 'git push origin develop failed (see the Git error above). The commit is kept locally; no automatic recovery was attempted.'
}

Write-Host ''
Write-Host 'Successfully pushed develop. Check Shopify Oxygen for the Preview deployment.' -ForegroundColor Green
exit 0
