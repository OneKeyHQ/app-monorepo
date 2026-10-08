import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  ROBINHOOD_NETWORK_ID,
  getDefaultEnabledNetworkIdsInAllNetworks,
  getDefaultEnabledNetworksInAllNetworks,
} from '@onekeyhq/shared/src/config/presetNetworks';

import { isEnabledNetworksInAllNetworks } from './networkUtils';

const emptyState = {
  enabledNetworks: {},
  disabledNetworks: {},
};

describe('All Networks default-enabled set', () => {
  it('keeps every preset default and appends the server-delivered Robinhood chain', () => {
    const ids = getDefaultEnabledNetworkIdsInAllNetworks();
    const presetIds = getDefaultEnabledNetworksInAllNetworks().map(
      (network) => network.id,
    );

    expect(ids.slice(0, presetIds.length)).toEqual(presetIds);
    expect(ids).toContain(ROBINHOOD_NETWORK_ID);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('enables Robinhood without any persisted user choice', () => {
    expect(
      isEnabledNetworksInAllNetworks({
        networkId: ROBINHOOD_NETWORK_ID,
        ...emptyState,
        isTestnet: false,
      }),
    ).toBe(true);
  });

  it('respects an explicit Robinhood opt-out', () => {
    expect(
      isEnabledNetworksInAllNetworks({
        networkId: ROBINHOOD_NETWORK_ID,
        enabledNetworks: {},
        disabledNetworks: { [ROBINHOOD_NETWORK_ID]: true },
        isTestnet: false,
      }),
    ).toBe(false);
  });

  it('keeps preset defaults enabled and other mainnets opt-in', () => {
    expect(
      isEnabledNetworksInAllNetworks({
        networkId: getNetworkIdsMap().btc,
        ...emptyState,
        isTestnet: false,
      }),
    ).toBe(true);
    expect(
      isEnabledNetworksInAllNetworks({
        networkId: 'evm--999999',
        ...emptyState,
        isTestnet: false,
      }),
    ).toBe(false);
  });

  it('never enables a testnet by default', () => {
    expect(
      isEnabledNetworksInAllNetworks({
        networkId: 'evm--11155111',
        ...emptyState,
        isTestnet: true,
      }),
    ).toBe(false);
  });
});
