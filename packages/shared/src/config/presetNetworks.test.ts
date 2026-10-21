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
      backendIndex: false,
    });
    expect(getNetworkIdsMap().xmr).toBe('xmr--0');
    expect(
      networkUtils.getNetworkImpl({ networkId: presetNetworksMap.xmr.id }),
    ).toBe(presetNetworksMap.xmr.impl);
  });

  // presetNetworksMap and getPresetNetworks() are separate hand-maintained
  // lists; only the array feeds the network selector.
  it('is in the list the network selector is built from, not only the id map', () => {
    const listed = getPresetNetworks().map((network) => network.id);
    expect(listed).toContain('xmr--0');
  });
});
