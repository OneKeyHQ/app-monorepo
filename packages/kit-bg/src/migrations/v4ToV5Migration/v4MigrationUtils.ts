import {
  COINTYPE_STC,
  COINTYPE_XMR,
} from '@onekeyhq/shared/src/engine/engineConsts';

const notSupportedCoinType = [COINTYPE_XMR, COINTYPE_STC];

const notSupportedNetworksInfo: Partial<{
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

function isCoinTypeSupport({ coinType }: { coinType: string }) {
  return !notSupportedCoinType.includes(coinType) && coinType;
}
function getNotSupportNetworkInfo({ networkId }: { networkId: string }) {
  return notSupportedNetworksInfo[networkId];
}
export default {
  isCoinTypeSupport,
  getNotSupportNetworkInfo,
};
