---
name: 1k-pkg-upgrade-review
description: Reviews package version upgrades — diffs source between versions, traces call sites, and generates compatibility reports.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash, WebFetch, Write
---

# Package Upgrade Review

Evaluates npm/yarn package version upgrades by performing source-level diff analysis, tracing all call sites, and producing a structured compatibility report.

**Output language**: Chinese (matching team conventions).

## Quick Reference

| Topic | Guide | Description |
|-------|-------|-------------|
| Review workflow | [review-workflow.md](references/rules/review-workflow.md) | Step-by-step review process |
| Report template | [report-template.md](references/rules/report-template.md) | Output format and risk guidelines |
| Example report | [example-report.md](references/example-report.md) | Real case: @isaacs/brace-expansion 5.0.0 -> 5.0.1 |

## When to Use

- Dependabot / Renovate PRs that bump dependency versions
- Manual `yarn upgrade` or `npm update` changes
- Any PR that modifies `yarn.lock` or `package-lock.json`
- When team needs to understand what actually changed inside a package before merging

## Workflow Overview

1. **Identify** the package name and version range (old -> new)
2. **Download** both versions from npm registry and extract
3. **Diff** source code between versions (focus on JS/TS, not metadata)
4. **Classify** changes: API signature, return value, new exports, removed exports, behavior changes
5. **Search** project source code for direct imports/usage
6. **Search** `node_modules` for indirect usage via intermediate packages
7. **Trace** each call site to verify argument usage and compatibility
8. **Assess** compatibility risks: signature, return type, return content, side effects
9. **Generate** structured report to `node_modules/.cache/pkg-upgrade/`
10. **Post** the full report as a PR comment via `gh pr comment`

## Key Commands

```bash
# Download and extract both versions for diffing
mkdir -p /tmp/pkg-diff && cd /tmp/pkg-diff
curl -sL $(npm view PKG@OLD_VER dist.tarball) | tar xz -C old
curl -sL $(npm view PKG@NEW_VER dist.tarball) | tar xz -C new

# Compare file lists
diff -rq old/package new/package

# Diff main source
diff old/package/dist/commonjs/index.js new/package/dist/commonjs/index.js

# Search project code for direct usage
grep -r "PACKAGE_NAME" --include="*.ts" --include="*.tsx" --include="*.js" -l . \
  --exclude-dir=.git --exclude-dir=node_modules

# Search node_modules for indirect usage
grep -rn "from ['\"]PACKAGE_NAME['\"]" node_modules/ --include="*.js" --include="*.mjs" \
  | grep -v "node_modules/.cache"

# Check package metadata
npm view PKG@NEW_VER deprecated
npm view PKG@NEW_VER dist.integrity
```

## Report Output

- **Local file**: `node_modules/.cache/pkg-upgrade/<package-name>-<old>-to-<new>.md`
- **PR comment**: The full report MUST also be posted as a comment on the PR via `gh pr comment`

## Related Skills

- `/pr-review` - Security-focused PR review (supply-chain risk)
- `/1k-code-review-pr` - Build reliability and runtime quality review
