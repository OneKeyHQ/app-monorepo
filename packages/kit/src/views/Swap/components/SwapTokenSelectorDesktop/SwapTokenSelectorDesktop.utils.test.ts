import type {
  ISwapNetwork,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import {
  buildSwapTokenSelectorAssetNetworks,
  buildSwapTokenSelectorNetworkGroups,
  resolveSwapTokenSelectorAssetNetworks,
  resolveSwapTokenSelectorNetworkGroups,
  updateSwapTokenSelectorNetworkSnapshot,
} from './SwapTokenSelectorDesktop.utils';

const network = (
  networkId: string,
  name: string,
  extra?: Partial<ISwapNetwork>,
) => ({ networkId, name, symbol: name, ...extra }) as ISwapNetwork;

const token = (
  networkId: string,
  balanceParsed: string,
  fiatValue: string,
): ISwapToken =>
  ({
    networkId,
    balanceParsed,
    fiatValue,
    contractAddress: `${networkId}-token`,
    decimals: 18,
    symbol: 'TOKEN',
  }) as ISwapToken;

describe('SwapTokenSelectorDesktop.utils', () => {
  it('groups L2 networks under their server-provided parent and keeps orphan L2s flat', () => {
    const groups = buildSwapTokenSelectorNetworkGroups({
      networks: [
        network('ethereum', 'Ethereum'),
        network('arbitrum', 'Arbitrum', {
          isL2: true,
          parentNetworkId: 'ethereum',
        }),
        network('optimism', 'Optimism', {
          isL2: true,
          parentNetworkId: 'ethereum',
        }),
        network('orphan', 'Orphan L2', {
          isL2: true,
          parentNetworkId: 'missing-parent',
        }),
      ],
    });

    expect(groups.map(({ network: item }) => item.networkId)).toEqual([
      'ethereum',
      'orphan',
    ]);
    expect(
      groups
        .find(({ network: item }) => item.networkId === 'ethereum')
        ?.children.map((item) => item.networkId),
    ).toEqual(['arbitrum', 'optimism']);
  });

  it('filters networks by name without hardcoding a chain name', () => {
    const groups = buildSwapTokenSelectorNetworkGroups({
      networks: [network('solana', 'Solana'), network('ethereum', 'Ethereum')],
      searchValue: 'sol',
    });
    expect(groups.map(({ network: item }) => item.networkId)).toEqual([
      'solana',
    ]);
  });

  it('sorts asset networks by fiat value and ignores zero balance/value tokens', () => {
    const networks = [
      network('ethereum', 'Ethereum'),
      network('solana', 'Solana'),
    ];
    const assets = buildSwapTokenSelectorAssetNetworks({
      networks,
      tokens: [
        token('ethereum', '1', '10'),
        token('ethereum', '2', '5'),
        token('solana', '1', '20'),
        token('solana', '0', '100'),
        token('missing', '1', '1000'),
      ],
    });
    expect(assets).toEqual([
      { network: networks[1], fiatValue: '20' },
      { network: networks[0], fiatValue: '15' },
    ]);
  });

  it('updates money without moving, adding or removing asset rows until the next open', () => {
    const ethereum = network('ethereum', 'Ethereum');
    const arbitrum = network('arbitrum', 'Arbitrum');
    const base = network('base', 'Base');
    const networks = [ethereum, arbitrum, base];
    const networkMap = new Map(networks.map((item) => [item.networkId, item]));
    const params = {
      scopeKey: 'wallet-a-usd',
      networksReady: true,
      allNetwork: network('all', 'All', { isAllNetworks: true }),
      networks,
    };
    const opened = updateSwapTokenSelectorNetworkSnapshot({
      ...params,
      snapshot: { scopeKey: params.scopeKey },
      assetNetworks: buildSwapTokenSelectorAssetNetworks({
        networks,
        tokens: [token('arbitrum', '1', '20'), token('ethereum', '1', '10')],
      }),
    });
    const refreshedAssets = buildSwapTokenSelectorAssetNetworks({
      networks,
      tokens: [
        token('arbitrum', '0', '0'),
        token('ethereum', '2', '40'),
        token('base', '1', '50'),
      ],
    });
    const refreshed = updateSwapTokenSelectorNetworkSnapshot({
      ...params,
      snapshot: opened,
      assetNetworks: refreshedAssets,
    });
    expect(refreshed).toBe(opened);
    expect(
      resolveSwapTokenSelectorAssetNetworks({
        snapshot: refreshed.assetNetworks,
        assetNetworks: refreshedAssets,
        networkMap,
      }).map(({ network: item, fiatValue }) => [item.networkId, fiatValue]),
    ).toEqual([
      ['arbitrum', '0'],
      ['ethereum', '40'],
    ]);

    const reopened = updateSwapTokenSelectorNetworkSnapshot({
      ...params,
      snapshot: { scopeKey: params.scopeKey },
      assetNetworks: refreshedAssets,
    });
    expect(
      reopened.assetNetworks?.map(({ network: item }) => item.networkId),
    ).toEqual(['base', 'ethereum']);
  });

  it('waits for the first aggregate and treats a completed empty aggregate as a pinned section', () => {
    const ethereum = network('ethereum', 'Ethereum');
    const params = {
      scopeKey: 'wallet-a-usd',
      networksReady: true,
      allNetwork: network('all', 'All', { isAllNetworks: true }),
      networks: [ethereum],
    };
    const pending = updateSwapTokenSelectorNetworkSnapshot({
      ...params,
      snapshot: { scopeKey: params.scopeKey },
    });
    expect(pending.assetNetworks).toBeUndefined();
    const empty = updateSwapTokenSelectorNetworkSnapshot({
      ...params,
      snapshot: pending,
      assetNetworks: [],
    });
    expect(empty.assetNetworks).toEqual([]);
    const lateAssets = updateSwapTokenSelectorNetworkSnapshot({
      ...params,
      snapshot: empty,
      assetNetworks: [{ network: ethereum, fiatValue: '10' }],
    });
    expect(lateAssets).toBe(empty);
  });

  it('rebuilds after identity or currency changes without showing the previous wallet rows', () => {
    const ethereum = network('ethereum', 'Ethereum');
    const params = {
      networksReady: true,
      allNetwork: network('all', 'All', { isAllNetworks: true }),
      networks: [ethereum],
    };
    const first = updateSwapTokenSelectorNetworkSnapshot({
      ...params,
      scopeKey: 'wallet-a-usd-0',
      snapshot: { scopeKey: 'wallet-a-usd-0' },
      assetNetworks: [{ network: ethereum, fiatValue: '10' }],
    });
    for (const scopeKey of [
      'wallet-b-usd-0',
      'wallet-a-eur-0',
      'wallet-a-usd-1',
    ]) {
      const changed = updateSwapTokenSelectorNetworkSnapshot({
        ...params,
        scopeKey,
        snapshot: first,
      });
      expect(changed.scopeKey).toBe(scopeKey);
      expect(changed.assetNetworks).toBeUndefined();
    }
  });

  it('pins same-chain, A–Z order and L2 parents while using live names and search', () => {
    const ethereum = network('ethereum', 'Ethereum');
    const arbitrum = network('arbitrum', 'Arbitrum', {
      isL2: true,
      parentNetworkId: 'ethereum',
    });
    const solana = network('solana', 'Solana');
    const params = {
      scopeKey: 'wallet-a-usd',
      networksReady: true,
      allNetwork: network('all', 'All', { isAllNetworks: true }),
      networks: [solana, arbitrum],
      sameChainNetwork: ethereum,
    };
    const snapshot = updateSwapTokenSelectorNetworkSnapshot({
      ...params,
      snapshot: { scopeKey: params.scopeKey },
      assetNetworks: [],
    });
    const renamedSolana = { ...solana, name: 'A Solana' };
    const movedArbitrum = { ...arbitrum, parentNetworkId: 'solana' };
    const base = network('base', 'Base');
    const currentNetworks = [base, renamedSolana, movedArbitrum, ethereum];
    const refreshed = updateSwapTokenSelectorNetworkSnapshot({
      ...params,
      snapshot,
      networks: currentNetworks,
      sameChainNetwork: solana,
    });
    expect(refreshed.structure?.sameChainNetwork).toBe(ethereum);
    const networkMap = new Map(
      currentNetworks.map((item) => [item.networkId, item]),
    );
    const groups = resolveSwapTokenSelectorNetworkGroups({
      groups: refreshed.structure?.groups ?? [],
      networkMap,
    });
    expect(groups.map(({ network: item }) => item.networkId)).toEqual([
      'ethereum',
      'solana',
    ]);
    expect(groups[0].children.map((item) => item.networkId)).toEqual([
      'arbitrum',
    ]);
    expect(groups[1].network.name).toBe('A Solana');
    expect(
      resolveSwapTokenSelectorNetworkGroups({
        groups: refreshed.structure?.groups ?? [],
        networkMap,
        searchValue: 'arb',
      }),
    ).toEqual([{ network: movedArbitrum, children: [] }]);
    expect(
      resolveSwapTokenSelectorNetworkGroups({
        groups: refreshed.structure?.groups ?? [],
        networkMap,
        searchValue: 'base',
      }),
    ).toEqual([]);
  });

  it('does not capture an incomplete supported-network list', () => {
    const ethereum = network('ethereum', 'Ethereum');
    const params = {
      scopeKey: 'wallet-a-usd',
      allNetwork: network('all', 'All', { isAllNetworks: true }),
      networks: [ethereum],
      assetNetworks: [{ network: ethereum, fiatValue: '10' }],
    };
    const pending = updateSwapTokenSelectorNetworkSnapshot({
      ...params,
      networksReady: false,
      snapshot: { scopeKey: params.scopeKey },
    });
    expect(pending.structure).toBeUndefined();
    expect(pending.assetNetworks).toBeUndefined();
    const ready = updateSwapTokenSelectorNetworkSnapshot({
      ...params,
      networksReady: true,
      snapshot: pending,
    });
    expect(ready.structure?.groups[0].network).toBe(ethereum);
    expect(ready.assetNetworks).toEqual(params.assetNetworks);
  });
});
