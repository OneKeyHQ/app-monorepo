# Quick Commands

Bash one-liners for automated PR review checks. Run relevant ones based on the triage.

## Diff & Scope

```bash
# Change summary
git diff origin/x...HEAD --stat

# Changed files list
git diff origin/x...HEAD --name-only

# Changed files with status (A/M/D)
git diff origin/x...HEAD --name-status
```

## Security & Secrets

```bash
# Potential secret/PII in diff
git diff origin/x...HEAD | grep -i -E "mnemonic|seed|private.?key|secret|password|token|apiKey"

# File upload without size validation
git diff origin/x...HEAD | grep -B5 -A10 "file\." | grep -v "size"
```

## Import Hierarchy

```bash
# kit-bg importing from components (FORBIDDEN)
grep -r "from.*@onekeyhq/components" packages/kit-bg/src/ 2>/dev/null

# shared importing from other onekey packages (FORBIDDEN)
grep -r "from.*@onekeyhq/" packages/shared/src/ 2>/dev/null | grep -v "@onekeyhq/shared"
```

## React Hooks

```bash
# useEffect with eslint-disable (potential dependency issues)
git diff origin/x...HEAD | grep -A5 "useEffect" | grep "eslint-disable"

# setState in async context (potential race condition)
git diff origin/x...HEAD | grep -B5 "setState\|set[A-Z]" | grep -E "then\(|await"

# Captured refs in cleanup (potential stale ref)
git diff origin/x...HEAD | grep -B10 "return.*=>" | grep "const.*=.*Ref.current"

# Missing cleanup: setState without clearing stale data
git diff origin/x...HEAD | grep -B3 -A3 "useEffect" | grep -E "fetch|load" | grep -v "set.*\[\]|set.*null"
```

## Performance

```bash
# Loops with await inside (sequential API calls)
git diff origin/x...HEAD | grep -E "for.*\{|forEach|\.map\(" -A10 | grep "await"

# map/forEach with index that mutates array
git diff origin/x...HEAD | grep -E "\.map\(|\.forEach\(" -A5 | grep -E "splice|shift|pop"
```

## Null Safety

```bash
# Missing optional chaining on refs
git diff origin/x...HEAD | grep -E "\.current\.[a-zA-Z]|ref\.[a-zA-Z]" | grep -v "?."

# Array index access without bounds check
git diff origin/x...HEAD | grep -E "\[index\]|\[i\]|\[0\]" -A2 | grep -v "if.*length\|if.*!"

# Division without zero guard
git diff origin/x...HEAD | grep -E "/ [a-zA-Z]" | grep -v "if.*===.*0\|if.*>.*0"
```

## Dependencies

```bash
# New/changed dependencies
git diff origin/x...HEAD -- '**/package.json' | grep -E '^\+.*"[^"]+": "[^"]+"'

# Check if new deps are deprecated
git diff origin/x...HEAD -- '**/package.json' | grep '^\+' | \
  grep -oE '"[^"]+": "[^"]+"' | cut -d'"' -f2 | \
  xargs -I{} sh -c 'npm view {} deprecated 2>/dev/null && echo "^^^ {}"'
```

## Error Handling

```bash
# Silent catch blocks (catch without user feedback)
git diff origin/x...HEAD | grep -A3 "catch" | grep -v "Toast\|throw\|error"

# Debounced functions missing promise return
git diff origin/x...HEAD | grep -E "debounce|setTimeout.*validate" -A5 | grep -v "Promise\|resolve"
```

## Platform

```bash
# Platform-specific files in diff
git diff origin/x...HEAD --name-only | grep -E "\.(android|ios|native|desktop|ext)\.(ts|tsx)$"

# Native module interactions
git diff origin/x...HEAD | grep -E "NativeModules|TurboModule|requireNativeComponent"

# BigNumber operations without type coercion
git diff origin/x...HEAD | grep -E "BigNumber|shiftedBy|dividedBy" | grep -v "Number("
```

## Build & CI

```bash
# extraResources references in electron-builder configs
grep -r "extraResources\|extraFiles" apps/*/electron-builder*.js 2>/dev/null

# Shell scripts with early exits
grep -n "exit 0\|exit 1" apps/*/scripts/*.sh 2>/dev/null

# CI workflow steps
grep -A2 "name:" .github/workflows/*.yml 2>/dev/null
```

## File Analysis

```bash
# Categorize changed files
git diff origin/x...HEAD --name-only | grep -E '\.(ts|tsx)$'     # Code
git diff origin/x...HEAD --name-only | grep -E '\.(json|ya?ml)$' # Config
git diff origin/x...HEAD --name-only | grep -E '(\.test\.|\.spec\.|__tests__)' # Tests

# Security-critical file patterns
git diff origin/x...HEAD --name-only | grep -E "(auth|vault|signing|crypto|secret|password|token)"

# Platform-specific variant detection
git diff origin/x...HEAD --name-only | sed 's/\.\(native\|web\|desktop\|ext\)\.ts/.ts/' | sort -u
```
