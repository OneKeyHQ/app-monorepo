import { ESwapTabSwitchType } from '../../types/swap/types';
import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '../consts/jotaiConsts';

import {
  buildSwapSelectedTokensColdStartAccountKey,
  buildSwapSelectedTokensColdStartContext,
  isSwapColdStartAllNetworkContextNetworkId,
  normalizeSwapColdStartCacheSnapshot,
} from './swapColdStartCacheSnapshotUtils';

function buildSnapshotKey(scope: string, key: string) {
  return `${scope}::${key}`;
}

const swapScope = 'store:swap';
const homeScope = 'store:accountSelector@home';

function buildActiveAccount({
  networkId = 'btc--0',
  indexedAccountId = 'indexed-account-1',
} = {}) {
  return {
    ready: true,
    wallet: { id: 'wallet-1' },
    indexedAccount: { id: indexedAccountId },
    deriveType: 'default',
    network: { id: networkId },
  };
}

function buildSwapSnapshot({
  contextNetworkId = 'btc--0',
  activeNetworkId = 'btc--0',
  activeIndexedAccountId = 'indexed-account-1',
  contextSwapType = ESwapTabSwitchType.BRIDGE,
  snapshotSwapType = ESwapTabSwitchType.BRIDGE,
  fromTokenNetworkId = 'btc--0',
  toTokenNetworkId = 'evm--1',
} = {}) {
  const activeAccount = buildActiveAccount({
    networkId: activeNetworkId,
    indexedAccountId: activeIndexedAccountId,
  });
  return {
    [buildSnapshotKey(
      homeScope,
      CONTEXT_ATOM_COLD_START_CACHE_KEYS.activeAccountsAtom,
    )]: {
      0: activeAccount,
    },
    [buildSnapshotKey(
      swapScope,
      CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectedTokensColdStartContextAtom,
    )]: buildSwapSelectedTokensColdStartContext({
      activeAccount: buildActiveAccount({ networkId: contextNetworkId }),
      networkId: contextNetworkId,
      swapType: contextSwapType,
      now: 1,
    }),
    [buildSnapshotKey(
      swapScope,
      CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTypeSwitchAtom,
    )]: snapshotSwapType,
    [buildSnapshotKey(
      swapScope,
      CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectFromTokenAtom,
    )]: { networkId: fromTokenNetworkId, symbol: 'BTC' },
    [buildSnapshotKey(
      swapScope,
      CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectToTokenAtom,
    )]: { networkId: toTokenNetworkId, symbol: 'ETH' },
  };
}

