import BigNumber from 'bignumber.js';

import type { EIP1559Fee } from '@onekeyhq/engine/src/types/network';
import type {
  IFeeInfoPrice,
  IFeeInfoUnit,
} from '@onekeyhq/engine/src/vaults/types';

function getCustomFeeSpeedInfo({
  custom,
  prices,
  isEIP1559Fee,
  waitingSeconds,
}: {
  prices: IFeeInfoPrice[];
  waitingSeconds: number[];
  custom?: IFeeInfoUnit;
  isEIP1559Fee?: boolean;
}) {
  let customWaitingSeconds = 0;
  let customSimilarToPreset = '0';
  const low = {
    price: prices[0],
    waitingSeconds: waitingSeconds[0],
  };
  const medium = {
    price: prices[1],
    waitingSeconds: waitingSeconds[1],
  };
  const high = {
    price: prices[2],
    waitingSeconds: waitingSeconds[2],
  };
  if (isEIP1559Fee) {
    const customPriorityBN = new BigNumber(
      custom?.price1559?.maxPriorityFeePerGas ?? 0,
    );
    if (
      customPriorityBN.isGreaterThanOrEqualTo(
        (medium.price as EIP1559Fee)?.maxPriorityFeePerGas,
      )
    ) {
      if (
        customPriorityBN.isLessThan(
          (high.price as EIP1559Fee)?.maxPriorityFeePerGas,
        )
      ) {
        // Medium
        customWaitingSeconds = medium.waitingSeconds;
        customSimilarToPreset = '1';
      } else {
        // High
        customWaitingSeconds = high.waitingSeconds;
        customSimilarToPreset = '2';
      }
    } else {
      customWaitingSeconds = low.waitingSeconds;
      customSimilarToPreset = '0';
    }
  } else {
    const customPriceBN = custom?.feeRate
      ? new BigNumber(custom?.feeRate ?? 0).shiftedBy(-8)
      : new BigNumber(custom?.price ?? 0);

    if (prices.length === 1) {
      if (customPriceBN.isGreaterThan(low.price as string)) {
        customWaitingSeconds = low.waitingSeconds - 1;
        customSimilarToPreset = '2';
      } else if (customPriceBN.isEqualTo(low.price as string)) {
        customWaitingSeconds = low.waitingSeconds;
        customSimilarToPreset = '1';
      } else {
        customWaitingSeconds = low.waitingSeconds + 1;
        customSimilarToPreset = '0';
      }
    } else if (customPriceBN.isGreaterThanOrEqualTo(medium.price as string)) {
      if (customPriceBN.isLessThan(high.price as string)) {
        // Medium
        customWaitingSeconds = medium.waitingSeconds;
        customSimilarToPreset = '1';
      } else {
        // High
        customWaitingSeconds = high.waitingSeconds;
        customSimilarToPreset = '2';
      }
    } else {
      customWaitingSeconds = low.waitingSeconds;
      customSimilarToPreset = '0';
    }
  }

  return {
    customSimilarToPreset,
    customWaitingSeconds,
  };
}

export { getCustomFeeSpeedInfo };
