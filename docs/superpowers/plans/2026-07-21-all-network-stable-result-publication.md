# All-Network Stable Result Publication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent `useAllNetworkRequests` from publishing a completed aggregate result when a newer rerun is already queued, so Portfolio only receives the final stable token snapshot.

**Architecture:** Add a small pure result-resolution utility that keeps the last stable result scoped by the all-network run signature. `useAllNetworkRequests` will decide publication only after `onFinished` and rerun detection; superseded runs return the previous stable result reference (or `undefined` for the first run), while the final run records and publishes its aggregate result.

**Tech Stack:** TypeScript, React hooks, Jest, existing `usePromiseResult` and all-network request queue.

---

## File Structure

- Create `packages/kit/src/hooks/allNetworkRunResultUtils.ts`: pure stable-result publication decision and associated types.
- Create `packages/kit/src/hooks/allNetworkRunResultUtils.test.ts`: unit coverage for stable, superseded, owner-scoped, and empty results.
- Modify `packages/kit/src/hooks/useAllNetwork.ts`: integrate the publication decision after `onFinished` and before returning the aggregate result.

### Task 1: Add stable result publication utility with tests

**Files:**
- Create: `packages/kit/src/hooks/allNetworkRunResultUtils.ts`
- Create: `packages/kit/src/hooks/allNetworkRunResultUtils.test.ts`

- [ ] **Step 1: Write the failing utility tests**

```ts
import { resolveAllNetworkPublishedResult } from './allNetworkRunResultUtils';

describe('resolveAllNetworkPublishedResult', () => {
  const signature = 'account-1|all--networks|wallet-1|0|0';

  test('publishes and records a stable result', () => {
    const result = [{ networkId: 'evm--1' }];

    expect(
      resolveAllNetworkPublishedResult({
        completedResult: result,
        hasQueuedRerun: false,
        lastPublished: undefined,
        runSignature: signature,
      }),
    ).toEqual({
      publishedResult: result,
      nextLastPublished: { result, runSignature: signature },
    });
  });

  test('keeps the previous stable result when the run is superseded', () => {
    const previous = [{ networkId: 'btc--0' }];

    expect(
      resolveAllNetworkPublishedResult({
        completedResult: [{ networkId: 'evm--1' }],
        hasQueuedRerun: true,
        lastPublished: { result: previous, runSignature: signature },
        runSignature: signature,
      }),
    ).toEqual({
      publishedResult: previous,
      nextLastPublished: { result: previous, runSignature: signature },
    });
  });

  test('does not reuse a stable result from another owner', () => {
    const previous = [{ networkId: 'btc--0' }];

    expect(
      resolveAllNetworkPublishedResult({
        completedResult: [{ networkId: 'evm--1' }],
        hasQueuedRerun: true,
        lastPublished: {
          result: previous,
          runSignature: 'another-account|all--networks|wallet-2|0|0',
        },
        runSignature: signature,
      }),
    ).toEqual({
      publishedResult: undefined,
      nextLastPublished: {
        result: previous,
        runSignature: 'another-account|all--networks|wallet-2|0|0',
      },
    });
  });

  test('publishes a stable empty result', () => {
    expect(
      resolveAllNetworkPublishedResult({
        completedResult: null,
        hasQueuedRerun: false,
        lastPublished: undefined,
        runSignature: signature,
      }),
    ).toEqual({
      publishedResult: null,
      nextLastPublished: { result: null, runSignature: signature },
    });
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
yarn test packages/kit/src/hooks/allNetworkRunResultUtils.test.ts
```

Expected: FAIL because `allNetworkRunResultUtils.ts` does not exist.

- [ ] **Step 3: Implement the minimal pure utility**

```ts
export type IAllNetworkLastPublishedResult<T> = {
  result: Array<T> | null;
  runSignature: string;
};

export function resolveAllNetworkPublishedResult<T>({
  completedResult,
  hasQueuedRerun,
  lastPublished,
  runSignature,
}: {
  completedResult: Array<T> | null;
  hasQueuedRerun: boolean;
  lastPublished: IAllNetworkLastPublishedResult<T> | undefined;
  runSignature: string;
}): {
  publishedResult: Array<T> | null | undefined;
  nextLastPublished: IAllNetworkLastPublishedResult<T> | undefined;
} {
  if (hasQueuedRerun) {
    return {
      publishedResult:
        lastPublished?.runSignature === runSignature
          ? lastPublished.result
          : undefined,
      nextLastPublished: lastPublished,
    };
  }

  const nextLastPublished = {
    result: completedResult,
    runSignature,
  };
  return {
    publishedResult: completedResult,
    nextLastPublished,
  };
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run:

```bash
yarn test packages/kit/src/hooks/allNetworkRunResultUtils.test.ts
```

Expected: PASS with four tests.

- [ ] **Step 5: Commit the utility and tests**

```bash
git add packages/kit/src/hooks/allNetworkRunResultUtils.ts packages/kit/src/hooks/allNetworkRunResultUtils.test.ts
git commit -m "test: cover stable all-network result publication"
```

### Task 2: Gate `useAllNetworkRequests` final result publication

**Files:**
- Modify: `packages/kit/src/hooks/useAllNetwork.ts:253-980`
- Test: `packages/kit/src/hooks/allNetworkRunResultUtils.test.ts`

- [ ] **Step 1: Import the utility and add stable result state**

Add the import:

```ts
import {
  type IAllNetworkLastPublishedResult,
  resolveAllNetworkPublishedResult,
} from './allNetworkRunResultUtils';
```

Inside `useAllNetworkRequests<T>`, next to the rerun refs, add:

```ts
const lastPublishedResultRef = useRef<
  IAllNetworkLastPublishedResult<T> | undefined
