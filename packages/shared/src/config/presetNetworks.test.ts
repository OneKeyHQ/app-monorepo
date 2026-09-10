import networkUtils from '../utils/networkUtils';

import { getNetworkIdsMap } from './networkIds';
import { presetNetworksMap } from './presetNetworks';

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
