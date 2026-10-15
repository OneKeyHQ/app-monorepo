import networkUtils from '../utils/networkUtils';

import { getNetworkIdsMap } from './networkIds';
import { getPresetNetworks, presetNetworksMap } from './presetNetworks';

describe('Zcash preset network', () => {
  it('matches the indexed server network identity', () => {
    expect(presetNetworksMap.zec).toMatchObject({
      id: 'zec--0',
      impl: 'zec',
      chainId: '0',
      code: 'zec',
      shortcode: 'zec',
      shortname: 'ZEC',
      symbol: 'ZEC',
      backendIndex: true,
    });
    expect(getNetworkIdsMap().zec).toBe('zec--0');
    expect(
      networkUtils.getNetworkImpl({ networkId: presetNetworksMap.zec.id }),
    ).toBe(presetNetworksMap.zec.impl);
  });
});

describe('Monero preset network', () => {
  it('matches the client-scanned network identity', () => {
    expect(presetNetworksMap.xmr).toMatchObject({
      id: 'xmr--0',
      impl: 'xmr',
      chainId: '0',
      code: 'xmr',
      shortcode: 'xmr',
      shortname: 'XMR',
      symbol: 'XMR',
      // No third-party indexer covers Monero: the runtime is the only source
      // of balances and history.
      backendIndex: false,
    });
    expect(getNetworkIdsMap().xmr).toBe('xmr--0');
    expect(
      networkUtils.getNetworkImpl({ networkId: presetNetworksMap.xmr.id }),
    ).toBe(presetNetworksMap.xmr.impl);
  });

  /**
   * **Regression.** `presetNetworksMap` and the array `getPresetNetworks()`
   * returns are two hand-maintained lists of the same thing, and only the
   * second one feeds the network list the user searches.
   *
   * Monero shipped in the map but not the array: every id-keyed lookup worked,
   * the vault loaded, the tests passed -- and the chain simply did not exist
   * in the UI. Nothing else in the codebase notices that gap.
   */
  it('is in the list the network selector is built from, not only the id map', () => {
    const listed = getPresetNetworks().map((network) => network.id);
    expect(listed).toContain('xmr--0');
  });
});
