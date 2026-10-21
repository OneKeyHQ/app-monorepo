import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';

import { resolveDefaultSelectedNetworkIds } from './resolveDefaultSelectedNetworkIds';

describe('resolveDefaultSelectedNetworkIds', () => {
  const networkIds = getNetworkIdsMap();

  it('returns no selection when nothing can be exported', () => {
    expect(
      resolveDefaultSelectedNetworkIds({
        homeNetworkId: networkIds.onekeyall,
        supportedNetworkIds: [],
      }),
    ).toEqual([]);
  });

  it('selects only ETH from all-networks mode when ETH can be exported', () => {
    expect(
      resolveDefaultSelectedNetworkIds({
        homeNetworkId: networkIds.onekeyall,
        supportedNetworkIds: [networkIds.btc, networkIds.eth, networkIds.sol],
      }),
    ).toEqual([networkIds.eth]);
  });

  it('selects the first supported network from all-networks mode when ETH cannot be exported', () => {
    expect(
      resolveDefaultSelectedNetworkIds({
        homeNetworkId: networkIds.onekeyall,
        supportedNetworkIds: [networkIds.btc, networkIds.sol],
      }),
    ).toEqual([networkIds.btc]);
  });

  it('keeps the current network when opening export from a single network', () => {
    expect(
      resolveDefaultSelectedNetworkIds({
        homeNetworkId: networkIds.btc,
        supportedNetworkIds: [networkIds.eth, networkIds.btc, networkIds.sol],
      }),
    ).toEqual([networkIds.btc]);
  });

  it('falls back to ETH when the current network cannot be exported', () => {
    expect(
      resolveDefaultSelectedNetworkIds({
        homeNetworkId: networkIds.btc,
        supportedNetworkIds: [networkIds.sol, networkIds.eth],
      }),
    ).toEqual([networkIds.eth]);
  });

  it('keeps the networks carried in from a previous export', () => {
    expect(
      resolveDefaultSelectedNetworkIds({
        homeNetworkId: networkIds.onekeyall,
        initialSelectedNetworkIds: [
          networkIds.btc,
          networkIds.sol,
          'unknown-network',
        ],
        supportedNetworkIds: [networkIds.eth, networkIds.btc, networkIds.sol],
      }),
    ).toEqual([networkIds.btc, networkIds.sol]);
  });

  it('falls back to the all-networks default when carried networks are unsupported', () => {
    expect(
      resolveDefaultSelectedNetworkIds({
        homeNetworkId: networkIds.onekeyall,
        initialSelectedNetworkIds: ['unknown-network'],
        supportedNetworkIds: [networkIds.btc, networkIds.eth],
      }),
    ).toEqual([networkIds.eth]);
  });
});
