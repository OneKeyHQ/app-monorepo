/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires, global-require */

// ---------------------------------------------------------------------------
// Reproduces the active-account-summary stale-write race described in the
// PR #11823 review comments:
//
// During a perps account switch, `beginActivePerpsAccountChange()` bumps the
// requestId synchronously at switch START, but `perpsActiveAccountAtom` only
// flips to the new account at switch END. In that loading window, a WS packet
// for the OLD account still passes the address check inside
// `updateActiveAccountSummary()`, and the coalesced write gets stamped with
// the NEW (already-bumped) requestId. The throttle's trailing flush therefore
// passes `isLatestActivePerpsAccountChange()` and lands the OLD account's
// summary AFTER the new account has been published.
// ---------------------------------------------------------------------------

import type { IWsWebData2 } from '@onekeyhq/shared/types/hyperliquid/sdk';

// --- mock ESM-only / IO deps so the heavy service module loads under jest ---
jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  __esModule: true,
  backgroundClass: () => (target: any) => target,
  backgroundMethod: () => (_t: any, _k: string, desc: any) => desc,
  backgroundMethodForDev: () => (_t: any, _k: string, desc: any) => desc,
  toastIfError: () => (_t: any, _k: string, desc: any) => desc,
}));
jest.mock('p-timeout', () => ({
  __esModule: true,
  default: (p: any) => p,
  TimeoutError: class TimeoutError extends Error {},
}));
jest.mock('../../dbs/local/localDb', () => ({ __esModule: true, default: {} }));
jest.mock('./hyperLiquidApiClients', () => ({
  __esModule: true,
  hyperLiquidApiClients: {},
}));

// --- in-memory replacements for the two atoms this flow touches ------------
let activeAccountState: any;
let summaryState: any;

function makeAtom(getState: () => any, setState: (v: any) => void) {
  return {
    get: jest.fn(async () => getState()),
    set: jest.fn(async (valOrUpdater: any) => {
      const next =
        typeof valOrUpdater === 'function'
          ? valOrUpdater(getState())
          : valOrUpdater;
      setState(next);
      return next;
    }),
  };
}

jest.mock('../../states/jotai/atoms', () => ({
  __esModule: true,
  perpsActiveAccountAtom: makeAtom(
    () => activeAccountState,
    (v) => {
      activeAccountState = v;
    },
  ),
  perpsActiveAccountSummaryAtom: makeAtom(
    () => summaryState,
    (v) => {
      summaryState = v;
    },
  ),
  // Spot-dusting plumbing pulled in by updateActiveAccountSummary; irrelevant
  // to the stale-write guard, so a no-op stub keeps the flow from crashing.
  perpsSpotDustingAtom: {
    get: jest.fn(async () => undefined),
    set: jest.fn(async () => undefined),
  },
  getPerpsSpotDustingNextState: jest.fn(() => undefined),
}));

const ACCOUNT_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const ACCOUNT_B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

function makeWebData2(user: string, accountValue: string): IWsWebData2 {
  return {
    user,
    clearinghouseState: {
      assetPositions: [],
      marginSummary: {
        accountValue,
        totalMarginUsed: '0',
        totalNtlPos: '0',
        totalRawUsd: accountValue,
      },
      crossMarginSummary: { accountValue },
      crossMaintenanceMarginUsed: '0',
      withdrawable: accountValue,
    },
  } as unknown as IWsWebData2;
}

function createService() {
  const ServiceHyperliquid = require('./ServiceHyperliquid').default;
  const backgroundApi = {
    serviceHyperliquidCache: {
      writePerpsAccountDisplaySummary: jest.fn(async () => undefined),
      writePerpsAccountDisplaySnapshot: jest.fn(async () => undefined),
    },
    simpleDb: {
      perp: {
        getPerpData: jest.fn(async () => ({})),
      },
    },
  } as any;
  return new ServiceHyperliquid({ backgroundApi });
}

// Drive an account switch through one seam that mirrors changeActivePerpsAccount's
// real ordering, instead of poking private methods ad hoc in each test:
//
//   begin (requestId++, pending='resolving', target unknown)
//     -> onResolvingWindow  (WS frames before getNetworkAccount resolves)
//   markPendingActivePerpsAccountTarget (pending='resolved', live atom still old)
//   wipe summary to undefined, then apply `hydrate` if given
//     -> onLoadingWindow    (WS frames after target known, before the atom flips)
//   publish the new active account
//   clear pending           (mirrors changeActivePerpsAccount's finally)
//
// Note: this exercises the ordering, not the literal body of
// changeActivePerpsAccount; a call-site timing regression inside that method
// (e.g. markPending moved before begin) is out of this helper's scope.
async function simulateAccountSwitch(
  service: any,
  toAddress: string,
  hooks: {
    onResolvingWindow?: () => Promise<void>;
    onLoadingWindow?: () => Promise<void>;
    hydrate?: any;
  } = {},
): Promise<number> {
  const requestId = service.beginActivePerpsAccountChange();
  if (hooks.onResolvingWindow) {
    await hooks.onResolvingWindow();
  }
  service.markPendingActivePerpsAccountTarget(toAddress, requestId);
  // changeActivePerpsAccount wipes the summary for a different-address switch,
  // then may hydrate the new account's display summary before publishing.
  summaryState = hooks.hydrate ?? undefined;
  if (hooks.onLoadingWindow) {
    await hooks.onLoadingWindow();
  }
  activeAccountState = {
    accountAddress: toAddress,
    indexedAccountId: 'switch-target',
    accountId: null,
    deriveType: 'default',
  };
  service.clearPendingActivePerpsAccountChange(requestId);
  return requestId;
}

