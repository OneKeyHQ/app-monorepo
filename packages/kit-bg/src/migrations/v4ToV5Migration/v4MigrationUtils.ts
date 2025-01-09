import BigNumber from 'bignumber.js';

import {
  COINTYPE_STC,
  COINTYPE_XMR,
} from '@onekeyhq/shared/src/engine/engineConsts';

import type { IV4EIP1559Fee, IV4FeeInfo, IV4FeeInfoUnit } from './v4types';

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

function nanToZeroString(value: string | number | unknown) {
  if (value === 'NaN' || Number.isNaN(value)) {
    return '0';
  }
  return value as string;
}

function nilError(message: string): number {
  throw new Error(message);
}

function calculateTotalFeeNative({
  amount, // in GWEI
  info,
  displayDecimal = 8,
}: {
  amount: string | BigNumber;
  info: IV4FeeInfo;
  displayDecimal?: number;
}) {
  return new BigNumber(amount)
    .plus(info.baseFeeValue ?? 0)
    .shiftedBy(
      info.feeDecimals ??
        nilError('calculateTotalFeeNative ERROR: info.feeDecimals missing'),
    ) // GWEI -> onChainValue
    .shiftedBy(
      -(
        info.nativeDecimals ??
        nilError('calculateTotalFeeNative ERROR: info.nativeDecimals missing')
      ),
    ) // onChainValue -> nativeAmount
    .toFixed(displayDecimal);
}

function calculateTotalFeeRange(feeValue: IV4FeeInfoUnit, displayDecimals = 8) {
  const limit = feeValue.limitUsed || feeValue.limit;
  const limitForDisplay = feeValue.limitForDisplay ?? limit;
  if (feeValue.eip1559) {
    // MIN: (baseFee + maxPriorityFeePerGas) * limit
    const priceInfo = feeValue.price1559 as IV4EIP1559Fee;
    const min = new BigNumber(limit as string)
      .times(
        new BigNumber(priceInfo.baseFee).plus(priceInfo.maxPriorityFeePerGas),
      )
      .toFixed(displayDecimals);

    const minForDisplay = new BigNumber(limitForDisplay as string)
      .times(
        new BigNumber(priceInfo.baseFee).plus(priceInfo.maxPriorityFeePerGas),
      )
      .toFixed(displayDecimals);

    // MAX: maxFeePerGas * limit
    const max = new BigNumber(limit as string)
      .times(priceInfo.gasPrice || priceInfo.maxFeePerGas)
      .toFixed(displayDecimals);

    const maxForDisplay = new BigNumber(limitForDisplay as string)
      .times(priceInfo.gasPrice || priceInfo.maxFeePerGas)
      .toFixed(displayDecimals);
    return {
      min: nanToZeroString(min),
      max: nanToZeroString(max),
      minForDisplay: nanToZeroString(minForDisplay),
      maxForDisplay: nanToZeroString(maxForDisplay),
    };
  }

  if (feeValue.isBtcForkChain) {
    const fee = new BigNumber(feeValue.btcFee ?? '0')
      .shiftedBy(-displayDecimals)
      .toFixed(displayDecimals);
    return {
      min: nanToZeroString(fee),
      max: nanToZeroString(fee),
      minForDisplay: nanToZeroString(fee),
      maxForDisplay: nanToZeroString(fee),
    };
  }

  const max = new BigNumber(limit as string)
    .times(feeValue.price as string)
    .toFixed();

  const maxForDisplay = new BigNumber(limitForDisplay as string)
    .times(feeValue.price as string)
    .toFixed();

  return {
    min: nanToZeroString(max),
    max: nanToZeroString(max),
    minForDisplay: nanToZeroString(maxForDisplay),
    maxForDisplay: nanToZeroString(maxForDisplay),
  };
}

export default {
  isCoinTypeSupport,
  getNotSupportNetworkInfo,
  calculateTotalFeeRange,
  calculateTotalFeeNative,
};
