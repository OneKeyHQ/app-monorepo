---
name: 1k-bundle-release
description: Release branch management — cherry-pick verified PRs to release branch, pre-release diff validation, and publish tracking. Use this skill whenever managing release branches, cherry-picking commits to a release branch, running pre-release diff checks, finalizing releases, or discussing the release branch workflow. Triggers on "bundle release", "cherry-pick to release", "release diff", "release publish", "发布管理", "cherry-pick 到 release", "release 分支", "release management", "bundle-release", "release-ready".
allowed-tools: Bash, Read, Write, Edit, Grep, Glob
disable-model-invocation: true
---

# Release Branch Management

Automates the cherry-pick, diff-check, and publish workflow for release branches. This skill handles getting verified code from `x` onto the release branch and tracking what ships in each release.

## Context

OneKey ships periodic App Shell releases (tagged `v{X.Y.Z}` on the `x` branch). After each App Shell release, a release branch (`release/v{X.Y.Z}`) is created from the tag to accumulate verified changes via cherry-pick. Only the latest App Shell version's release branch is actively maintained.

The core invariant: **every commit on the release branch must also exist on `x`**. The release branch is a curated subset of `x`, not a fork.

## Quick Reference

| Subcommand | When to use | Guide |
|------------|-------------|-------|
| `prepare` | First step — write BUILD_NUMBER to .env.version and push | [prepare.md](references/rules/prepare.md) |
| `cherry-pick` | Ready to bring verified PRs into the next release | [cherry-pick.md](references/rules/cherry-pick.md) |
| `diff-check` | After cherry-picks, before publishing — verify integrity | [diff-check.md](references/rules/diff-check.md) |
| `publish` | Diff checks passed, ready to finalize the release | [publish.md](references/rules/publish.md) |

## Subcommand Routing

Parse the argument passed to this skill:

- **`prepare`** → Read and follow [prepare.md](references/rules/prepare.md)
- **`cherry-pick`** → Read and follow [cherry-pick.md](references/rules/cherry-pick.md)
- **`diff-check`** → Read and follow [diff-check.md](references/rules/diff-check.md)
- **`publish`** → Read and follow [publish.md](references/rules/publish.md)
- **No argument** → Show this quick reference and ask which subcommand to run

## Typical Release Flow

```
/1k-bundle-release prepare       ← Set BUILD_NUMBER in .env.version and push
/1k-bundle-release cherry-pick   ← Collect and apply verified PRs
/1k-bundle-release diff-check    ← Verify subset integrity + review changeset
/1k-bundle-release publish       ← Record release in tracking file
```

These steps are designed to run in sequence, but each can also run independently (e.g., re-running diff-check after fixing an issue).

## Label Convention

| Label | Meaning |
|-------|---------|
| `release-ready` | QA Bundle verification passed — this PR should be included in the next release |
| `no-release` | Explicitly excluded — contains native changes or requires App Shell update |
| `bundle-testing` | PR is ready for QA Bundle verification — developer has self-verified, QA is testing via Bundle in App |

Label lifecycle: developer self-verifies on branch → adds `bundle-testing` → QA tests via Bundle in App → QA passes → label changed to `release-ready`. No label = not included by default.

## Key Files

| File | Location | Purpose |
|------|----------|---------|
| Release tracking | `RELEASES.json` (release branch root) | Each entry: seq, commit SHA, date, PR list, notes |

## Related Skills

- `/1k-git-workflow` — Branch naming, commit conventions
- `/commit` — Create commits
- `/1k-create-pr` — Create pull requests