describe('ServiceHyperliquid active-summary stale-write guard', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    activeAccountState = undefined;
    summaryState = undefined;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not land the previous account summary after switching accounts', async () => {
    const service: any = createService();

    // Steady state on account A.
    activeAccountState = {
      accountAddress: ACCOUNT_A,
      indexedAccountId: 'a',
      accountId: null,
      deriveType: 'default',
    };
    await service.updateActiveAccountSummary(makeWebData2(ACCOUNT_A, '100'));
    await jest.advanceTimersByTimeAsync(0); // flush leading-edge commit
    expect(summaryState?.accountAddress?.toLowerCase()).toBe(ACCOUNT_A);

    // Switch to B. The loading window is typically >250ms and receives many WS
    // packets for the OLD account A: the first triggers the throttle's leading
    // edge, a later one is coalesced for the trailing flush.
    await simulateAccountSwitch(service, ACCOUNT_B, {
      onLoadingWindow: async () => {
        await service.updateActiveAccountSummary(
          makeWebData2(ACCOUNT_A, '999'),
        );
        await jest.advanceTimersByTimeAsync(50); // stay in window
        await service.updateActiveAccountSummary(
          makeWebData2(ACCOUNT_A, '1000'),
        );
      },
    });

    // The throttle's trailing flush fires after the switch completed.
    await jest.advanceTimersByTimeAsync(300);

    // The active account is now B; A's stale summary must never be re-applied.
    expect(summaryState?.accountAddress?.toLowerCase()).not.toBe(ACCOUNT_A);
  });

  it('blocks old-account writes during the begin -> target-resolved window', async () => {
    const service: any = createService();

    // Steady state on account A.
    activeAccountState = {
      accountAddress: ACCOUNT_A,
      indexedAccountId: 'a',
      accountId: null,
      deriveType: 'default',
    };
    await service.updateActiveAccountSummary(makeWebData2(ACCOUNT_A, '100'));
    await jest.advanceTimersByTimeAsync(0);
    expect(summaryState?.accountValue).toBe('100');

    // Switch to B begins, but the destination address is NOT resolved yet
    // (changeActivePerpsAccount is still inside getNetworkAccount). The live
    // atom still holds A, so without the 'resolving' block an old-account WS
    // frame would fall back to the live (old) account and land — the gap in the
    // begin -> markPendingActivePerpsAccountTarget window flagged in PR #11823
    // review (the unprotected getNetworkAccount window).
    await simulateAccountSwitch(service, ACCOUNT_B, {
      onResolvingWindow: async () => {
        await service.updateActiveAccountSummary(
          makeWebData2(ACCOUNT_A, '999'),
        );
        await jest.advanceTimersByTimeAsync(300); // flush leading + trailing
        // The pending switch is 'resolving' (target unknown), so the write is
        // dropped instead of overwriting A's steady-state summary.
        expect(summaryState?.accountValue).toBe('100');
      },
    });
  });

  it('does not clobber the new-account hydration during the switch loading window', async () => {
    const service: any = createService();

    // Steady state on account A.
    activeAccountState = {
      accountAddress: ACCOUNT_A,
      indexedAccountId: 'a',
      accountId: null,
      deriveType: 'default',
    };
    await service.updateActiveAccountSummary(makeWebData2(ACCOUNT_A, '100'));
    await jest.advanceTimersByTimeAsync(0);
    expect(summaryState?.accountAddress?.toLowerCase()).toBe(ACCOUNT_A);

    // Switch to B. The target resolves and B's display summary is hydrated into
    // the atom while the live active-account atom still holds A. A late WS frame
    // for the OLD account A arrives during that loading window.
    await simulateAccountSwitch(service, ACCOUNT_B, {
      hydrate: { accountAddress: ACCOUNT_B, accountValue: '500' },
      onLoadingWindow: async () => {
        await service.updateActiveAccountSummary(
          makeWebData2(ACCOUNT_A, '999'),
        );
        await jest.advanceTimersByTimeAsync(300); // flush leading + trailing
      },
    });

    // A's summary must NOT overwrite B's freshly hydrated summary.
    expect(summaryState?.accountAddress?.toLowerCase()).toBe(ACCOUNT_B);
    expect(summaryState?.accountValue).toBe('500');
  });

  it('still commits coalesced summaries for the active account (no over-rejection)', async () => {
    const service: any = createService();

    activeAccountState = {
      accountAddress: ACCOUNT_A,
      indexedAccountId: 'a',
      accountId: null,
      deriveType: 'default',
    };

    // Leading edge.
    await service.updateActiveAccountSummary(makeWebData2(ACCOUNT_A, '100'));
    await jest.advanceTimersByTimeAsync(0);
    expect(summaryState?.accountValue).toBe('100');

    // A second packet within the window must still land via the trailing flush.
    await service.updateActiveAccountSummary(makeWebData2(ACCOUNT_A, '250'));
    await jest.advanceTimersByTimeAsync(300);
    expect(summaryState?.accountAddress?.toLowerCase()).toBe(ACCOUNT_A);
    expect(summaryState?.accountValue).toBe('250');
  });
});
