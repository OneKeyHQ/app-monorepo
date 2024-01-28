import { memoFn } from '../utils/cacheUtils';

import { getPresetNetworks } from './presetNetworks';

type INetworkShortCode =
  | 'eth'
  | 'goerli'
  | 'arbitrum'
  | 'optimism'
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
  | 'lightning';
// TODO generate getNetworkIdsMap in build time
export const getNetworkIdsMap = memoFn(() => {
  const networks = getPresetNetworks();
  return networks.reduce((memo, n) => {
    memo[n.shortcode as INetworkShortCode] = n.id;
    return memo;
  }, {} as Record<INetworkShortCode, string>);
});
