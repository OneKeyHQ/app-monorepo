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

    // Switch START: requestId bumped now, but the active-account atom still
    // holds A throughout the loading window.
    service.beginActivePerpsAccountChange();

    // The loading window is typically >250ms and receives many WS packets.
    // The first triggers the throttle's leading edge (commits while atom is
    // still A); a later one is coalesced and scheduled for the trailing flush.
    await service.updateActiveAccountSummary(makeWebData2(ACCOUNT_A, '999'));
    await jest.advanceTimersByTimeAsync(50); // flush leading, stay in window
    await service.updateActiveAccountSummary(makeWebData2(ACCOUNT_A, '1000'));

    // Switch END: the new account B is published and the summary cleared,
    // exactly as changeActivePerpsAccount() does for a different address.
    activeAccountState = {
      accountAddress: ACCOUNT_B,
      indexedAccountId: 'b',
      accountId: null,
      deriveType: 'default',
    };
    summaryState = undefined;

    // The throttle's trailing flush fires after the switch completed.
    await jest.advanceTimersByTimeAsync(300);

    // The active account is now B; A's stale summary must never be re-applied.
    expect(summaryState?.accountAddress?.toLowerCase()).not.toBe(ACCOUNT_A);
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
