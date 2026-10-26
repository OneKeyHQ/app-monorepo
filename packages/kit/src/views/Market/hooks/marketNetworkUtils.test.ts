import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ENetworkStatus } from '@onekeyhq/shared/types';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { IMarketBasicConfigNetwork } from '@onekeyhq/shared/types/marketV2';

import {
  buildMarketNetworkFromBasicConfig,
  resolveMarketHomeNetworkSelection,
  resolveMarketNetworkFromConfig,
} from './marketNetworkUtils';

const mockConfigNetwork: IMarketBasicConfigNetwork = {
  networkId: 'custom--123',
  index: 1,
  name: 'Custom Chain',
  logoUrl: 'https://example.com/custom.png',
  explorerUrl: 'https://explorer.example.com',
  chainId: '123',
};

describe('marketNetworkUtils', () => {
  it('builds a displayable server network from market basic config only', () => {
    expect(buildMarketNetworkFromBasicConfig(mockConfigNetwork)).toMatchObject({
      id: 'custom--123',
      impl: 'custom',
      chainId: '123',
      name: 'Custom Chain',
      logoURI: 'https://example.com/custom.png',
      explorerURL: 'https://explorer.example.com',
      status: ENetworkStatus.LISTED,
      defaultEnabled: false,
      isTestnet: false,
    });
  });

  it('keeps local network metadata while applying market display fields', () => {
    const localNetwork: IServerNetwork = {
      id: 'custom--123',
      impl: 'custom',
      chainId: '123',
      name: 'Local Custom',
      code: 'local-custom',
      shortname: 'LocalCustom',
      shortcode: 'localcustom',
      symbol: 'LOC',
      logoURI: 'https://example.com/local.png',
      decimals: 18,
      feeMeta: {
        symbol: 'LOC',
        decimals: 18,
      },
      defaultEnabled: true,
      status: ENetworkStatus.LISTED,
      isTestnet: true,
    };

    expect(
      resolveMarketNetworkFromConfig({
        configNetwork: mockConfigNetwork,
        networkInfo: localNetwork,
      }),
    ).toEqual({
      ...localNetwork,
      name: 'Custom Chain',
      logoURI: 'https://example.com/custom.png',
      explorerURL: 'https://explorer.example.com',
    });
  });
});

describe('restoring a saved market network', () => {
  it.each([true, undefined])(
    'preserves it while config loading is %s',
    (isConfigLoading) => {
      expect(
        resolveMarketHomeNetworkSelection({
          selectedNetworkId: 'evm--1',
          networkList: [mockConfigNetwork],
          isConfigLoading,
        }),
      ).toBe('evm--1');
    },
  );

  it('preserves it when a failed or empty config does not confirm removal', () => {
    expect(
      resolveMarketHomeNetworkSelection({
        selectedNetworkId: 'evm--1',
        networkList: [],
        isConfigLoading: false,
      }),
    ).toBe('evm--1');
  });

  it('restores an available network and keeps All selectable', () => {
    for (const selectedNetworkId of [
      mockConfigNetwork.networkId,
      getNetworkIdsMap().onekeyall,
    ]) {
      expect(
        resolveMarketHomeNetworkSelection({
          selectedNetworkId,
          networkList: [mockConfigNetwork],
          isConfigLoading: false,
        }),
      ).toBe(selectedNetworkId);
    }
  });

  it('uses All before rendering lists when a settled config removes the saved network', () => {
    expect(
      resolveMarketHomeNetworkSelection({
        selectedNetworkId: 'evm--1',
        networkList: [mockConfigNetwork],
        isConfigLoading: false,
      }),
    ).toBe(getNetworkIdsMap().onekeyall);
  });
});
