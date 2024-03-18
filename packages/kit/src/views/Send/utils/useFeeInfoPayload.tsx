// TODO auto update feeInfo
import { useCallback, useEffect, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIsFocused } from '@react-navigation/native';
import BigNumber from 'bignumber.js';

import { ToastManager } from '@onekeyhq/components';
import { FailedToEstimatedGasError } from '@onekeyhq/engine/src/errors';
import type { EIP1559Fee } from '@onekeyhq/engine/src/types/network';
import type { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import type {
  IEncodedTx,
  IFeeInfo,
  IFeeInfoPayload,
  IFeeInfoSelected,
  IFeeInfoUnit,
} from '@onekeyhq/engine/src/vaults/types';
import type { IEncodedTxBtc } from '@onekeyhq/engine/src/vaults/utils/btcForkChain/types';
import {
  calculateTotalFeeNative,
  calculateTotalFeeRange,
  getSelectedFeeInfoUnit,
} from '@onekeyhq/engine/src/vaults/utils/feeInfoUtils';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useActiveSideAccount, useAppSelector } from '../../../hooks';

import { useFeePresetIndex } from './useFeePresetIndex';

export const FEE_INFO_POLLING_INTERVAL = 5000;
// export const FEE_INFO_POLLING_INTERVAL = platformEnv.isDev ? 60 * 1000 : 5000;

