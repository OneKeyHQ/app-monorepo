import debugLogger from '../logger/debugLogger';

import type { IServerNetwork } from '../../types';

const allNetwork = {
  id: 'all--0',
  impl: 'all',
  chainId: '0',
  code: 'allnetworks',
  defaultEnabled: true,
  isTestnet: false,
  priceConfigs: [],
  explorers: [],
  rpcURLs: [],
  feeMeta: {
    symbol: 'allnetwork',
    decimals: 0,
    code: 'allnetwork',
  },
  balance2FeeDecimals: 0,
  decimals: 0,
  status: 'LISTED',
  name: 'All Networks',
  symbol: 'All Networks',
  shortname: 'All Networks',
  shortcode: 'allnetworks',
  extensions: {},
  clientApi: {},
  logoURI: require('../../../app/assets/all-networks.png'),
} as unknown as IServerNetwork;

export const FAKE_ALL_NETWORK = new Proxy(allNetwork, {
  get: (target, method) => {
    const data = target[method as keyof typeof allNetwork];
    if (typeof data === 'undefined') {
      debugLogger.common.error(
        `Error reading allNetwork props: ${String(method)}`,
      );
    }
    return data;
  },
});
