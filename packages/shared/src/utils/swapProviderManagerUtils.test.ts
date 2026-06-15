import { EProtocolOfExchange } from '../../types/swap/types';

import {
  buildUnifiedSwapProviderManagers,
  getDenySwapProviderString,
  hasUnifiedCrossChainSwapProviderManagers,
  hasUnifiedSwapProviderManagers,
  normalizeSwapProviderManagersForSave,
} from './swapProviderManagerUtils';

import type {
  ISwapProviderManager,
  ISwapServiceProvider,
} from '../../types/swap/SwapProvider.constants';
import type { ISwapNetwork } from '../../types/swap/types';

const evmNetwork = {
  networkId: 'evm--1',
  name: 'Ethereum',
  symbol: 'ETH',
} as ISwapNetwork;

const solNetwork = {
  networkId: 'sol--101',
  name: 'Solana',
  symbol: 'SOL',
} as ISwapNetwork;

function buildProviderManager(
  provider: string,
  overrides: Partial<ISwapProviderManager> = {},
): ISwapProviderManager {
  return {
    providerInfo: {
      provider,
      protocol: EProtocolOfExchange.SWAP,
      logo: '',
      providerName: provider,
    },
    enable: true,
    supportNetworks: [evmNetwork, solNetwork],
    ...overrides,
  };
}

function buildServiceProvider(
  provider: string,
  overrides: Partial<ISwapServiceProvider> = {},
): ISwapServiceProvider {
  return {
    providerInfo: {
      provider,
      protocol: EProtocolOfExchange.SWAP,
      logo: '',
      providerName: provider,
    },
    ...overrides,
  };
}

describe('swapProviderManagerUtils', () => {
  it('does not treat legacy swap provider edits as unified provider managers', () => {
    const legacyProvider = buildProviderManager('LegacySwap');
    const [normalizedProvider] = normalizeSwapProviderManagersForSave(
      [legacyProvider],
      'singleSwap',
    );

    expect(normalizedProvider.singleSwapEnable).toBe(true);
    expect(normalizedProvider.crossChainEnable).toBe(true);
    expect(hasUnifiedSwapProviderManagers([normalizedProvider])).toBe(false);
    expect(hasUnifiedCrossChainSwapProviderManagers([normalizedProvider])).toBe(
      false,
    );
  });

  it('recognizes server-backed unified cross-chain provider managers', () => {
    const [unifiedProvider] = buildUnifiedSwapProviderManagers({
      serverProviders: [
        buildServiceProvider('UnifiedProvider', {
          isSupportSingleSwap: true,
          isSupportCrossChain: true,
          supportSingleSwapNetworks: [evmNetwork],
          supportCrossChainNetworks: [evmNetwork, solNetwork],
        }),
      ],
      swapProviderManagers: [],
      bridgeProviderManagers: [],
    });

    expect(hasUnifiedSwapProviderManagers([unifiedProvider])).toBe(true);
    expect(hasUnifiedCrossChainSwapProviderManagers([unifiedProvider])).toBe(
      true,
    );
  });

  it('does not clear legacy bridge data for unified single-swap-only providers', () => {
    const [unifiedProvider] = buildUnifiedSwapProviderManagers({
      serverProviders: [
        buildServiceProvider('UnifiedSingleOnly', {
          isSupportSingleSwap: true,
          isSupportCrossChain: false,
          supportSingleSwapNetworks: [evmNetwork],
          supportCrossChainNetworks: [],
        }),
      ],
      swapProviderManagers: [],
      bridgeProviderManagers: [],
    });

    expect(hasUnifiedSwapProviderManagers([unifiedProvider])).toBe(true);
    expect(hasUnifiedCrossChainSwapProviderManagers([unifiedProvider])).toBe(
      false,
    );
  });

  it('keeps unified single-swap-only providers out of cross-chain deny providers', () => {
    const [unifiedProvider] = buildUnifiedSwapProviderManagers({
      serverProviders: [
        buildServiceProvider('UnifiedSingleOnly', {
          isSupportSingleSwap: true,
          isSupportCrossChain: false,
          supportSingleSwapNetworks: [evmNetwork],
          supportCrossChainNetworks: [],
        }),
      ],
      swapProviderManagers: [
        buildProviderManager('UnifiedSingleOnly', { enable: false }),
      ],
      bridgeProviderManagers: [],
    });

    expect(
      getDenySwapProviderString({
        providerManagers: [unifiedProvider],
        fromNetworkId: evmNetwork.networkId,
        toNetworkId: solNetwork.networkId,
      }),
    ).toBeUndefined();
  });

  it('keeps legacy swap provider settings out of cross-chain deny providers', () => {
    const legacyProvider = buildProviderManager('LegacySwap', {
      enable: false,
    });
    const [normalizedProvider] = normalizeSwapProviderManagersForSave(
      [legacyProvider],
      'singleSwap',
    );

    expect(
      getDenySwapProviderString({
        providerManagers: [normalizedProvider],
        fromNetworkId: evmNetwork.networkId,
        toNetworkId: solNetwork.networkId,
      }),
    ).toBeUndefined();
    expect(
      getDenySwapProviderString({
        providerManagers: [normalizedProvider],
        fromNetworkId: evmNetwork.networkId,
        toNetworkId: evmNetwork.networkId,
      }),
    ).toBe('LegacySwap');
  });
});
