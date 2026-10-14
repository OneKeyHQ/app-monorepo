/**
 * PR #13695 review: the per-owner caches registered their removal listeners on
 * the home token list's first use, so a wallet / account removed before then
 * left the persisted slots behind. `Bootstrap` now registers them at startup;
 * this pins that the registration alone (no cache read or write first) drops
 * every layer.
 */
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import { registerHomeTokenListOwnerCacheInvalidation } from '../cells/ownerCacheInvalidation';
import {
  getOwnerReplayCacheSize,
  rememberOwnerReplayFrame,
} from '../cells/ownerFrameReplayCache';

const mockSlimRecords = new Map<string, Record<string, unknown>>();
const mockWorthRecords = new Map<string, Record<string, unknown>>();
jest.mock('@onekeyhq/shared/src/storage/uiSnapshotCaches', () => {
  const actual = jest.requireActual(
    '@onekeyhq/shared/src/storage/uiSnapshotCaches',
  ) as Record<string, unknown>;
  // Resolved lazily: the factory runs before the maps above are initialized.
  const stub = (records: () => Map<string, Record<string, unknown>>) => ({
    get: (key: string) => {
      const data = records().get(key);
      return data ? { data, updatedAt: 0 } : undefined;
    },
    set: (key: string, data: Record<string, unknown>) => {
      records().set(key, data);
    },
    touch: () => undefined,
    clear: () => records().clear(),
  });
  return {
    ...actual,
    tokenListOwnerSlimCache: stub(() => mockSlimRecords),
    tokenListOwnerWorthCache: stub(() => mockWorthRecords),
  };
});

/*
yarn jest packages/kit/src/states/jotai/contexts/tokenList/__tests__/ownerCacheInvalidation.test.ts
*/

const OWNER_KEY = 'hd-1--m/44/60/0/0/0__evm--1';

function rememberStructure() {
  rememberOwnerReplayFrame({
    storeName: 'homeTokenList',
    ownerKey: OWNER_KEY,
    kind: 'structure',
    payload: { ownerKey: OWNER_KEY, structureVersion: 0 } as Parameters<
      typeof rememberOwnerReplayFrame<'structure'>
    >[0]['payload'],
    currencyId: 'usd',
  });
}

describe('registerHomeTokenListOwnerCacheInvalidation', () => {
  beforeAll(() => {
    // The only call: nothing reads or writes the caches before it, as at
    // startup.
    registerHomeTokenListOwnerCacheInvalidation();
  });

  beforeEach(() => {
    // Left by an earlier launch, plus a frame remembered this session.
    mockSlimRecords.set('homeTokenList/owner', { ownerKey: OWNER_KEY });
    mockWorthRecords.set('homeAccountWorth/owner', { worth: {} });
    rememberStructure();
  });

  it.each([
    EAppEventBusNames.WalletRemove,
    EAppEventBusNames.AccountRemove,
    EAppEventBusNames.WalletClear,
  ])('drops every per-owner layer on %s', (eventName) => {
    expect(getOwnerReplayCacheSize()).toBe(1);

    appEventBus.emit(
      eventName as EAppEventBusNames.WalletRemove,
      { walletId: 'hd-1' } as never,
    );

    expect(mockSlimRecords.size).toBe(0);
    expect(mockWorthRecords.size).toBe(0);
    expect(getOwnerReplayCacheSize()).toBe(0);
  });
});
