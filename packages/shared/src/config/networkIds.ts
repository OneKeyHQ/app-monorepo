import { memoFn } from '../utils/cacheUtils';

import { getPresetNetworks } from './presetNetworks';

export const NETWORK_ID_ETC = 'evm--61';

export type INetworkShortCode =
  | 'eth'
  | 'goerli'
  | 'arbitrum'
  | 'optimism'
  | 'avalanche'
  | 'bsc'
  | 'sol'
  | 'near'
  | 'algo'
  | 'stc'
  | 'cfx'
  | 'apt'
  | 'doge'
  | 'xna'
  | 'bch'
  | 'xrp'
  | 'ada'
  | 'sui'
  | 'fil'
  | 'dot'
  | 'kaspa'
  | 'nexa'
  | 'nostr'
  | 'dnx'
  | 'ckb'
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
  | 'ltc'
  | 'trx'
  | 'sepolia';

// TODO generate getNetworkIdsMap in build time
export const getNetworkIdsMap = memoFn(() => {
  const networks = getPresetNetworks();
  return networks.reduce((memo, n) => {
    memo[n.shortcode as INetworkShortCode] = n.id;
    return memo;
  }, {} as Record<INetworkShortCode, string>);
});
export const getNetworkIds = memoFn(() => Object.keys(getNetworkIdsMap()));
