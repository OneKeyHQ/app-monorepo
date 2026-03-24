---
name: 1k-bundle-release
description: Release branch management — checkout from release, prepare builds, pre-release diff checks, publish tracking, and sync back to x. Use this skill when managing release branches, creating branches for bundle releases, running pre-release diff checks, finalizing releases, or syncing release changes to x. Triggers on "bundle release", "release diff", "release publish", "release sync", "release checkout", "发布管理", "release 分支", "release management", "bundle-release", "bundle branch".
allowed-tools: Bash, Read, Write, Edit, Grep, Glob
disable-model-invocation: true
---

# Release Branch Management

Manages the bundle release workflow: developers branch from `release/*`, PRs target `release/*` directly, and after publishing, changes sync back to `x` via rebase.

## Context

OneKey ships periodic App Shell releases (tagged `v{X.Y.Z}` on the `x` branch). After each App Shell release, a release branch (`release/v{X.Y.Z}`) is created from the tag. Bundle release features are developed directly on this branch — PRs target `release/*`, not `x`. After bundle publishing, changes are synced back to `x` via rebase.

**Release branch auto-detection:** All subcommands read `VERSION` from `.env.version` and construct `release/v${VERSION}` automatically.

## Quick Reference

| Subcommand | When to use | Guide |
|------------|-------------|-------|
| `checkout` | Start working on a bundle release feature | [checkout.md](references/rules/checkout.md) |
| `prepare` | Set BUILD_NUMBER before triggering CI | [prepare.md](references/rules/prepare.md) |
| `diff-check` | Before publishing — review changeset | [diff-check.md](references/rules/diff-check.md) |
| `publish` | Diff check passed — record release | [publish.md](references/rules/publish.md) |
| `sync` | After publishing — rebase to x | [sync.md](references/rules/sync.md) |

## Subcommand Routing

Parse the argument passed to this skill:

- **`checkout [branch-name]`** → Read and follow [checkout.md](references/rules/checkout.md)
- **`prepare`** → Read and follow [prepare.md](references/rules/prepare.md)
- **`diff-check`** → Read and follow [diff-check.md](references/rules/diff-check.md)
- **`publish`** → Read and follow [publish.md](references/rules/publish.md)
- **`sync`** → Read and follow [sync.md](references/rules/sync.md)
- **No argument** → Show this quick reference and ask which subcommand to run

## Typical Release Flow

```
/1k-bundle-release checkout feat/my-fix   ← Branch from release/* to start work
  ... develop, create PR targeting release/*, QA verifies, merge ...
/1k-bundle-release prepare                ← Set BUILD_NUMBER
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
- `/commit` — Create commits
