// TODO auto update feeInfo
import { useCallback, useEffect, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIsFocused } from '@react-navigation/native';
import BigNumber from 'bignumber.js';

import { useToast } from '@onekeyhq/components';
import { IMPL_EVM } from '@onekeyhq/engine/src/constants';
import { batchTransferContractAddress } from '@onekeyhq/engine/src/presets/batchTransferContractAddress';
import { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import {
  IDecodedTx,
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useActiveSideAccount, useAppSelector } from '../../../hooks';

export const FEE_INFO_POLLING_INTERVAL = 5000;
// export const FEE_INFO_POLLING_INTERVAL = platformEnv.isDev ? 60 * 1000 : 5000;

function useFeePresetIndex(networkId: string) {
  const feePresetIndexMap = useAppSelector((s) => s.data.feePresetIndexMap);
  return feePresetIndexMap?.[networkId];
}

export function useBatchSendConfirmFeeInfoPayload({
  encodedTxs,
  decodedTxs,
  useFeeInTx = false,
  pollingInterval = 0,
  fetchAnyway = false,
  networkId,
  accountId,
  signOnly,
  forBatchSend,
}: {
  encodedTxs: IEncodedTx[];
  decodedTxs: IDecodedTx[];
  useFeeInTx?: boolean;
  pollingInterval?: number;
  fetchAnyway?: boolean;
  accountId: string;
  networkId: string;
  signOnly?: boolean;
  forBatchSend?: boolean;
}) {
  const isFocused = useIsFocused();
  const { network } = useActiveSideAccount({ accountId, networkId });
  const [feeInfoError, setFeeInfoError] = useState<Error | null>(null);
  const [feeInfoPayloads, setFeeInfoPayloads] = useState<IFeeInfoPayload[]>([]);
  const [totalFeeInNative, setTotalFeeInNative] = useState<number>(0);
  const feeInfoPayloadCacheRef = useRef<IFeeInfoPayload[]>([]);
  const [loading, setLoading] = useState(true);
  const route = useRoute();
  const toast = useToast();
  const defaultFeePresetIndex = useFeePresetIndex(networkId);
  const feeInfoSelectedInRouteParams = (
    route.params as { feeInfoSelected?: IFeeInfoSelected }
  )?.feeInfoSelected;
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

  const fetchFeeInfo = useCallback(
    async (encodedTx: IEncodedTx): Promise<IFeeInfoPayload | null> => {
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
      let currentInfoUnit: IFeeInfoUnit = {
        price: '0',
        limit: '0',
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
            signOnly,
          });
          setFeeInfoError(null);
        } catch (error: any) {
          if (
            network?.impl === IMPL_EVM &&
            (encodedTx as IEncodedTxEvm).to ===
              batchTransferContractAddress[network?.id]
          ) {
            const gasPrice = await backgroundApiProxy.engine.getGasPrice(
              networkId,
            );

            const blockData = await backgroundApiProxy.engine.proxyJsonRPCCall(
              networkId,
              {
                method: 'eth_getBlockByNumber',
                params: ['latest', false],
              },
            );

            const blockReceipt = blockData as { gasLimit: string };

            currentInfoUnit = {
              eip1559: typeof gasPrice[0] === 'object',
              limit: String(+blockReceipt.gasLimit / 10),
              price: gasPrice[gasPrice.length - 1],
            };
          } else {
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
    },
    [
      feeInfoSelectedInRouteParams,
      network,
      defaultFeePresetIndex,
      fetchAnyway,
      useFeeInTx,
      forBatchSend,
      accountId,
      networkId,
      signOnly,
      getSelectedFeeInfoUnit,
    ],
  );

  useEffect(() => {
    (async function () {
      if (!encodedTxs.length) {
        return null;
      }
      // first time loading only, Interval loading does not support yet.
      setLoading(true);
      try {
        const infos = await Promise.all(
          encodedTxs.map((encodedTx) => fetchFeeInfo(encodedTx)),
        );
        // await delay(600);

        setFeeInfoPayloads(
          infos.includes(null) ? [] : (infos as IFeeInfoPayload[]),
        );
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
        setFeeInfoPayloads([]);
        setFeeInfoError(error);
        debugLogger.sendTx.error('fetchFeeInfo ERROR: ', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [encodedTxs, fetchFeeInfo, setFeeInfoPayloads, toast]);

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
          const infos = await Promise.all(
            encodedTxs.map((encodedTx) => fetchFeeInfo(encodedTx)),
          );
          // await delay(600);
          if (infos) {
            const filterdInfos = infos.includes(null)
              ? []
              : (infos as IFeeInfoPayload[]);
            setFeeInfoPayloads(filterdInfos);
            feeInfoPayloadCacheRef.current = filterdInfos;
          } else if (feeInfoPayloadCacheRef.current) {
            // ** use last cache if error
            setFeeInfoPayloads(feeInfoPayloadCacheRef.current);
            setFeeInfoError(null);
          }
        } catch (error: any) {
          if (feeInfoPayloadCacheRef.current) {
            // ** use last cache if error
            setFeeInfoPayloads(feeInfoPayloadCacheRef.current);
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
  }, [
    feeInfoSelectedInRouteParams?.type,
    fetchFeeInfo,
    loading,
    pollingInterval,
    isFocused,
    encodedTxs,
  ]);

  useEffect(() => {
    let total = 0;
    if (
      feeInfoPayloads.length === decodedTxs.length &&
      feeInfoPayloads.length !== 0
    ) {
      total = 0;
      for (let i = 0; i < feeInfoPayloads.length; i += 1) {
        if (decodedTxs[i].totalFeeInNative) {
          total += new BigNumber(
            decodedTxs[i].totalFeeInNative ?? 0,
          ).toNumber();
        } else {
          total += new BigNumber(
            feeInfoPayloads[i].current?.totalNative ?? 0,
          ).toNumber();
        }
      }
      setTotalFeeInNative(total);
    }
  }, [decodedTxs, feeInfoPayloads]);

  return {
    feeInfoError,
    totalFeeInNative,
    feeInfoPayloads,
    feeInfoLoading: loading,
    getSelectedFeeInfoUnit,
  };
}
