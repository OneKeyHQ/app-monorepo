---
name: 1k-bundle-release
description: Release branch management — checkout from release, create PRs back to release, prepare builds, pre-release diff checks, publish tracking, and sync back to x. Use this skill when managing release branches, creating branches or PRs for bundle releases, running pre-release diff checks, finalizing releases, or syncing release changes to x. Triggers on "bundle release", "release diff", "release publish", "release sync", "release checkout", "release pr", "发布管理", "release 分支", "release management", "bundle-release", "bundle branch".
allowed-tools: Bash, Read, Write, Edit, Grep, Glob
disable-model-invocation: true
---

# Release Branch Management

Manages the bundle release workflow: developers branch from `release/*`, PRs target `release/*` directly, and after publishing, changes sync back to `x` via rebase.

## Context

OneKey ships periodic App Shell releases (tagged `v{X.Y.Z}` on the `x` branch). After each App Shell release, a release branch (`release/v{X.Y.Z}`) is created from the tag. Bundle release features are developed directly on this branch — PRs target `release/*`, not `x`. After bundle publishing, changes are synced back to `x` via rebase.

**Release branch auto-detection:** All subcommands read `VERSION` from `.env.version` and construct `release/v${VERSION}` automatically.

## Quick Reference

| No. | Subcommand | When to use | Guide |
|-----|------------|-------------|-------|
| `1` | `checkout` | Start working on a bundle release feature | [checkout.md](references/rules/checkout.md) |
| `2` | `prepare` | Set BUILD_NUMBER before triggering CI | [prepare.md](references/rules/prepare.md) |
| `3` | `pr` | Create a PR from the current branch to `release/*` | [pr.md](references/rules/pr.md) |
| `4` | `diff-check` | Before publishing — review changeset | [diff-check.md](references/rules/diff-check.md) |
| `5` | `publish` | Diff check passed — record release | [publish.md](references/rules/publish.md) |
| `6` | `sync` | After publishing — rebase to x | [sync.md](references/rules/sync.md) |

## Subcommand Routing

Parse the argument passed to this skill:

- **`checkout [branch-name]`** or **`1 [branch-name]`** → Read and follow [checkout.md](references/rules/checkout.md)
- **`prepare`** or **`2`** → Read and follow [prepare.md](references/rules/prepare.md)
- **`pr`** or **`3`** → Read and follow [pr.md](references/rules/pr.md)
- **`diff-check`** or **`4`** → Read and follow [diff-check.md](references/rules/diff-check.md)
- **`publish`** or **`5`** → Read and follow [publish.md](references/rules/publish.md)
- **`sync`** or **`6`** → Read and follow [sync.md](references/rules/sync.md)
- **No argument** → Show this numbered quick reference and ask the user to reply with either the subcommand name or its number

## Typical Release Flow

```
/1k-bundle-release checkout feat/my-fix   ← Branch from release/* to start work
  ... develop ...
/1k-bundle-release prepare                ← Set BUILD_NUMBER
/1k-bundle-release pr                     ← Create PR targeting release/*
  ... QA verifies, merge ...
/1k-bundle-release diff-check             ← Review changeset before publishing
/1k-bundle-release publish                ← Record release in RELEASES.json
/1k-bundle-release sync                   ← Rebase changes to x
```

These steps are designed to run in sequence, but each can also run independently.

## Key Files

| File | Location | Purpose |
|------|----------|---------|
| Version source | `.env.version` (`VERSION` field) | Determines release branch name |
| Release tracking | `RELEASES.json` (release branch root) | Each entry: seq, commit SHA, date, PR list, notes |

## Related Skills

- `/1k-git-workflow` — Branch naming, commit conventions
- `/1k-create-pr` — General PR creation flow
- `/commit` — Create commits
