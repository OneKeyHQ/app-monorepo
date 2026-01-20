---
name: fix-lint
description: Helps fix oxlint errors and warnings in the OneKey codebase. Use when running yarn lint and encountering warnings, cleaning up code before committing, or fixing spellcheck, unused variable, or other linting warnings.
---

# Fix Lint Skill

This skill helps fix oxlint warnings in the OneKey app-monorepo codebase.

**IMPORTANT**: This project uses **oxlint** (not ESLint). The active linting configuration is in `.oxlintrc.json`.

## Usage

Use this skill when:
- Running `yarn lint` and encountering warnings
- Cleaning up code before committing
- Fixing spellcheck, unused variable, or other ESLint warnings

## Workflow

### Step 1: Run Lint and Analyze Warnings

```bash
yarn lint:only 2>&1 | tail -100
```

### Step 2: Categorize Warnings

Warnings typically fall into these categories:

| Category | Rule | Fix Strategy |
|----------|------|--------------|
| Spellcheck | `@cspell/spellchecker` | Add to skip list or fix typo |
| Unused vars | `@typescript-eslint/no-unused-vars` | Remove import or prefix with `_` |
| Non-null assertion | `@typescript-eslint/no-non-null-assertion` | Add type guard or cast |
| Nested components | `react/no-unstable-nested-components` | Extract component |
| Import order | `import/order` | Fix import ordering |

### Step 3: Fix Each Category

#### Spellcheck Warnings (`@cspell/spellchecker`)

1. **Evaluate the word**: Is it a legitimate technical term or a typo?

2. **For legitimate technical terms**, add to skip list:
   ```text
   # File: development/spellCheckerSkipWords.txt
   # Add the word on a new line at the end of the file
   newTechnicalTerm
   ```

3. **For known typos** that can't be fixed (e.g., in translation keys), add with a comment above:
   ```text
   # Known typo - exsited -> existed (ETranslations.some_key)
   exsited
   ```

4. **Common legitimate terms to add**:
   - Build tools: `chunkhash`, `minimizer`, `rspack`
   - Blockchain: `lovelace`, `Kusama`, `workchain`, `feebump`
   - UI: `Virtualized`, `overscan`, `overscrolling`
   - Crypto: `nacl`, `Bech32`, `secp256k1`

#### Unused Variable Warnings (`@typescript-eslint/no-unused-vars`)

1. **Unused imports** - Remove the import:
   ```typescript
   // Before
   import { Used, Unused } from 'package';
   // After
   import { Used } from 'package';
   ```

2. **Unused function parameters** - Prefix with underscore:
   ```typescript
   // Before
   function foo(used: string, unused: number) { return used; }
   // After
   function foo(used: string, _unused: number) { return used; }
   ```

3. **Unused destructured variables** - Prefix with underscore:
   ```typescript
   // Before
   const { used, unused } = obj;
   // After
   const { used, unused: _unused } = obj;
   ```

4. **Unused assigned variables** - Prefix with underscore:
   ```typescript
   // Before
   const unused = getValue();
   // After
   const _unused = getValue();
   ```

#### Non-null Assertion Warnings (`@typescript-eslint/no-non-null-assertion`)

Add type assertions or guards:
```typescript
// Before
const value = obj.prop!.name;
// After
const value = (obj.prop as { name: string } | undefined)?.name;
```

#### Nested Component Warnings (`react/no-unstable-nested-components`)

Extract the component outside the parent:
```typescript
// Before
function Parent() {
  const NestedComponent = () => <div />;
  return <NestedComponent />;
}

// After
const ExtractedComponent = () => <div />;
function Parent() {
  return <ExtractedComponent />;
}
```

### Step 4: Verify Fixes

```bash
yarn lint:only 2>&1 | tail -50
```

## Common Patterns in This Codebase

### Translation Key Typos
Translation enum keys (e.g., `ETranslations.perp_invaild_tp_sl`) cannot be easily renamed as they're managed externally. Add to skip list with a comment:
```text
# Known typo in translation key - invaild -> invalid
invaild
```

### Provider API Methods
Methods like `openInMobileApp` that throw `NotImplemented()` often have unused parameters:
```typescript
public async openInMobileApp(
  _request: IJsBridgeMessagePayload,
  _params: ISignMessagePayload,
): Promise<void> {
  throw new NotImplemented();
}
```

### Destructuring from Hooks
When destructuring from hooks but not using all values:
```typescript
const { used, unused: _unused } = usePromiseResult(...);
```

## Tips

1. **Run lint with increased memory** for large codebases:
   ```bash
   yarn lint:only
   ```

2. **Check if word is in skip list** before adding:
   ```bash
   grep -i "wordToCheck" development/spellCheckerSkipWords.txt
   ```

3. **For bulk fixes**, use Task agents to parallelize work across multiple files

4. **Verify no regressions** after fixes:
   ```bash
   yarn tsc:only
   ```

## Files Modified During Lint Fixes

- `development/spellCheckerSkipWords.txt` - Add technical terms and known typos (one word per line, use `#` for comments)
- Various `.ts` and `.tsx` files - Fix unused variables and imports
