// TODO auto update feeInfo
import { useCallback, useEffect, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';

import { EIP1559Fee } from '@onekeyhq/engine/src/types/network';
import {
  IEncodedTxAny,
  IFeeInfo,
  IFeeInfoPayload,
  IFeeInfoSelected,
  IFeeInfoUnit,
} from '@onekeyhq/engine/src/types/vault';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount } from '../../hooks/redux';

export function calculateTotalFeeNative({
  amount,
  info,
}: {
  amount: string;
  info: IFeeInfo;
}) {
  return new BigNumber(amount).shiftedBy(-1 * (info.decimals ?? 0)).toFixed();
}

export function calculateTotalFeeRange(feeValue: IFeeInfoUnit) {
  if (feeValue.eip1559) {
    // MIN: (baseFee + maxPriorityFeePerGas) * limit
    const priceInfo = feeValue.price as EIP1559Fee;
    const min = new BigNumber(feeValue.limit as string)
      .times(
        new BigNumber(priceInfo.baseFee).plus(priceInfo.maxPriorityFeePerGas),
      )
      .toFixed();
    // MAX: maxFeePerGas * limit
    const max = new BigNumber(feeValue.limit as string)
      .times(priceInfo.maxFeePerGas)
      .toFixed();
    return {
      min,
      max,
    };
  }

  const max = new BigNumber(feeValue.limit as string)
    .times(feeValue.price as string)
    .toFixed();
  return {
    min: max,
    max,
  };
}

// TODO remove
export function calculateTotalFee(feeValue: IFeeInfoUnit) {
  if (feeValue.eip1559) {
    // MIN: (baseFee + maxPriorityFeePerGas) * limit
    // MAX: maxFeePerGas * limit
    const priceInfo = feeValue.price as EIP1559Fee;
    return new BigNumber(feeValue.limit as string)
      .times(priceInfo.maxFeePerGas)
      .toFixed();
  }

  return new BigNumber(feeValue.limit as string)
    .times(feeValue.price as string)
    .toFixed();
}

export function useFeeInfoPayload({
  encodedTx,
  useFeeInTx = false, // do not set useFeeInTx=true if encodedTx generated from dapp
}: {
  encodedTx: IEncodedTxAny;
  useFeeInTx?: boolean;
}) {
  const { accountId, networkId } = useActiveWalletAccount();
  const [feeInfoPayload, setFeeInfoPayload] = useState<IFeeInfoPayload | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const route = useRoute();
  // TODO use standalone function
  const getSelectedFeeInfoUnit = useCallback(
    ({
      info,
      index,
    }: {
      info: IFeeInfo;
      index: string | number;
    }): IFeeInfoUnit => {
      const priceInfo = info.prices[index as number];
      return {
        eip1559: info.eip1559,
        price: priceInfo,
        limit: info.limit,
      };
    },
    [],
  );
  // const { data: gasList } = useGas();
  // prepareTransfer -> gasLimit
  // maxFeePerGas
  // price=5 limit=21000
  // total fee amount
  // max input
  const fetchFeeInfo = useCallback(async () => {
    if (!encodedTx) {
      return null;
    }
    const DEFAULT_PRESET_INDEX = '0';
    let feeInfoSelected = (
      route.params as { feeInfoSelected?: IFeeInfoSelected }
    )?.feeInfoSelected;

    // TODO rename to FeeInfoMeta
    const info = await backgroundApiProxy.engine.fetchFeeInfo({
      accountId,
      networkId,
      encodedTx,
    });
    let currentInfoUnit: IFeeInfoUnit = {
      price: '0',
      limit: '0',
    };

    // useFeeInTx ONLY if encodedTx including full fee info
    if (!feeInfoSelected && useFeeInTx && info.tx) {
      // TODO update currentInfoUnit ONLY, do not change feeInfoSelected
      feeInfoSelected = {
        type: 'custom',
        custom: info.tx,
        preset: DEFAULT_PRESET_INDEX,
      };
    }
    feeInfoSelected = feeInfoSelected || {
      type: 'preset',
      preset: DEFAULT_PRESET_INDEX,
    };

    // TODO reset to type=preset if custom.limit < info.limit (switch native token to erc20)
    if (feeInfoSelected.type === 'custom' && feeInfoSelected.custom) {
      currentInfoUnit = feeInfoSelected.custom;
    }
    if (feeInfoSelected.type === 'preset' && feeInfoSelected.preset) {
      currentInfoUnit = getSelectedFeeInfoUnit({
        info,
        index: feeInfoSelected.preset,
      });
    }

    const total = calculateTotalFeeRange(currentInfoUnit).max;
    const totalNative = calculateTotalFeeNative({
      amount: total,
      info,
    });
    const current = {
      value: currentInfoUnit,
      total,
      totalNative,
    };
    const result = {
      // { type:'preset', preset:'1', custom: { price, limit } }
      selected: feeInfoSelected,
      // limit: "21000", prices: ['5'],
      // symbol: 'Gwei', decimals, eip1559: true, currency:'tokenAddress'
      // limit\price already included in encodedTx
      info,
      current,
    };
    debugLogger.sendTx('useFeeInfoPayload: ', result);
    return result;
  }, [
    accountId,
    encodedTx,
    getSelectedFeeInfoUnit,
    networkId,
    route.params,
    useFeeInTx,
  ]);
  useEffect(() => {
    setLoading(true);
    fetchFeeInfo()
      .then((info) => setFeeInfoPayload(info))
      .finally(() => {
        setLoading(false);
      });
  }, [encodedTx, fetchFeeInfo, setFeeInfoPayload]);
  return {
    feeInfoPayload,
    feeInfoLoading: loading,
    getSelectedFeeInfoUnit,
    calculateTotalFee,
  };
}
