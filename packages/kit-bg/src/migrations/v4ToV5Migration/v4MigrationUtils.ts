import {
  COINTYPE_STC,
  COINTYPE_XMR,
} from '@onekeyhq/shared/src/engine/engineConsts';

const notSupportedCoinType = [COINTYPE_XMR, COINTYPE_STC];

function isCoinTypeSupport({ coinType }: { coinType: string }) {
  return !notSupportedCoinType.includes(coinType) && coinType;
}
export default {
  isCoinTypeSupport,
};