describe('swapColdStartCacheSnapshotUtils', () => {
  it('keeps swap type and token snapshot when home account context matches', () => {
    const snapshot = buildSwapSnapshot();

    normalizeSwapColdStartCacheSnapshot(snapshot);

    expect(
      snapshot[
        buildSnapshotKey(
          swapScope,
          CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTypeSwitchAtom,
        )
      ],
    ).toBe(ESwapTabSwitchType.BRIDGE);
    expect(
      snapshot[
        buildSnapshotKey(
          swapScope,
          CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectFromTokenAtom,
        )
      ],
    ).toEqual({ networkId: 'btc--0', symbol: 'BTC' });
  });

  it('normalizes cross-network selected tokens to bridge even when cached type is swap', () => {
    const snapshot = buildSwapSnapshot({
      contextSwapType: ESwapTabSwitchType.SWAP,
      snapshotSwapType: ESwapTabSwitchType.SWAP,
    });

    normalizeSwapColdStartCacheSnapshot(snapshot);

    expect(
      snapshot[
        buildSnapshotKey(
          swapScope,
          CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTypeSwitchAtom,
        )
      ],
    ).toBe(ESwapTabSwitchType.BRIDGE);
    expect(
      (
        snapshot[
          buildSnapshotKey(
            swapScope,
            CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectedTokensColdStartContextAtom,
          )
        ] as { swapType?: ESwapTabSwitchType }
      ).swapType,
    ).toBe(ESwapTabSwitchType.BRIDGE);
  });

  it('keeps same-network selected tokens on cached swap type', () => {
    const snapshot = buildSwapSnapshot({
      contextNetworkId: 'evm--1',
      activeNetworkId: 'evm--1',
      contextSwapType: ESwapTabSwitchType.SWAP,
      snapshotSwapType: ESwapTabSwitchType.SWAP,
      fromTokenNetworkId: 'evm--1',
      toTokenNetworkId: 'evm--1',
    });

    normalizeSwapColdStartCacheSnapshot(snapshot);

    expect(
      snapshot[
        buildSnapshotKey(
          swapScope,
          CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTypeSwitchAtom,
        )
      ],
    ).toBe(ESwapTabSwitchType.SWAP);
  });

  it('keeps all-network cache when from token is on a concrete chain', () => {
    // Regression for the all-network mismatch: the cached context network is the
    // `onekeyall--*` sentinel while the from token is a concrete chain, so an
    // exact-equality check would wrongly discard the cache on every cold start.
    const snapshot = buildSwapSnapshot({
      contextNetworkId: 'onekeyall--0',
      activeNetworkId: 'onekeyall--0',
      contextSwapType: ESwapTabSwitchType.SWAP,
      snapshotSwapType: ESwapTabSwitchType.SWAP,
      fromTokenNetworkId: 'evm--1',
      toTokenNetworkId: 'evm--1',
    });

    normalizeSwapColdStartCacheSnapshot(snapshot);

    expect(
      snapshot[
        buildSnapshotKey(
          swapScope,
          CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectFromTokenAtom,
        )
      ],
    ).toEqual({ networkId: 'evm--1', symbol: 'BTC' });
    expect(
      snapshot[
        buildSnapshotKey(
          swapScope,
          CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectedTokensColdStartContextAtom,
        )
      ],
    ).toBeDefined();
  });

  it('drops swap type and token snapshot when home network changes', () => {
    const snapshot = buildSwapSnapshot({ activeNetworkId: 'evm--1' });

    normalizeSwapColdStartCacheSnapshot(snapshot);

    expect(
      snapshot[
        buildSnapshotKey(
          swapScope,
          CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTypeSwitchAtom,
        )
      ],
    ).toBeUndefined();
    expect(
      snapshot[
        buildSnapshotKey(
          swapScope,
          CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectFromTokenAtom,
        )
      ],
    ).toBeUndefined();
    expect(
      snapshot[
        buildSnapshotKey(
          swapScope,
          CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectedTokensColdStartContextAtom,
        )
      ],
    ).toBeUndefined();
  });

  it('drops swap type and token snapshot when home account changes', () => {
    const snapshot = buildSwapSnapshot({
      activeIndexedAccountId: 'indexed-account-2',
    });

    normalizeSwapColdStartCacheSnapshot(snapshot);

    expect(
      snapshot[
        buildSnapshotKey(
          swapScope,
          CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTypeSwitchAtom,
        )
      ],
    ).toBeUndefined();
  });

  it('drops swap type and token snapshot when from token does not match context network', () => {
    const snapshot = buildSwapSnapshot();
    snapshot[
      buildSnapshotKey(
        swapScope,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectFromTokenAtom,
      )
    ] = { networkId: 'evm--1', symbol: 'ETH' };

    normalizeSwapColdStartCacheSnapshot(snapshot);

    expect(
      snapshot[
        buildSnapshotKey(
          swapScope,
          CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTypeSwitchAtom,
        )
      ],
    ).toBeUndefined();
  });

  it('returns non-object snapshots unchanged without throwing', () => {
    // Mobile passes JSON.parse(rawMmkvValue) directly; a non-object value must
    // not throw, otherwise the whole cold-start snapshot would be dropped.
    expect(() =>
      normalizeSwapColdStartCacheSnapshot(
        null as unknown as Record<string, unknown>,
      ),
    ).not.toThrow();
    expect(
      normalizeSwapColdStartCacheSnapshot(
        null as unknown as Record<string, unknown>,
      ),
    ).toBeNull();
    expect(
      normalizeSwapColdStartCacheSnapshot(
        [] as unknown as Record<string, unknown>,
      ),
    ).toEqual([]);
    expect(
      normalizeSwapColdStartCacheSnapshot(
        'null' as unknown as Record<string, unknown>,
      ),
    ).toBe('null');
  });

  it('detects the all-network sentinel network id', () => {
    expect(isSwapColdStartAllNetworkContextNetworkId('onekeyall--0')).toBe(
      true,
    );
    expect(isSwapColdStartAllNetworkContextNetworkId('evm--1')).toBe(false);
    expect(isSwapColdStartAllNetworkContextNetworkId(undefined)).toBe(false);
  });

  it('builds account key from wallet, account and derive type', () => {
    expect(
      buildSwapSelectedTokensColdStartAccountKey(buildActiveAccount()),
    ).toBe('wallet-1|indexed-account-1|default');
  });

  it('prefers db account id over network account id for others wallets', () => {
    // The persisted selected-account key uses othersWalletAccountId (a DB account
    // id), so the runtime active-account key must resolve dbAccount.id before
    // account.id (the INetworkAccount id) to stay symmetric.
    expect(
      buildSwapSelectedTokensColdStartAccountKey({
        wallet: { id: 'wallet-1' },
        account: { id: 'network-account-1' },
        dbAccount: { id: 'db-account-1' },
        deriveType: 'default',
      }),
    ).toBe('wallet-1|db-account-1|default');
  });
});
