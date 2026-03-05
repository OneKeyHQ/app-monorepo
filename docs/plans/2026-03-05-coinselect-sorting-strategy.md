# Coinselect `sortingStrategy` Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expose `sortingStrategy` as an optional parameter in `@onekeyfe/coinselect` witness entry point so callers can control output ordering.

**Architecture:** Add one optional parameter with default value to preserve backward compatibility. Two files changed in the coinselect SDK repo.

**Tech Stack:** JavaScript, TypeScript (declaration file)

---

### Task 1: Update `witness.js` to accept and pass through `sortingStrategy`

**Files:**
- Modify: `witness.js` (in `@onekeyfe/coinselect` repo, NOT in node_modules)

**Step 1: Add `sortingStrategy` to destructured params with default value**

Change the function signature from:

```js
module.exports = function coinSelect ({
  utxos,
  outputs,
  feeRate,
  changeAddress,
  network,
  txType,
  baseFee = 0,
  dustThreshold = 546
}) {
```

To:

```js
module.exports = function coinSelect ({
  utxos,
  outputs,
  feeRate,
  changeAddress,
  network,
  txType,
  baseFee = 0,
  dustThreshold = 546,
  sortingStrategy = 'random'
}) {
```

**Step 2: Pass `sortingStrategy` to `composeTx` instead of hardcoded `'random'`**

Change:

```js
  const result = composeTx({
    utxos,
    outputs,
    feeRate,
    sortingStrategy: 'random',
```

To:

```js
  const result = composeTx({
    utxos,
    outputs,
    feeRate,
    sortingStrategy,
```

**Step 3: Verify manually**

Run any existing tests for the coinselect package to ensure nothing breaks.

**Step 4: Commit**

```bash
git add witness.js
git commit -m "feat: expose sortingStrategy parameter in witness entry point"
```

---

### Task 2: Update `witness.d.ts` type declaration

**Files:**
- Modify: `witness.d.ts` (in `@onekeyfe/coinselect` repo)

**Step 1: Add `sortingStrategy` to `ICoinSelectParams`**

Add this line to the interface:

```ts
sortingStrategy?: 'bip69' | 'none' | 'random';
```

After the `dustThreshold` field.

**Step 2: Commit**

```bash
git add witness.d.ts
git commit -m "feat: add sortingStrategy type to ICoinSelectParams"
```

---

### Task 3: Publish and update dependency (if applicable)

After merging to the coinselect SDK repo, bump the version and update `@onekeyfe/coinselect` in `x-app-monorepo`'s `package.json` + `yarn.lock`.

---

**Total changes:** 2 files, ~4 lines modified.