export function useFeeInfoPayload({
  encodedTx,
  useFeeInTx = false, // do not set useFeeInTx=true if encodedTx generated from dapp
  pollingInterval = 0,
  fetchAnyway = false,
  networkId,
  accountId,
  signOnly,
  forBatchSend,
  payload,
  ignoreFetchFeeCalling,
  shouldStopPolling,
  isBtcForkChain,
}: {
  encodedTx: IEncodedTx | null;
  useFeeInTx?: boolean;
  pollingInterval?: number;
  fetchAnyway?: boolean;
  accountId: string;
  networkId: string;
  signOnly?: boolean;
  forBatchSend?: boolean;
  payload?: any;
  ignoreFetchFeeCalling?: boolean;
  shouldStopPolling?: boolean;
  isBtcForkChain?: boolean;
}) {
  const isFocused = useIsFocused();
  const { network } = useActiveSideAccount({ accountId, networkId });
  const [feeInfoError, setFeeInfoError] = useState<Error | null>(null);
  const [feeInfoPayload, setFeeInfoPayload] = useState<IFeeInfoPayload | null>(
    null,
  );
  const feeInfoPayloadCacheRef = useRef<IFeeInfoPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const route = useRoute();

  let defaultFeePresetIndex = useFeePresetIndex(networkId);
  const swapFeePresetIndex = useAppSelector(
    (s) => s.swapTransactions.swapFeePresetIndex,
  );
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (payload && payload?.type === 'InternalSwap' && swapFeePresetIndex) {
    defaultFeePresetIndex = swapFeePresetIndex;
  }

  const networkSetting = network?.settings;
  const subNetworkSetting = networkSetting?.subNetworkSettings?.[networkId];

  const feeInfoSelectedInRouteParams = (
    route.params as { feeInfoSelected?: IFeeInfoSelected }
  )?.feeInfoSelected;

  // prepareTransfer -> gasLimit
  // maxFeePerGas
  // price=5 limit=21000
  // total fee amount
  // max input
  const fetchFeeInfo =
    useCallback(async (): Promise<IFeeInfoPayload | null> => {
      if (!encodedTx) {
        return null;
      }
      const DEFAULT_PRESET_INDEX = '1';
      let feeInfoSelected = feeInfoSelectedInRouteParams;
      const {
        decimals: nativeDecimals,
        symbol: nativeSymbol,
        feeDecimals,
        feeSymbol,
      } = network ?? {};
      let info: IFeeInfo = {
        nativeDecimals,
        nativeSymbol,
        feeDecimals,
        feeSymbol,
        prices: [],
        defaultPresetIndex: defaultFeePresetIndex ?? DEFAULT_PRESET_INDEX,
      };

      let shouldFetch =
        !ignoreFetchFeeCalling &&
        (!feeInfoSelected || feeInfoSelected?.type === 'preset');
      if (fetchAnyway && !ignoreFetchFeeCalling) {
        shouldFetch = true;
      }

      // TODO rename to FeeInfoMeta
      if (shouldFetch) {
        try {
          info = await backgroundApiProxy.engine.fetchFeeInfo({
            accountId,
            networkId,
            encodedTx,
            signOnly,
          });
          setFeeInfoError(null);
        } catch (error: any) {
          const { code: errCode, data: innerError } = error as {
            code?: number;
            data?: Error;
          };

          if (errCode === -32603 && innerError) {
            // Internal RPC Error during fetching fee info
            setFeeInfoError(innerError);
          } else {
            setFeeInfoError(error);
          }
          debugLogger.sendTx.error('engine.fetchFeeInfo ERROR: ', error);
          return null;
        }
      }

      if (useFeeInTx) {
        if (isBtcForkChain) {
          const { totalFee } = encodedTx as IEncodedTxBtc;
          info.tx = {
            isBtcForkChain: true,
            btcFee: new BigNumber(totalFee).toNumber(),
          };
        } else {
          const {
            maxFeePerGas,
            maxPriorityFeePerGas,
            gas,
            gasLimit,
            gasPrice,
          } = encodedTx as IEncodedTxEvm;
          const limit = gasLimit || gas;
          if (maxFeePerGas && maxPriorityFeePerGas) {
            const price1559 = {
              baseFee: new BigNumber(gasPrice ?? 0)
                .shiftedBy(-(feeDecimals ?? 0))
                .toFixed(),
              maxFeePerGas: new BigNumber(maxFeePerGas)
                .shiftedBy(-(feeDecimals ?? 0))
                .toFixed(),
              maxPriorityFeePerGas: new BigNumber(maxPriorityFeePerGas)
                .shiftedBy(-(feeDecimals ?? 0))
                .toFixed(),
            };
            info.eip1559 = true;
            info.limit = limit || info.limit;
            info.prices = [price1559];
            info.tx = {
              eip1559: true,
              limit,
              price1559,
            };
          } else if (gasPrice) {
            info.eip1559 = false;
            const price = new BigNumber(gasPrice ?? 0)
              .shiftedBy(-(feeDecimals ?? 0))
              .toFixed();
            info.limit = limit || info.limit;
            info.prices = [price];
            info.tx = {
              eip1559: false,
              limit: limit || info.limit,
              price,
            };
          } else if (limit) {
            info.tx = {
              limit,
              eip1559: info.eip1559,
              ...(info.eip1559
                ? {
                    price1559: info.prices[
                      Number(info.defaultPresetIndex)
                    ] as EIP1559Fee,
                  }
                : {
                    price: info.prices[
                      Number(info.defaultPresetIndex)
                    ] as string,
                  }),
            };
          }
        }
      }

      if (defaultFeePresetIndex) {
        info.defaultPresetIndex = defaultFeePresetIndex;
      }
      if (parseFloat(info.defaultPresetIndex) > info.prices.length - 1) {
        info.defaultPresetIndex = `${info.prices.length - 1}`;
      }
      if (parseFloat(info.defaultPresetIndex) < 0) {
        info.defaultPresetIndex = '0';
      }

      let currentInfoUnit: IFeeInfoUnit = {
        price: '0',
        limit: '0',
      };

      // useFeeInTx ONLY if encodedTx including full fee info
      if (!feeInfoSelected && info && useFeeInTx && info.tx) {
        // TODO update currentInfoUnit ONLY, do not change feeInfoSelected
        feeInfoSelected = {
          type: 'custom',
          custom: info.tx,
          preset: info.defaultPresetIndex,
        };
      }
      feeInfoSelected = feeInfoSelected || {
        type: 'preset',
        preset: info.defaultPresetIndex,
      };

      if (
        forBatchSend &&
        info &&
        feeInfoSelected.type === 'preset' &&
        feeInfoSelected.preset
      ) {
        info.customDisabled = true;
      }

      // TODO reset to type=preset if custom.limit < info.limit (switch native token to erc20)
      if (feeInfoSelected.type === 'custom' && feeInfoSelected.custom) {
        currentInfoUnit = feeInfoSelected.custom;
      }
      if (info && feeInfoSelected.type === 'preset' && feeInfoSelected.preset) {
        currentInfoUnit = getSelectedFeeInfoUnit({
          info,
          index: feeInfoSelected.preset,
        });
      }

      // in GWEI
      const feeRange = calculateTotalFeeRange(currentInfoUnit, nativeDecimals);
      const total = feeRange.max;
      const totalForDisplay = feeRange.maxForDisplay;
      const totalNative = calculateTotalFeeNative({
        amount: total,
        info,
      });
      const totalNativeForDisplay = calculateTotalFeeNative({
        amount: totalForDisplay,
        info,
      });
      const current = {
        value: currentInfoUnit,
        total,
        totalForDisplay,
        totalNative,
        totalNativeForDisplay,
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
      debugLogger.sendTx.info('useFeeInfoPayload: ', result);

      if (
        new BigNumber(result?.current?.total ?? 0).isZero() &&
        !networkSetting?.allowZeroFee &&
        !subNetworkSetting?.allowZeroFee
      ) {
        throw new FailedToEstimatedGasError();
      }

      return result;
    }, [
      encodedTx,
      feeInfoSelectedInRouteParams,
      network,
      defaultFeePresetIndex,
      ignoreFetchFeeCalling,
      fetchAnyway,
      useFeeInTx,
      forBatchSend,
      networkSetting?.allowZeroFee,
      subNetworkSetting?.allowZeroFee,
      accountId,
      networkId,
      signOnly,
      isBtcForkChain,
    ]);

  useEffect(() => {
    (async function () {
      if (!encodedTx) {
        return null;
      }
      // first time loading only, Interval loading does not support yet.
      setLoading(true);
      try {
        const info = await fetchFeeInfo();
        // await delay(600);
        setFeeInfoPayload(info);
      } catch (error: any) {
        // TODO: only an example implementation about showing rpc error
        const { code: errCode } = error as { code?: number };
        if (errCode === -32603) {
          const {
            data: { message },
          } = error;
          if (typeof message === 'string') {
            ToastManager.show({ title: message });
          }
        }
        setFeeInfoPayload(null);
        setFeeInfoError(error);
        debugLogger.sendTx.error('fetchFeeInfo ERROR: ', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [encodedTx, fetchFeeInfo]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (pollingInterval && isFocused) {
      timer = setInterval(async () => {
        if (loading || shouldStopPolling) {
          return;
        }
        try {
          const info = await fetchFeeInfo();
          if (info) {
            setFeeInfoPayload(info);
            feeInfoPayloadCacheRef.current = info;
          } else if (feeInfoPayloadCacheRef.current) {
            // ** use last cache if error
            setFeeInfoPayload(feeInfoPayloadCacheRef.current);
            setFeeInfoError(null);
          }
        } catch (error: any) {
          if (feeInfoPayloadCacheRef.current) {
            // ** use last cache if error
            setFeeInfoPayload(feeInfoPayloadCacheRef.current);
            setFeeInfoError(null);
          } else {
            setFeeInfoError(error);
          }
          debugLogger.sendTx.error('feeInfoPollingInterval ERROR: ', error);
        }
      }, pollingInterval);
    }
    return () => {
      clearInterval(timer);
    };
  }, [fetchFeeInfo, isFocused, loading, pollingInterval, shouldStopPolling]);

  return {
    feeInfoError,
    feeInfoPayload,
    feeInfoLoading: loading,
    getSelectedFeeInfoUnit,
  };
}
