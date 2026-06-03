import type {
  ISwapProviderInfo,
  ISwapProviderManager,
  ISwapServiceProvider,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import { EProtocolOfExchange } from '@onekeyhq/shared/types/swap/types';
import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';

import {
  buildUnifiedSwapProviderManagers,
  getDenySwapProviderString,
} from './swapProviderManagerUtils';

function network(networkId: string): ISwapNetwork {
  return {
    networkId,
    name: networkId,
    symbol: networkId,
  };
}

function providerInfo(provider: string): ISwapProviderInfo {
  return {
    provider,
    providerName: provider,
    logo: '',
    protocol: EProtocolOfExchange.SWAP,
  };
}

function serverProvider({
  provider,
  isSupportSingleSwap = true,
  isSupportCrossChain = true,
}: {
  provider: string;
  isSupportSingleSwap?: boolean;
  isSupportCrossChain?: boolean;
}): ISwapServiceProvider {
  return {
    providerInfo: providerInfo(provider),
    isSupportSingleSwap,
    isSupportCrossChain,
    supportSingleSwapNetworks: isSupportSingleSwap ? [network('evm--1')] : [],
    supportCrossChainNetworks: isSupportCrossChain
      ? [network('evm--1'), network('sol--101')]
      : [],
    serviceDisableNetworks: [network('sol--101')],
  };
}

function manager({
  provider,
  enable = true,
  disableNetworks = [],
}: {
  provider: string;
  enable?: boolean;
  disableNetworks?: ISwapNetwork[];
}): ISwapProviderManager {
  return {
    providerInfo: providerInfo(provider),
    enable,
    disableNetworks,
  };
}

describe('swapProviderManagerUtils', () => {
  it('builds one provider manager from server capabilities and legacy swap/bridge settings', () => {
    const result = buildUnifiedSwapProviderManagers({
      serverProviders: [
        serverProvider({ provider: 'ProviderA' }),
        serverProvider({
          provider: 'ProviderB',
          isSupportSingleSwap: false,
        }),
      ],
      swapProviderManagers: [
        manager({
          provider: 'ProviderA',
          enable: true,
          disableNetworks: [network('evm--1'), network('evm--56')],
        }),
      ],
      bridgeProviderManagers: [
        manager({ provider: 'ProviderA', enable: false }),
      ],
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      providerInfo: { provider: 'ProviderA' },
      enable: false,
      isSupportSingleSwap: true,
      isSupportCrossChain: true,
    });
    expect(result[0].supportNetworks?.map((item) => item.networkId)).toEqual([
      'evm--1',
      'sol--101',
    ]);
    expect(result[0].disableNetworks?.map((item) => item.networkId)).toEqual([
      'evm--1',
    ]);
    expect(result[1]).toMatchObject({
      providerInfo: { provider: 'ProviderB' },
      enable: true,
      isSupportSingleSwap: false,
      isSupportCrossChain: true,
    });
  });

  it('returns single-swap deny providers for global and from-network disables', () => {
    const denyProviders = getDenySwapProviderString({
      providerManagers: [
        {
          ...manager({ provider: 'ProviderA', enable: false }),
          isSupportSingleSwap: true,
        },
        {
          ...manager({
            provider: 'ProviderB',
            disableNetworks: [network('evm--1')],
          }),
          isSupportSingleSwap: true,
        },
        {
          ...manager({ provider: 'CrossOnly', enable: false }),
          isSupportSingleSwap: false,
          isSupportCrossChain: true,
        },
      ],
      fromNetworkId: 'evm--1',
      toNetworkId: 'evm--1',
    });

    expect(denyProviders).toBe('ProviderA,ProviderB');
  });

  it('returns cross-chain deny providers when either side network is disabled', () => {
    const denyProviders = getDenySwapProviderString({
      providerManagers: [
        {
          ...manager({
            provider: 'ProviderA',
            disableNetworks: [network('sol--101')],
          }),
          isSupportCrossChain: true,
        },
        {
          ...manager({ provider: 'ProviderB' }),
          isSupportCrossChain: true,
        },
        {
          ...manager({ provider: 'SingleOnly', enable: false }),
          isSupportSingleSwap: true,
          isSupportCrossChain: false,
        },
      ],
      fromNetworkId: 'evm--1',
      toNetworkId: 'sol--101',
    });

    expect(denyProviders).toBe('ProviderA');
  });
});
