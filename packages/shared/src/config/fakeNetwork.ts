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
  logoURI: 'https://common.onekey-asset.com/chain/all.png',
} as unknown as IServerNetwork;

export const FAKE_ALL_NETWORK = allNetwork;

const nostrNetwork = {
  id: 'nostr--0',
  impl: 'nostr',
  chainId: '0',
  code: 'nostr',
  defaultEnabled: true,
  isTestnet: false,
  priceConfigs: [],
  explorers: [],
  rpcURLs: [],
  feeMeta: {
    symbol: 'nostr',
    decimals: 0,
    code: 'nostr',
  },
  balance2FeeDecimals: 0,
  decimals: 0,
  status: 'LISTED',
  name: 'Nostr',
  symbol: 'Nostr',
  shortname: 'Nostr',
  shortcode: 'nostr',
  extensions: {},
  clientApi: {},
  logoURI: 'https://common.onekey-asset.com/chain/all.png',
} as unknown as IServerNetwork;

export const FAKE_NOSTR_NETWORK = nostrNetwork;
