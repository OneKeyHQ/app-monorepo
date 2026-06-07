import type {
  ISwapProviderInfo,
  ISwapProviderManager,
  ISwapServiceProvider,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import { EProtocolOfExchange } from '@onekeyhq/shared/types/swap/types';
import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';

import {
  buildUnifiedSwapProviderManagers,
  getDenyBridgeProviderString,
  getDenySwapProviderString,
  mergeDenyProviderStrings,
  normalizeSwapProviderManagersForSave,
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
      singleSwapEnable: true,
      crossChainEnable: false,
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
    expect(
      result[0].singleSwapDisableNetworks?.map((item) => item.networkId),
    ).toEqual(['evm--1']);
    expect(
      result[0].crossChainDisableNetworks?.map((item) => item.networkId),
    ).toEqual([]);
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

  it('does not deny same-chain swap from legacy bridge provider disables', () => {
    const providerManagers = buildUnifiedSwapProviderManagers({
      serverProviders: [serverProvider({ provider: 'ProviderA' })],
      swapProviderManagers: [manager({ provider: 'ProviderA' })],
      bridgeProviderManagers: [
        manager({ provider: 'ProviderA', enable: false }),
      ],
    });

    const denyProviders = getDenySwapProviderString({
      providerManagers,
      fromNetworkId: 'evm--1',
      toNetworkId: 'evm--1',
    });

    expect(denyProviders).toBeUndefined();
  });

  it('keeps legacy swap network disables out of cross-chain quote denies', () => {
    const providerManagers = buildUnifiedSwapProviderManagers({
      serverProviders: [serverProvider({ provider: 'ProviderA' })],
      swapProviderManagers: [
        manager({
          provider: 'ProviderA',
          disableNetworks: [network('evm--1')],
        }),
      ],
      bridgeProviderManagers: [],
    });

    const denyProviders = getDenySwapProviderString({
      providerManagers,
      fromNetworkId: 'evm--1',
      toNetworkId: 'sol--101',
    });

    expect(denyProviders).toBeUndefined();
  });

  it('keeps legacy bridge disables scoped to cross-chain quote denies', () => {
    const providerManagers = buildUnifiedSwapProviderManagers({
      serverProviders: [serverProvider({ provider: 'ProviderA' })],
      swapProviderManagers: [manager({ provider: 'ProviderA' })],
      bridgeProviderManagers: [
        manager({ provider: 'ProviderA', enable: false }),
      ],
    });

    const denyProviders = getDenySwapProviderString({
      providerManagers,
      fromNetworkId: 'evm--1',
      toNetworkId: 'sol--101',
    });

    expect(denyProviders).toBe('ProviderA');
  });

  it('keeps unified provider manager settings stable after bridge cache is cleared', () => {
    const [firstBuildProviderManager] = buildUnifiedSwapProviderManagers({
      serverProviders: [serverProvider({ provider: 'ProviderA' })],
      swapProviderManagers: [
        manager({
          provider: 'ProviderA',
          enable: true,
          disableNetworks: [network('evm--1')],
        }),
      ],
      bridgeProviderManagers: [
        manager({
          provider: 'ProviderA',
          enable: false,
          disableNetworks: [network('sol--101')],
        }),
      ],
    });

    const [secondBuildProviderManager] = buildUnifiedSwapProviderManagers({
      serverProviders: [serverProvider({ provider: 'ProviderA' })],
      swapProviderManagers: [firstBuildProviderManager],
      bridgeProviderManagers: [],
    });

    expect(secondBuildProviderManager).toMatchObject({
      enable: false,
      singleSwapEnable: true,
      crossChainEnable: false,
    });
    expect(
      secondBuildProviderManager.singleSwapDisableNetworks?.map(
        (item) => item.networkId,
      ),
    ).toEqual(['evm--1']);
    expect(
      secondBuildProviderManager.crossChainDisableNetworks?.map(
        (item) => item.networkId,
      ),
    ).toEqual(['sol--101']);
    expect(
      getDenySwapProviderString({
        providerManagers: [secondBuildProviderManager],
        fromNetworkId: 'evm--1',
        toNetworkId: 'sol--101',
      }),
    ).toBe('ProviderA');
    expect(
      getDenySwapProviderString({
        providerManagers: [secondBuildProviderManager],
        fromNetworkId: 'evm--1',
        toNetworkId: 'evm--1',
      }),
    ).toBe('ProviderA');
  });

  it('does not treat legacy single-swap provider settings as cross-chain denies', () => {
    const denyProviders = getDenySwapProviderString({
      providerManagers: [
        manager({ provider: 'DisabledLegacySwapProvider', enable: false }),
        manager({
          provider: 'LegacySwapNetworkDisabledProvider',
          disableNetworks: [network('evm--1')],
        }),
      ],
      fromNetworkId: 'evm--1',
      toNetworkId: 'sol--101',
    });

    expect(denyProviders).toBeUndefined();
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

  it('merges unified deny providers with legacy bridge denies', () => {
    const denyProviders = mergeDenyProviderStrings(
      getDenySwapProviderString({
        providerManagers: [
          {
            ...manager({ provider: 'ProviderA', enable: false }),
            isSupportCrossChain: true,
          },
        ],
        fromNetworkId: 'evm--1',
        toNetworkId: 'sol--101',
      }),
      getDenyBridgeProviderString({
        providerManagers: [
          manager({ provider: 'ProviderA', enable: false }),
          manager({ provider: 'BridgeOnly', enable: false }),
          manager({ provider: 'EnabledBridge' }),
        ],
      }),
    );

    expect(denyProviders).toBe('ProviderA,BridgeOnly');
  });

  it('normalizes unified user settings into both quote modes on save', () => {
    const [providerManager] = normalizeSwapProviderManagersForSave([
      {
        ...manager({
          provider: 'ProviderA',
          enable: true,
          disableNetworks: [network('evm--1'), network('sol--101')],
        }),
        isSupportSingleSwap: true,
        isSupportCrossChain: true,
        singleSwapEnable: true,
        crossChainEnable: false,
        supportSingleSwapNetworks: [network('evm--1')],
        supportCrossChainNetworks: [network('evm--1'), network('sol--101')],
      },
    ]);

    expect(providerManager).toMatchObject({
      enable: true,
      singleSwapEnable: true,
      crossChainEnable: true,
    });
    expect(
      providerManager.singleSwapDisableNetworks?.map((item) => item.networkId),
    ).toEqual(['evm--1']);
    expect(
      providerManager.crossChainDisableNetworks?.map((item) => item.networkId),
    ).toEqual(['evm--1', 'sol--101']);
  });

  it('updates only one quote mode when saving provider settings by mode', () => {
    const [providerManager] = normalizeSwapProviderManagersForSave(
      [
        {
          ...manager({
            provider: 'ProviderA',
            enable: false,
            disableNetworks: [network('evm--1')],
          }),
          isSupportSingleSwap: true,
          isSupportCrossChain: true,
          singleSwapEnable: true,
          crossChainEnable: true,
          supportSingleSwapNetworks: [network('evm--1')],
          supportCrossChainNetworks: [network('evm--1'), network('sol--101')],
          crossChainDisableNetworks: [network('sol--101')],
        },
      ],
      'singleSwap',
    );

    expect(providerManager).toMatchObject({
      enable: false,
      singleSwapEnable: false,
      crossChainEnable: true,
    });
    expect(
      providerManager.singleSwapDisableNetworks?.map((item) => item.networkId),
    ).toEqual(['evm--1']);
    expect(
      providerManager.crossChainDisableNetworks?.map((item) => item.networkId),
    ).toEqual(['sol--101']);
  });
});
