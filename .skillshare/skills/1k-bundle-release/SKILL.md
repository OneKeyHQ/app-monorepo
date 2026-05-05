---
name: 1k-bundle-release
description: Bundle release workflow — checkout, prepare, pr, diff-check, audit, publish, sync.
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

| No. | Subcommand | When to use | Guide |
|-----|------------|-------------|-------|
| `1` | `checkout` | Start working on a bundle release feature | [checkout.md](references/rules/checkout.md) |
| `2` | `prepare` | Set BUILD_NUMBER before triggering CI | [prepare.md](references/rules/prepare.md) |
| `3` | `pr` | Create a PR from the current branch to `release/*` | [pr.md](references/rules/pr.md) |
| `4` | `diff-check` | Before publishing — quick changeset review | [diff-check.md](references/rules/diff-check.md) |
| `5` | `audit` | Before publishing — full security & supply-chain audit | [audit.md](references/rules/audit.md) |
| `6` | `publish` | Diff check passed — record release | [publish.md](references/rules/publish.md) |
| `7` | `sync` | After publishing — rebase to x | [sync.md](references/rules/sync.md) |

## Subcommand Routing

Parse the argument passed to this skill:

- **`checkout [branch-name]`** or **`1 [branch-name]`** → Read and follow [checkout.md](references/rules/checkout.md)
- **`prepare`** or **`2`** → Read and follow [prepare.md](references/rules/prepare.md)
- **`pr`** or **`3`** → Read and follow [pr.md](references/rules/pr.md)
- **`diff-check`** or **`4`** → Read and follow [diff-check.md](references/rules/diff-check.md)
- **`audit`** or **`5`** → Read and follow [audit.md](references/rules/audit.md)
- **`publish`** or **`6`** → Read and follow [publish.md](references/rules/publish.md)
- **`sync`** or **`7`** → Read and follow [sync.md](references/rules/sync.md)
- **No argument** → Show this numbered quick reference and ask the user to reply with either the subcommand name or its number

## Typical Release Flow

```
/1k-bundle-release checkout feat/my-fix   ← Branch from release/* to start work
  ... develop ...
/1k-bundle-release prepare                ← Set BUILD_NUMBER
/1k-bundle-release pr                     ← Create PR targeting release/*
  ... QA verifies, merge ...
/1k-bundle-release diff-check             ← Quick changeset review
/1k-bundle-release audit                  ← Full security audit (optional, recommended)
/1k-bundle-release publish                ← Record release in RELEASES.json (via PR)
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
