// TODO auto update feeInfo
import { useCallback, useEffect, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIsFocused } from '@react-navigation/native';
import BigNumber from 'bignumber.js';

import { ToastManager } from '@onekeyhq/components';
import type { EIP1559Fee } from '@onekeyhq/engine/src/types/network';
import type {
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
import { useActiveSideAccount } from '../../../hooks';

import { useFeePresetIndex } from './useFeePresetIndex';

export const FEE_INFO_POLLING_INTERVAL = 5000;
// export const FEE_INFO_POLLING_INTERVAL = platformEnv.isDev ? 60 * 1000 : 5000;

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
  transferCount,
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
  transferCount: number;
}) {
  const isFocused = useIsFocused();
  const { network } = useActiveSideAccount({ accountId, networkId });
  const [feeInfoError, setFeeInfoError] = useState<Error | null>(null);
  const [feeInfoPayloads, setFeeInfoPayloads] = useState<IFeeInfoPayload[]>([]);
  const [totalFeeInNative, setTotalFeeInNative] = useState<number>(0);
  const [minTotalFeeInNative, setMinTotalFeeInNative] = useState<number>(0);
  const feeInfoPayloadCacheRef = useRef<IFeeInfoPayload[]>([]);
  const timer = useRef<ReturnType<typeof setInterval>>();
  const [loading, setLoading] = useState(true);
  const route = useRoute();

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
        limit: info.limit,
        ...(info.eip1559
          ? { price1559: priceInfo as EIP1559Fee }
          : { price: priceInfo as string }),
      };
    },
    [],
  );

  const fetchFeeInfo = useCallback(
    async (
      encodedTx: IEncodedTx,
      feeInfoStandard?: IFeeInfoPayload | null,
    ): Promise<IFeeInfoPayload | null> => {
      const DEFAULT_PRESET_INDEX = '1';
      let isUnapprovedBatchTx = false;
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
      let minInfoUnit: IFeeInfoUnit | null = null;
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
            transferCount,
          });
        } catch (error: any) {
          if (
            !network?.settings.nativeSupportBatchTransfer &&
            (await backgroundApiProxy.serviceBatchTransfer.checkIsBatchTransfer(
              {
                networkId,
                encodedTx,
              },
            ))
          ) {
            isUnapprovedBatchTx = true;
            let standardLimit = 0;
            let maxLimit = 0;
            const { prices } = await backgroundApiProxy.engine.getGasInfo(
              networkId,
            );

            const eip1559 = Boolean(
              prices?.length &&
                prices?.every((price) => typeof price === 'object'),
            );

            const price = prices[prices.length - 1];

            if (
              feeInfoStandard?.info.baseFeeValue &&
              new BigNumber(
                feeInfoStandard?.info.limit ?? 0,
              ).isLessThanOrEqualTo(0) &&
              !eip1559
            ) {
              standardLimit = new BigNumber(feeInfoStandard.info.baseFeeValue)
                .dividedBy(price as string)
                .times(transferCount)
                .toNumber();
              maxLimit = standardLimit * 1.5;
            } else {
              const blockData =
                await backgroundApiProxy.engine.proxyJsonRPCCall(networkId, {
                  method: 'eth_getBlockByNumber',
                  params: ['latest', false],
                });

              const blockReceipt = blockData as {
                gasLimit: string;
              };

              maxLimit = +blockReceipt.gasLimit / 10;

              if (feeInfoStandard?.info?.limit) {
                standardLimit = +feeInfoStandard.info.limit * transferCount;
                maxLimit = BigNumber.min(
                  standardLimit * 3,
                  maxLimit,
                ).toNumber();
              }
            }

            currentInfoUnit = {
              eip1559,
              limit: String(maxLimit),
              ...(eip1559
                ? { price1559: price as EIP1559Fee }
                : { price: price as string }),
            };

            minInfoUnit = {
              eip1559,
              limit: String(standardLimit || maxLimit),
              ...(eip1559
                ? { price1559: price as EIP1559Fee }
                : { price: price as string }),
            };
            info.prices = prices;
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
      if (!isUnapprovedBatchTx) {
        if (defaultFeePresetIndex) {
          info.defaultPresetIndex = defaultFeePresetIndex;
        }
        if (parseFloat(info.defaultPresetIndex) > info.prices.length - 1) {
          info.defaultPresetIndex = `${info.prices.length - 1}`;
        }
        if (parseFloat(info.defaultPresetIndex) < 0) {
          info.defaultPresetIndex = '0';
        }
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
      if (
        info &&
        feeInfoSelected.type === 'preset' &&
        feeInfoSelected.preset &&
        !isUnapprovedBatchTx
      ) {
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
      const current: IFeeInfoPayload['current'] = {
        value: currentInfoUnit,
        total,
        totalNative,
      };

      if (isUnapprovedBatchTx && minInfoUnit) {
        const minTotal = calculateTotalFeeRange(minInfoUnit).max;
        const minTotalNative = calculateTotalFeeNative({
          amount: minTotal,
          info,
        });
        current.minTotal = minTotal;
        current.minTotalNative = minTotalNative;
      }

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
      transferCount,
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

      const firstTx = encodedTxs[0];

      // Use the fee of the first transaction as a benchmark
      // To calculate the fee of subsequent batch transaction that may fail
      const firstTxInfo = await fetchFeeInfo(firstTx);
      const restEncodedTxs = encodedTxs.slice(1);

      try {
        const infos = await Promise.all(
          restEncodedTxs.map((encodedTx) =>
            fetchFeeInfo(encodedTx, firstTxInfo),
          ),
        );

        const mergedInfos = [firstTxInfo, ...infos];

        const filterdInfos = mergedInfos.includes(null)
          ? []
          : (mergedInfos as IFeeInfoPayload[]);

        setFeeInfoPayloads(filterdInfos);
        if (filterdInfos.length > 0) {
          setFeeInfoError(null);
        }
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
        setFeeInfoPayloads([]);
        setFeeInfoError(error);
        debugLogger.sendTx.error('fetchFeeInfo ERROR: ', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [decodedTxs, encodedTxs, fetchFeeInfo, setFeeInfoPayloads]);

  useEffect(() => {
    clearInterval(timer.current);
    if (pollingInterval && isFocused) {
      timer.current = setInterval(async () => {
        if (loading) {
          return;
        }
        if (feeInfoSelectedInRouteParams?.type === 'custom') {
          return;
        }
        try {
          const firstTx = encodedTxs[0];

          const firstTxFeeInfo = await fetchFeeInfo(firstTx);
          const restEncodedTxs = encodedTxs.slice(1);

          const infos = await Promise.all(
            restEncodedTxs.map((encodedTx) =>
              fetchFeeInfo(encodedTx, firstTxFeeInfo),
            ),
          );
          // await delay(600);
          if (infos) {
            const mergedInfos = [firstTxFeeInfo, ...infos];

            const filterdInfos = mergedInfos.includes(null)
              ? []
              : (mergedInfos as IFeeInfoPayload[]);

            setFeeInfoPayloads(filterdInfos);
            feeInfoPayloadCacheRef.current = filterdInfos;
            if (filterdInfos.length > 0) {
              setFeeInfoError(null);
            }
          } else if (
            feeInfoPayloadCacheRef.current &&
            feeInfoPayloadCacheRef.current.length > 0
          ) {
            // ** use last cache if error
            setFeeInfoPayloads(feeInfoPayloadCacheRef.current);
            setFeeInfoError(null);
          }
        } catch (error: any) {
          if (
            feeInfoPayloadCacheRef.current &&
            feeInfoPayloadCacheRef.current.length > 0
          ) {
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
      clearInterval(timer.current);
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
    let minTotalNative = 0;
    let totalNative = 0;
    if (
      feeInfoPayloads.length === decodedTxs.length &&
      feeInfoPayloads.length !== 0
    ) {
      for (let i = 0; i < feeInfoPayloads.length; i += 1) {
        if (decodedTxs[i].totalFeeInNative) {
          totalNative += new BigNumber(
            decodedTxs[i].totalFeeInNative ?? 0,
          ).toNumber();
          minTotalNative += new BigNumber(
            decodedTxs[i].totalFeeInNative ?? 0,
          ).toNumber();
        } else {
          totalNative += new BigNumber(
            feeInfoPayloads[i].current?.totalNative ?? 0,
          ).toNumber();
          minTotalNative += new BigNumber(
            feeInfoPayloads[i].current?.minTotalNative ??
              feeInfoPayloads[i].current?.totalNative ??
              0,
          ).toNumber();
        }
      }
      setTotalFeeInNative(totalNative);
      setMinTotalFeeInNative(minTotalNative);
    }
  }, [decodedTxs, feeInfoPayloads]);

  return {
    feeInfoError,
    minTotalFeeInNative,
    totalFeeInNative,
    feeInfoPayloads,
    feeInfoLoading: loading,
    getSelectedFeeInfoUnit,
  };
}