>(undefined);
```

- [ ] **Step 2: Keep the completed response available after `finally`**

Before the main request `try`, define:

```ts
let completedResult: Array<T> | null = null;
let hasQueuedRerun = false;
```

Replace the inner `let resp: Array<T> | null = null` with assignments to `completedResult`, including both warm and cold branches. Update result-count logging to read `completedResult`.

- [ ] **Step 3: Decide publication after `onFinished`**

In the `finally` block, after awaiting `onFinished`, capture rerun state before clearing it:

```ts
hasQueuedRerun = rerunAfterCurrentRef.current;
if (hasQueuedRerun) {
  rerunAfterCurrentRef.current = false;
  const rerunConfig = rerunConfigRef.current;
  rerunConfigRef.current = undefined;
  setTimeout(() => {
    void runWithQueueRef.current?.(rerunConfig);
  }, 0);
}
```

Do not add an await after assigning `hasQueuedRerun`.

- [ ] **Step 4: Publish only the stable result**

Remove `return resp` from inside the `try`. Immediately after `finally`, resolve and store the public result:

```ts
const resolved = resolveAllNetworkPublishedResult({
  completedResult,
  hasQueuedRerun,
  lastPublished: lastPublishedResultRef.current,
  runSignature: currentRunSignature,
});
lastPublishedResultRef.current = resolved.nextLastPublished;
return resolved.publishedResult;
```

This preserves the exact previous result reference for superseded same-owner runs, so `usePromiseResult` does not trigger downstream final aggregation effects.

- [ ] **Step 5: Run targeted tests**

Run:

```bash
yarn test packages/kit/src/hooks/allNetworkRunResultUtils.test.ts packages/kit/src/hooks/shouldSkipRedundantAllNetworkRun.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run TypeScript/lint validation for the changed files**

Run:

```bash
yarn eslint packages/kit/src/hooks/useAllNetwork.ts packages/kit/src/hooks/allNetworkRunResultUtils.ts packages/kit/src/hooks/allNetworkRunResultUtils.test.ts
```

Expected: exit code 0.

- [ ] **Step 7: Commit the integration**

```bash
git add packages/kit/src/hooks/useAllNetwork.ts packages/kit/src/hooks/allNetworkRunResultUtils.ts packages/kit/src/hooks/allNetworkRunResultUtils.test.ts
git commit -m "fix: publish only stable all-network results"
```

### Task 3: Final regression validation

**Files:**
- Verify: `packages/kit/src/hooks/useAllNetwork.ts`
- Verify: `packages/kit/src/views/Home/components/TokenListBlock/TokenListBlock.tsx`
- Verify: `packages/kit/src/views/Home/pages/NFTListContainer.tsx`
- Verify: `packages/kit/src/views/Home/components/DeFiListBlock/DeFiListBlock.tsx`

- [ ] **Step 1: Run all directly related tests**

Run:

```bash
yarn test packages/kit/src/hooks/allNetworkRunResultUtils.test.ts packages/kit/src/hooks/shouldSkipRedundantAllNetworkRun.test.ts packages/kit-bg/src/services/ServiceHardware/serviceHardwarePortfolioSync/serviceHardwarePortfolioSyncUtils.test.ts packages/kit-bg/src/services/ServiceHardware/serviceHardwarePortfolioSync/ServiceHardwarePortfolioSync.wait.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run the repository commit profile**

Run:

```bash
yarn agent:check --profile commit
```

Expected: PASS. If it fails, inspect `node_modules/.cache/agent-checks` and only address failures caused by the changed files.

- [ ] **Step 3: Inspect the final diff**

Run:

```bash
git diff HEAD~1 -- packages/kit/src/hooks/useAllNetwork.ts packages/kit/src/hooks/allNetworkRunResultUtils.ts packages/kit/src/hooks/allNetworkRunResultUtils.test.ts
```

Expected: only the publication utility, tests, and `useAllNetworkRequests` integration are present; no Portfolio cooldown, event payload, database, or `deviceUtils` changes.

- [ ] **Step 4: Report the verified behavior**

Confirm in the handoff:

```text
- Superseded all-network runs keep the previous stable result reference.
- The final queued rerun publishes normally.
- TokenListBlock therefore emits AllNetworksTokenListSettled only for the stable aggregate result.
- Portfolio hash/cooldown remains unchanged as a secondary safeguard.
```
