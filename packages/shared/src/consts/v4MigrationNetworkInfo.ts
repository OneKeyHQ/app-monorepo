const V4_UNSUPPORTED_NETWORKS_INFO: Partial<{
  [networkId: string]: {
    logo: string;
  };
}> = {
  'stc--1': {
    logo: 'https://uni.onekey-asset.com/static/chain/stc.png',
  },
  'stc--251': {
    logo: 'https://uni.onekey-asset.com/static/chain/tstc.png',
  },
  'xmr--0': {
    logo: 'https://common.onekey-asset.com/chain/monero.png',
  },
};

export function getV4UnsupportedNetworkInfo({
  networkId,
}: {
  networkId: string;
}) {
  return V4_UNSUPPORTED_NETWORKS_INFO[networkId];
}
