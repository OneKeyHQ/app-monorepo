---
name: 1k-bundle-release
description: Release branch management — checkout from release, prepare builds, pre-release diff checks, security audits, publish tracking, and sync back to x. Use this skill when managing release branches, creating branches for bundle releases, running pre-release diff checks, auditing release security, finalizing releases, or syncing release changes to x. Triggers on "bundle release", "release diff", "release publish", "release sync", "release checkout", "release audit", "发布管理", "release 分支", "release management", "bundle-release", "bundle branch", "发布审计", "安全审计 release".
allowed-tools: Bash, Read, Write, Edit, Grep, Glob
disable-model-invocation: true
---

# Release Branch Management

Manages the bundle release workflow: developers branch from `release/*`, PRs target `release/*` directly, and after publishing, changes sync back to `x` via rebase.

## Context

OneKey ships periodic App Shell releases (tagged `v{X.Y.Z}` on the `x` branch). After each App Shell release, a release branch (`release/v{X.Y.Z}`) is created from the tag. Bundle release features are developed directly on this branch — PRs target `release/*`, not `x`. After bundle publishing, changes are synced back to `x` via rebase.

**Release branch auto-detection:** All subcommands use the shared detection logic below to determine the release branch. On a `release/v*` branch it's used directly; otherwise the latest release branch is discovered from the remote.

## Release Branch Detection (Shared)

All subcommands MUST use this logic instead of reading `.env.version` directly. The reason: `.env.version` on `x` contains the **next** version (e.g., `6.2.0`), while the release branch uses the **current** version (e.g., `release/v6.1.0`). Reading `.env.version` from `x` produces the wrong branch name.

```bash
current_branch=$(git branch --show-current)

if [[ "$current_branch" == release/v* ]]; then
  # Already on a release branch — use it directly
  RELEASE_BRANCH="$current_branch"
else
  # Not on a release branch — find the latest one from remote
  git fetch origin
  RELEASE_BRANCH=$(git branch -r \
    | grep 'origin/release/v' \
    | grep -v mock \
    | sed 's|origin/||' \
    | sort -V \
    | tail -1 \
    | tr -d ' ')
fi

if [[ -z "$RELEASE_BRANCH" ]]; then
  echo "No release branch found on origin."
  exit 1
fi
```

After detection, confirm with the user:

> "Detected release branch: `$RELEASE_BRANCH`. Proceed? (y/n)"

If the user wants a different branch, let them specify it manually.

## Quick Reference

| Subcommand | When to use | Guide |
|------------|-------------|-------|
| `checkout` | Start working on a bundle release feature | [checkout.md](references/rules/checkout.md) |
| `prepare` | Set BUILD_NUMBER before triggering CI | [prepare.md](references/rules/prepare.md) |
| `diff-check` | Before publishing — quick changeset review | [diff-check.md](references/rules/diff-check.md) |
| `audit` | Before publishing — full security & supply-chain audit | [audit.md](references/rules/audit.md) |
| `publish` | Diff check passed — record release | [publish.md](references/rules/publish.md) |
| `sync` | After publishing — rebase to x | [sync.md](references/rules/sync.md) |

## Subcommand Routing

Parse the argument passed to this skill:

- **`checkout [branch-name]`** → Read and follow [checkout.md](references/rules/checkout.md)
- **`prepare`** → Read and follow [prepare.md](references/rules/prepare.md)
- **`diff-check`** → Read and follow [diff-check.md](references/rules/diff-check.md)
- **`audit`** → Read and follow [audit.md](references/rules/audit.md)
- **`publish`** → Read and follow [publish.md](references/rules/publish.md)
- **`sync`** → Read and follow [sync.md](references/rules/sync.md)
- **No argument** → Show this quick reference and ask which subcommand to run

## Typical Release Flow

```
/1k-bundle-release checkout feat/my-fix   ← Branch from release/* to start work
  ... develop, create PR targeting release/*, QA verifies, merge ...
/1k-bundle-release prepare                ← Set BUILD_NUMBER
/1k-bundle-release diff-check             ← Quick changeset review
/1k-bundle-release audit                  ← Full security audit (optional, recommended)
/1k-bundle-release publish                ← Record release in RELEASES.json
/1k-bundle-release sync                   ← Rebase changes to x
```

These steps are designed to run in sequence, but each can also run independently.

## Key Files

| File | Location | Purpose |
|------|----------|---------|
| Version source | Auto-detected from current branch or remote `release/v*` branches | Determines release branch name |
| Release tracking | `RELEASES.json` (release branch root) | Each entry: seq, commit SHA, date, PR list, notes |

## Related Skills

- `/1k-git-workflow` — Branch naming, commit conventions
- `/commit` — Create commits
