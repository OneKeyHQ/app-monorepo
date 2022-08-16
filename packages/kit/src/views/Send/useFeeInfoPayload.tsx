// TODO auto update feeInfo
import { useCallback, useEffect, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIsFocused } from '@react-navigation/native';

import { useToast } from '@onekeyhq/components';
import {
  IEncodedTx,
  IFeeInfo,
  IFeeInfoPayload,
  IFeeInfoSelected,
  IFeeInfoUnit,
} from '@onekeyhq/engine/src/vaults/types';
import {
  calculateTotalFeeNative,
  calculateTotalFeeRange,
} from '@onekeyhq/engine/src/vaults/utils/feeInfoUtils';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount } from '../../hooks';

export const FEE_INFO_POLLING_INTERVAL = 5000;

export function useFeeInfoPayload({
  encodedTx,
  useFeeInTx = false, // do not set useFeeInTx=true if encodedTx generated from dapp
  pollingInterval = 0,
  fetchAnyway = false,
}: {
  encodedTx: IEncodedTx | null;
  useFeeInTx?: boolean;
  pollingInterval?: number;
  fetchAnyway?: boolean;
}) {
  const isFocused = useIsFocused();
  const { network, accountId, networkId } = useActiveWalletAccount();
  const [feeInfoError, setFeeInfoError] = useState<Error | null>(null);
  const [feeInfoPayload, setFeeInfoPayload] = useState<IFeeInfoPayload | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const route = useRoute();
  const toast = useToast();
  const feeInfoSelectedInRouteParams = (
    route.params as { feeInfoSelected?: IFeeInfoSelected }
  )?.feeInfoSelected;
  // TODO use standalone function
  const getSelectedFeeInfoUnit = useCallback(
    ({
      info,
      index,
    }: {
      info: IFeeInfo;
      index: string | number;
    }): IFeeInfoUnit => {
      const indexNum = parseInt(index as string, 10);
      const priceIndex =
        indexNum > info.prices.length - 1 ? info.prices.length - 1 : indexNum;
      const priceInfo = info.prices[priceIndex];
      return {
        eip1559: info.eip1559,
        price: priceInfo,
        limit: info.limit,
      };
    },
    [],
  );

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
        defaultPresetIndex: DEFAULT_PRESET_INDEX,
      };
      let shouldFetch = !feeInfoSelected || feeInfoSelected?.type === 'preset';
      if (fetchAnyway) {
        shouldFetch = true;
      }
      // TODO rename to FeeInfoMeta
      if (shouldFetch) {
        try {
          info = await backgroundApiProxy.engine.fetchFeeInfo({
            accountId,
            networkId,
            encodedTx,
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
      debugLogger.sendTx.info('useFeeInfoPayload: ', result);
      return result;
    }, [
      accountId,
      encodedTx,
      feeInfoSelectedInRouteParams,
      fetchAnyway,
      getSelectedFeeInfoUnit,
      network,
      networkId,
      useFeeInTx,
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
            toast.show({ title: message });
          }
        }
        setFeeInfoPayload(null);
        setFeeInfoError(error);
        debugLogger.sendTx.error('fetchFeeInfo ERROR: ', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [encodedTx, fetchFeeInfo, setFeeInfoPayload, toast]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (pollingInterval && isFocused) {
      timer = setInterval(async () => {
        if (loading) {
          return;
        }
        if (feeInfoSelectedInRouteParams?.type === 'custom') {
          return;
        }
        try {
          const info = await fetchFeeInfo();
          setFeeInfoPayload(info);
        } catch (error: any) {
          setFeeInfoError(error);
          debugLogger.sendTx.error('feeInfoPollingInterval ERROR: ', error);
        }
      }, pollingInterval);
    }
    return () => {
      clearInterval(timer);
    };
  }, [
    feeInfoSelectedInRouteParams?.type,
    fetchFeeInfo,
    loading,
    pollingInterval,
    isFocused,
  ]);

  return {
    feeInfoError,
    feeInfoPayload,
    feeInfoLoading: loading,
    getSelectedFeeInfoUnit,
  };
}
