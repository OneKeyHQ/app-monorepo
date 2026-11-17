# Quick Commands

Bash helpers and checks for the selected PR or local diff. Run relevant checks
based on triage; do not substitute a default branch comparison later.

## Select The Review Scope

Resolve the actual target before running checks. For a PR, obtain its base/head
SHAs from that PR and fetch any missing objects without switching the active
checkout. For a branch review, resolve the requested base/head to commit SHAs.
Set `REVIEW_SOURCE_KIND` and `REVIEW_DIFF_ARGS` to exactly one row:

| Requested scope | `REVIEW_DIFF_ARGS` | `REVIEW_SOURCE_KIND` |
|-----------------|--------------------|----------------------|
| PR or branch changes | `("$REVIEW_BASE_SHA...$REVIEW_HEAD_SHA")` | `commit` |
| Staged changes | `(--cached)` | `index` |
| Unstaged tracked changes | `()` | `worktree` |
| All tracked changes since HEAD | `(HEAD)` | `worktree` |

The commit row compares from the selected base/head's merge base. In that row,
`REVIEW_HEAD_SHA` must identify the reviewed head, not the active checkout.
`git diff` excludes untracked files: when requested, inspect them separately
from the worktree, using `git diff --no-index -- /dev/null <file>` for a patch
(exit 1 means differences). Recheck the selection if refs, index, or worktree
content change during review.

After selecting the row, define these helpers once in the same Bash session.
They read Git objects or source files without switching or rewriting checkout:

```bash
review_diff() {
  : "${REVIEW_SOURCE_KIND:?Select the review scope first}"
  git diff "${REVIEW_DIFF_ARGS[@]}" "$@"
}

review_file() {
  case "$REVIEW_SOURCE_KIND" in
    commit) git show "${REVIEW_HEAD_SHA:?Resolve the reviewed head first}:$1" ;;
    index) git show ":$1" ;;
    worktree) cat -- "$1" ;;
    *) printf 'Select the review source first\n' >&2; return 2 ;;
  esac
}
```

All examples below and in the security guide use these helpers. Inspect full
source with `review_file <path>` so staged reviews cannot accidentally read
unstaged edits and PR reviews cannot inspect an unrelated checkout.

## Diff & Scope

```bash
# Change summary
review_diff --stat

# Changed files list
review_diff --name-only

# Changed files with status (A/M/D)
review_diff --name-status
```

## Security & Secrets

```bash
# Potential secret/PII fields in diff; do not print secret values
review_diff | rg -n -i -o 'mnemonic|seed|private.?key|secret|password|token|apiKey'

# File upload without size validation
review_diff | grep -B5 -A10 "file\." | grep -v "size"
```

## Import Hierarchy

```bash
# Read changed files from the reviewed source, including staged-only imports
review_diff --name-only --diff-filter=ACMR -- '*.ts' '*.tsx' |
  while IFS= read -r f; do
    case "$f" in
      packages/kit-bg/*)
        review_file "$f" | rg -n 'from.*@onekeyhq/(components|kit)(/|["\x27])' ;;
      packages/shared/*)
        review_file "$f" | rg -n 'from.*@onekeyhq/' | rg -v '@onekeyhq/shared' ;;
    esac
  done
```

## React Hooks

```bash
# useEffect with eslint-disable (potential dependency issues)
review_diff | grep -A5 "useEffect" | grep "eslint-disable"

# setState in async context (potential race condition)
review_diff | grep -B5 "setState\|set[A-Z]" | grep -E "then\(|await"

# Captured refs in cleanup (potential stale ref)
review_diff | grep -B10 "return.*=>" | grep "const.*=.*Ref.current"

# Missing cleanup: setState without clearing stale data
review_diff | grep -B3 -A3 "useEffect" | grep -E "fetch|load" | grep -v "set.*\[\]|set.*null"
```

## Performance

```bash
# Loops with await inside (sequential API calls)
review_diff | grep -E "for.*\{|forEach|\.map\(" -A10 | grep "await"

# map/forEach with index that mutates array
review_diff | grep -E "\.map\(|\.forEach\(" -A5 | grep -E "splice|shift|pop"
```

## Null Safety

```bash
# Missing optional chaining on refs
review_diff | grep -E "\.current\.[a-zA-Z]|ref\.[a-zA-Z]" | grep -v "?."

# Array index access without bounds check
review_diff | grep -E "\[index\]|\[i\]|\[0\]" -A2 | grep -v "if.*length\|if.*!"

# Division without zero guard
review_diff | grep -E "/ [a-zA-Z]" | grep -v "if.*===.*0\|if.*>.*0"
```

## Dependencies

```bash
# New/changed dependencies
review_diff -- '**/package.json' | grep -E '^\+.*"[^"]+": "[^"]+"'

# Check if new deps are deprecated
review_diff -- '**/package.json' | grep '^\+' | \
  grep -oE '"[^"]+": "[^"]+"' | cut -d'"' -f2 | \
  xargs -I{} sh -c 'npm view {} deprecated 2>/dev/null && echo "^^^ {}"'
```

## Error Handling

```bash
# Silent catch blocks (catch without user feedback)
review_diff | grep -A3 "catch" | grep -v "Toast\|throw\|error"

# Debounced functions missing promise return
review_diff | grep -E "debounce|setTimeout.*validate" -A5 | grep -v "Promise\|resolve"
```

## Platform

```bash
# Platform-specific files in diff
review_diff --name-only | grep -E "\.(android|ios|native|desktop|ext)\.(ts|tsx)$"

# Native module interactions
review_diff | grep -E "NativeModules|TurboModule|requireNativeComponent"

# BigNumber operations without type coercion
review_diff | grep -E "BigNumber|shiftedBy|dividedBy" | grep -v "Number("
```

## Build & CI

```bash
# Relevant build inputs from the selected patch
review_diff -- 'apps/*/electron-builder*.js' | rg 'extraResources|extraFiles'

# Shell scripts with early exits
review_diff -- 'apps/*/scripts/*.sh' | rg 'exit [01]'

# CI workflow steps
review_diff -- '.github/workflows/*.yml' | rg -A2 'name:'
```

## File Analysis

```bash
# Categorize changed files
review_diff --name-only | grep -E '\.(ts|tsx)$'     # Code
review_diff --name-only | grep -E '\.(json|ya?ml)$' # Config
review_diff --name-only | grep -E '(\.test\.|\.spec\.|__tests__)' # Tests

# Security-critical file patterns
review_diff --name-only | grep -E "(auth|vault|signing|crypto|secret|password|token)"

# Platform-specific variant detection
review_diff --name-only | sed 's/\.\(native\|web\|desktop\|ext\)\.ts/.ts/' | sort -u
```
