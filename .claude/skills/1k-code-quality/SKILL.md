---
name: 1k-code-quality
description: Code quality standards for OneKey. Use when fixing lint warnings, running pre-commit tasks, handling unused variables, writing comments, or ensuring code quality. All comments must be in English. Triggers on lint, linting, eslint, oxlint, tsc, type check, unused variable, comment, documentation, spellcheck, code quality, pre-commit, yarn lint.
allowed-tools: Read, Grep, Glob
---

# Code Quality

Linting, documentation, and general code quality standards for OneKey.

## Lint Commands

```bash
# Pre-commit (fast, only staged files)
yarn lint:staged
yarn tsc:staged

# CI only (full project check)
yarn lint        # Comprehensive: TypeScript, ESLint, folder structure, i18n
yarn lint:only   # Quick: oxlint only
yarn tsc:only    # Full type check
```

**Note:** `yarn lint` is for CI only. For pre-commit, always use `yarn lint:staged`.

## Pre-Commit Workflow

For fast pre-commit validation:
```bash
# Lint only modified files (recommended)
yarn lint:staged

# Or with type check
yarn lint:staged && yarn tsc:staged
```

## Common Lint Fixes

```typescript
// Unused variable - prefix with underscore
const { used, unused } = obj;     // ❌ Error: 'unused' is defined but never used
const { used, unused: _unused } = obj;  // ✅ OK

// Unused parameter - prefix with underscore
function foo(used: string, unused: number) {}     // ❌ Error
function foo(used: string, _unused: number) {}    // ✅ OK

// Floating promise - add void or await
someAsyncFunction();        // ❌ Error: Promises must be awaited
void someAsyncFunction();   // ✅ OK (fire-and-forget)
await someAsyncFunction();  // ✅ OK (wait for result)
```

## Language Requirements

**All comments must be written in English:**

```typescript
// ✅ GOOD: English comment
// Calculate the total balance including pending transactions

// ❌ BAD: Chinese comment
// 计算总余额，包括待处理的交易

// ✅ GOOD: JSDoc in English
/**
 * Fetches user balance from the blockchain.
 * @param address - The wallet address to query
 * @returns The balance in native token units
 */
async function fetchBalance(address: string): Promise<bigint> {
  // ...
}
```

## When to Comment

```typescript
// ✅ GOOD: Explain non-obvious logic
// Use 1.5x gas limit to account for estimation variance on this chain
const gasLimit = estimatedGas * 1.5n;

// ✅ GOOD: Explain business logic
// Premium users get 50% discount on transaction fees
const fee = isPremium ? baseFee * 0.5 : baseFee;

// ❌ BAD: Obvious comment
// Set the value to 5
const value = 5;
```

## Development Principles

### Single Responsibility
Each function should perform a single, atomic task:

```typescript
// ✅ GOOD: Single responsibility
async function fetchUserBalance(userId: string): Promise<Balance> {
  const user = await getUser(userId);
  return await getBalanceForAddress(user.address);
}

// ❌ BAD: Multiple responsibilities
async function fetchUserBalanceAndUpdateUI(userId: string) {
  const user = await getUser(userId);
  const balance = await getBalanceForAddress(user.address);
  setBalanceState(balance);
  showNotification('Balance updated');
  logAnalytics('balance_fetched');
}
```

### Avoid Over-Abstraction
Don't create helpers for one-time operations:

```typescript
// ❌ BAD: Over-abstracted
const createUserFetcher = (config: Config) => {
  return (userId: string) => {
    return fetchWithConfig(config, `/users/${userId}`);
  };
};
const fetchUser = createUserFetcher(defaultConfig);
const user = await fetchUser(userId);

// ✅ GOOD: Simple and direct
const user = await fetch(`/api/users/${userId}`).then(r => r.json());
```

## Detailed Guides

### Code Quality Standards
See [code-quality.md](references/rules/code-quality.md) for comprehensive guidelines:
- Linting commands and pre-commit workflow
- Comment and documentation standards
- Language requirements (English only)
- Single responsibility principle
- Avoiding over-abstraction
- Consistent naming conventions
- Code quality checklist

### Fixing Lint Warnings
See [fix-lint.md](references/rules/fix-lint.md) for complete lint fix workflow:
- Analyzing lint warnings
- Categorizing lint errors
- Common fix patterns by category
- Spellcheck fixes
- Unused variable/parameter handling
- Automated fix strategies
- Testing after fixes

## Spellcheck

If a technical term triggers spellcheck errors:
```bash
# Check if word exists
grep -i "yourword" development/spellCheckerSkipWords.txt

# Add if not present (ask team lead first)
echo "yourword" >> development/spellCheckerSkipWords.txt
```

## Checklist

### Pre-commit
- [ ] `yarn lint:staged` passes
- [ ] `yarn tsc:staged` passes

### Code Quality
- [ ] All comments are in English
- [ ] No commented-out code committed
- [ ] Functions have single responsibility
- [ ] No unnecessary abstractions
- [ ] Consistent naming conventions

## Related Skills

- `/1k-sentry-analysis` - Sentry error analysis and fixes
- `/1k-test-version` - Test version creation workflow
- `/1k-coding-patterns` - General coding patterns
