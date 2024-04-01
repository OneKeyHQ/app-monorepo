import { memoFn } from '../utils/cacheUtils';

import { getPresetNetworks } from './presetNetworks';

export const NETWORK_ID_ETC = 'evm--61';

type INetworkShortCode =
  | 'eth'
  | 'goerli'
  | 'arbitrum'
  | 'optimism'
  | 'avalanche'
  | 'bsc'
  | 'sol'
  | 'btc'
  | 'tbtc'
  | 'juno'
  | 'osmosis'
  | 'secretnetwork'
  | 'cosmoshub'
  | 'akash'
  | 'fetch'
  | 'terra'
  | 'cryptoorgchain'
  | 'injective'
  | 'polygon'
  | 'tlightning'
  | 'lightning'
  | 'ltc';
// TODO generate getNetworkIdsMap in build time
export const getNetworkIdsMap = memoFn(() => {
  const networks = getPresetNetworks();
  return networks.reduce((memo, n) => {
    memo[n.shortcode as INetworkShortCode] = n.id;
    return memo;
  }, {} as Record<INetworkShortCode, string>);
});
