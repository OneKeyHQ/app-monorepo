import { ESwapTabSwitchType } from '../../types/swap/types';
import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '../consts/jotaiConsts';

import {
  buildSwapSelectedTokensColdStartAccountKey,
  buildSwapSelectedTokensColdStartContext,
  getSwapColdStartSelectedTokensFromSnapshot,
  isSwapColdStartAllNetworkContextNetworkId,
  normalizeSwapColdStartCacheSnapshot,
} from './swapColdStartCacheSnapshotUtils';

function buildSnapshotKey(scope: string, key: string) {
  return `${scope}::${key}`;
}

const swapScope = 'store:swap';
const homeScope = 'store:accountSelector@home';
const swapAccountSelectorScope = 'store:accountSelector@swap';

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
  swapActiveNetworkId,
  swapActiveIndexedAccountId = activeIndexedAccountId,
  contextSwapType = ESwapTabSwitchType.BRIDGE,
  snapshotSwapType = ESwapTabSwitchType.BRIDGE,
  fromTokenNetworkId = 'btc--0',
  toTokenNetworkId = 'evm--1',
}: {
  contextNetworkId?: string;
  activeNetworkId?: string;
  activeIndexedAccountId?: string;
  swapActiveNetworkId?: string;
  swapActiveIndexedAccountId?: string;
  contextSwapType?: ESwapTabSwitchType;
  snapshotSwapType?: ESwapTabSwitchType;
  fromTokenNetworkId?: string;
  toTokenNetworkId?: string;
} = {}) {
  const activeAccount = buildActiveAccount({
    networkId: activeNetworkId,
    indexedAccountId: activeIndexedAccountId,
  });
  const snapshot: Record<string, unknown> = {
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
  if (swapActiveNetworkId) {
    snapshot[
      buildSnapshotKey(
        swapAccountSelectorScope,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.activeAccountsAtom,
      )
    ] = {
      0: buildActiveAccount({
        networkId: swapActiveNetworkId,
        indexedAccountId: swapActiveIndexedAccountId,
      }),
    };
  }
  return snapshot;
}

describe('swapColdStartCacheSnapshotUtils', () => {
  it('keeps bridge context and visible swap tab when home account context matches', () => {
    const snapshot = buildSwapSnapshot();

    normalizeSwapColdStartCacheSnapshot(snapshot);

    expect(
      snapshot[
        buildSnapshotKey(
          swapScope,
          CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTypeSwitchAtom,
        )
      ],
    ).toBe(ESwapTabSwitchType.SWAP);
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
    expect(
      snapshot[
        buildSnapshotKey(
          swapScope,
          CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectFromTokenAtom,
        )
      ],
    ).toEqual({ networkId: 'btc--0', symbol: 'BTC' });
  });

  it('normalizes cross-network selected tokens to bridge context while showing swap tab', () => {
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
    ).toBe(ESwapTabSwitchType.SWAP);
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

  it('keeps stock context and visible stock tab for same-network stock selected tokens', () => {
    const snapshot = buildSwapSnapshot({
      contextNetworkId: 'evm--56',
      activeNetworkId: 'evm--56',
      contextSwapType: ESwapTabSwitchType.STOCK,
      snapshotSwapType: ESwapTabSwitchType.STOCK,
      fromTokenNetworkId: 'evm--56',
      toTokenNetworkId: 'evm--56',
    });

    normalizeSwapColdStartCacheSnapshot(snapshot);

    expect(
      snapshot[
        buildSnapshotKey(
          swapScope,
          CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTypeSwitchAtom,
        )
      ],
    ).toBe(ESwapTabSwitchType.STOCK);
    expect(
      (
        snapshot[
          buildSnapshotKey(
            swapScope,
            CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectedTokensColdStartContextAtom,
          )
        ] as { swapType?: ESwapTabSwitchType }
      ).swapType,
    ).toBe(ESwapTabSwitchType.STOCK);
  });

  it('drops cached stock context when the visible cold-start tab is no longer stock', () => {
    const snapshot = buildSwapSnapshot({
      contextNetworkId: 'evm--56',
      activeNetworkId: 'evm--56',
      contextSwapType: ESwapTabSwitchType.STOCK,
      snapshotSwapType: ESwapTabSwitchType.SWAP,
      fromTokenNetworkId: 'evm--56',
      toTokenNetworkId: 'evm--56',
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
    expect(
      snapshot[
        buildSnapshotKey(
          swapScope,
          CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectedTokensColdStartContextAtom,
        )
      ],
    ).toBeUndefined();
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

  it('keeps a concrete swap context when home is all-network for the same account', () => {
    const snapshot = buildSwapSnapshot({
      contextNetworkId: 'evm--1',
      activeNetworkId: 'onekeyall--0',
      swapActiveNetworkId: 'evm--1',
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
    ).toEqual(
      expect.objectContaining({
        networkId: 'evm--1',
        swapType: ESwapTabSwitchType.SWAP,
      }),
    );
  });

  it('backfills missing all-network context for same-account selected token snapshots', () => {
    const snapshot = buildSwapSnapshot({
      contextNetworkId: 'onekeyall--0',
      activeNetworkId: 'onekeyall--0',
      contextSwapType: ESwapTabSwitchType.SWAP,
      snapshotSwapType: ESwapTabSwitchType.SWAP,
      fromTokenNetworkId: 'evm--1',
      toTokenNetworkId: 'evm--1',
    });
    delete snapshot[
      buildSnapshotKey(
        swapScope,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectedTokensColdStartContextAtom,
      )
    ];
    snapshot[
      buildSnapshotKey(
        homeScope,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.selectedAccountsAtom,
      )
    ] = {
      0: {
        walletId: 'wallet-1',
        indexedAccountId: 'indexed-account-1',
        networkId: 'onekeyall--0',
        deriveType: 'default',
      },
    };
    snapshot[
      buildSnapshotKey(
        swapAccountSelectorScope,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.selectedAccountsAtom,
      )
    ] = {
      0: {
        walletId: 'wallet-1',
        indexedAccountId: 'indexed-account-1',
        networkId: 'evm--1',
        deriveType: 'default',
      },
    };

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
    ).toEqual(
      expect.objectContaining({
        accountKey: 'wallet-1|indexed-account-1|default',
        networkId: 'onekeyall--0',
        swapType: ESwapTabSwitchType.SWAP,
      }),
    );
  });

  it('drops missing-context selected token snapshots when the all-network account owner differs', () => {
    const snapshot = buildSwapSnapshot({
      contextNetworkId: 'onekeyall--0',
      activeNetworkId: 'onekeyall--0',
      fromTokenNetworkId: 'evm--1',
      toTokenNetworkId: 'evm--1',
    });
    delete snapshot[
      buildSnapshotKey(
        swapScope,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectedTokensColdStartContextAtom,
      )
    ];
    snapshot[
      buildSnapshotKey(
        homeScope,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.selectedAccountsAtom,
      )
    ] = {
      0: {
        walletId: 'wallet-1',
        indexedAccountId: 'indexed-account-2',
        networkId: 'onekeyall--0',
        deriveType: 'default',
      },
    };
    snapshot[
      buildSnapshotKey(
        swapAccountSelectorScope,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.selectedAccountsAtom,
      )
    ] = {
      0: {
        walletId: 'wallet-1',
        indexedAccountId: 'indexed-account-1',
        networkId: 'evm--1',
        deriveType: 'default',
      },
    };

    normalizeSwapColdStartCacheSnapshot(snapshot);

    expect(
      snapshot[
        buildSnapshotKey(
          swapScope,
          CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectFromTokenAtom,
        )
      ],
    ).toBeUndefined();
  });

  it('extracts normalized selected tokens from a same-account all-network snapshot without context', () => {
    const snapshot = buildSwapSnapshot({
      contextNetworkId: 'onekeyall--0',
      activeNetworkId: 'onekeyall--0',
      contextSwapType: ESwapTabSwitchType.SWAP,
      snapshotSwapType: ESwapTabSwitchType.SWAP,
      fromTokenNetworkId: 'evm--1',
      toTokenNetworkId: 'evm--1',
    });
    delete snapshot[
      buildSnapshotKey(
        swapScope,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectedTokensColdStartContextAtom,
      )
    ];
    snapshot[
      buildSnapshotKey(
        homeScope,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.selectedAccountsAtom,
      )
    ] = {
      0: {
        walletId: 'wallet-1',
        indexedAccountId: 'indexed-account-1',
        networkId: 'onekeyall--0',
        deriveType: 'default',
      },
    };
    snapshot[
      buildSnapshotKey(
        swapAccountSelectorScope,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.selectedAccountsAtom,
      )
    ] = {
      0: {
        walletId: 'wallet-1',
        indexedAccountId: 'indexed-account-1',
        networkId: 'evm--1',
        deriveType: 'default',
      },
    };

    expect(getSwapColdStartSelectedTokensFromSnapshot(snapshot)).toEqual({
      fromToken: { networkId: 'evm--1', symbol: 'BTC' },
      toToken: { networkId: 'evm--1', symbol: 'ETH' },
    });
  });

  it('does not extract selected tokens when the normalized snapshot drops them', () => {
    const snapshot = buildSwapSnapshot({
      contextNetworkId: 'onekeyall--0',
      activeNetworkId: 'onekeyall--0',
      fromTokenNetworkId: 'evm--1',
      toTokenNetworkId: 'evm--1',
    });
    delete snapshot[
      buildSnapshotKey(
        swapScope,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectedTokensColdStartContextAtom,
      )
    ];
    snapshot[
      buildSnapshotKey(
        homeScope,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.selectedAccountsAtom,
      )
    ] = {
      0: {
        walletId: 'wallet-1',
        indexedAccountId: 'indexed-account-2',
        networkId: 'onekeyall--0',
        deriveType: 'default',
      },
    };
    snapshot[
      buildSnapshotKey(
        swapAccountSelectorScope,
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.selectedAccountsAtom,
      )
    ] = {
      0: {
        walletId: 'wallet-1',
        indexedAccountId: 'indexed-account-1',
        networkId: 'evm--1',
        deriveType: 'default',
      },
    };

    expect(getSwapColdStartSelectedTokensFromSnapshot(snapshot)).toEqual({
      fromToken: undefined,
      toToken: undefined,
    });
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
