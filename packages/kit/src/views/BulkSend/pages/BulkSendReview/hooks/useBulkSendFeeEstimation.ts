import { useCallback, useEffect, useMemo, useRef } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import {
  calculateFeeForSend,
  getFeeIcon,
  getFeeLabel,
} from '@onekeyhq/shared/src/utils/feeUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  EFeeType,
  ESendFeeStatus,
  type IEstimateFeeParams,
  type IFeeInfoUnit,
  type IFeeSelectorItem,
  type IFeesInfoUnit,
  type IGasEIP1559,
  type IGasLegacy,
  type ISendSelectedFeeInfo,
} from '@onekeyhq/shared/types/fee';

import type { IBulkSendFeeState } from '../components/Context';

type IUseBulkSendFeeEstimationParams = {
  networkId: string;
  accountId: string | undefined;
  unsignedTxs: IUnsignedTxPro[];
  feeState: IBulkSendFeeState;
  setFeeState: React.Dispatch<React.SetStateAction<IBulkSendFeeState>>;
};

// Scale gasLimit for bulk transfer txs when batch estimation is not available.
// For transfer txs (non-approve), multiply gasLimit by (transfersInfo.length + 1)
// to account for the higher gas consumption of multi-call contracts.
function scaleGasLimitForBulkTransfer(
  feeInfo: IFeeInfoUnit,
  multiplier: number,
): IFeeInfoUnit {
  if (multiplier <= 1) return feeInfo;

  const scaled = { ...feeInfo };
  if (scaled.gas) {
    const newGasLimit = new BigNumber(scaled.gas.gasLimit)
      .times(multiplier)
      .toFixed(0);
    scaled.gas = {
      ...scaled.gas,
      gasLimit: newGasLimit,
      gasLimitForDisplay: newGasLimit,
    };
  }
  if (scaled.gasEIP1559) {
    const newGasLimit = new BigNumber(scaled.gasEIP1559.gasLimit)
      .times(multiplier)
      .toFixed(0);
    scaled.gasEIP1559 = {
      ...scaled.gasEIP1559,
      gasLimit: newGasLimit,
      gasLimitForDisplay: newGasLimit,
    };
  }

  return scaled;
}

export function useBulkSendFeeEstimation({
  networkId,
  accountId,
  unsignedTxs,
  feeState,
  setFeeState,
}: IUseBulkSendFeeEstimationParams) {
  const intl = useIntl();
  const isEstimating = useRef(false);

  // Get vault settings for polling interval
  const { result: vaultSettings } = usePromiseResult(
    async () =>
      backgroundApiProxy.serviceNetwork.getVaultSettings({ networkId }),
    [networkId],
  );

  // Estimate fee function
  // forceLoading: true for initial load or tx update, false for polling
  const estimateFee = useCallback(
    async (options?: { forceLoading?: boolean }) => {
      const { forceLoading = false } = options ?? {};

      if (!unsignedTxs || unsignedTxs.length === 0 || !accountId) {
        return null;
      }

      if (isEstimating.current) {
        return null;
      }

      try {
        isEstimating.current = true;
        await backgroundApiProxy.serviceGas.abortEstimateFee();

        // Only show loading state for initial load or forced refresh
        // For polling updates, keep the current state to avoid UI flicker
        if (forceLoading || !feeState.isInitialized) {
          setFeeState((prev) => ({
            ...prev,
            feeStatus: ESendFeeStatus.Loading,
            errMessage: '',
          }));
        }

        const isMultiTxs = unsignedTxs.length > 1;

        let txFee: IFeesInfoUnit | undefined;
        let estimateFeeParams: IEstimateFeeParams | undefined;
        // Store per-tx fee info for batch estimation
        let perTxFeeInfos:
          | { gas?: IGasLegacy[]; gasEIP1559?: IGasEIP1559[] }[]
          | undefined;

        // Try batch estimate for multi-txs
        if (isMultiTxs) {
          const vs = await backgroundApiProxy.serviceNetwork.getVaultSettings({
            networkId,
          });
          if (vs?.supportBatchEstimateFee?.[networkId]) {
            try {
              const encodedTxList = unsignedTxs.map((tx) => tx.encodedTx);
              const multiTxsFeeResult =
                await backgroundApiProxy.serviceGas.batchEstimateFee({
                  accountId,
                  networkId,
                  encodedTxs: encodedTxList,
                });
              // Use first tx's fee for fee selector display (all txs share same gas price)
              txFee = {
                common: multiTxsFeeResult.common,
                gas: multiTxsFeeResult.txFees[0]?.gas,
                gasEIP1559: multiTxsFeeResult.txFees[0]?.gasEIP1559,
              };
              // Store per-tx gas info for accurate fee calculation
              perTxFeeInfos = multiTxsFeeResult.txFees.map((tf) => ({
                gas: tf.gas,
                gasEIP1559: tf.gasEIP1559,
              }));
            } catch (e) {
              console.error('Batch estimate fee failed, fallback to single', e);
            }
          }
        }

        // Fallback to single tx estimate
        if (!txFee) {
          const accountAddress =
            await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
              networkId,
              accountId,
            });

          const { encodedTx, estimateFeeParams: e } =
            await backgroundApiProxy.serviceGas.buildEstimateFeeParams({
              accountId,
              networkId,
              encodedTx: unsignedTxs[0].encodedTx,
            });

          estimateFeeParams = e;

          const r = await backgroundApiProxy.serviceGas.estimateFee({
            accountId,
            networkId,
            encodedTx,
            accountAddress,
            transfersInfo: unsignedTxs[0].transfersInfo,
          });

          // Handle 5-level EIP1559 fees
          if (r.gasEIP1559 && r.gasEIP1559.length === 5) {
            r.gasEIP1559 = [r.gasEIP1559[0], r.gasEIP1559[2], r.gasEIP1559[4]];
          } else if (r.gasEIP1559) {
            r.gasEIP1559 = r.gasEIP1559.slice(0, 3);
          }

          txFee = r;
        }

        if (!txFee) {
          throw new OneKeyInternalError('Failed to estimate fee');
        }

        // Build fee selector items (only standard presets, no custom)
        const feeSelectorItems: IFeeSelectorItem[] = [];
        const feeLength =
          txFee.gasEIP1559?.length ||
          txFee.gas?.length ||
          txFee.feeUTXO?.length ||
          txFee.feeTron?.length ||
          txFee.feeSol?.length ||
          txFee.feeCkb?.length ||
          txFee.feeAlgo?.length ||
          txFee.feeDot?.length ||
          txFee.feeBudget?.length ||
          txFee.feeNeoN3?.length ||
          0;

        const isSinglePreset = feeLength === 1;

        for (let i = 0; i < feeLength; i += 1) {
          const feeInfo: IFeeInfoUnit = {
            common: txFee.common,
            gas: txFee.gas?.[i],
            gasEIP1559: txFee.gasEIP1559?.[i],
            feeUTXO: txFee.feeUTXO?.[i],
            feeTron: txFee.feeTron?.[i],
            feeSol: txFee.feeSol?.[i],
            feeCkb: txFee.feeCkb?.[i],
            feeAlgo: txFee.feeAlgo?.[i],
            feeDot: txFee.feeDot?.[i],
            feeBudget: txFee.feeBudget?.[i],
            feeNeoN3: txFee.feeNeoN3?.[i],
          };

          feeSelectorItems.push({
            label: intl.formatMessage({
              id: getFeeLabel({
                feeType: EFeeType.Standard,
                presetIndex: i,
                isSinglePreset,
              }),
            }),
            icon: getFeeIcon({
              feeType: EFeeType.Standard,
              presetIndex: i,
              isSinglePreset,
            }),
            value: i,
            feeInfo,
            type: EFeeType.Standard,
          });
        }

        // Calculate total fee for all transactions
        const selectedPresetIndex = Math.min(
          feeState.selectedFee.presetIndex,
          feeSelectorItems.length - 1,
        );
        const selectedFeeInfo = feeSelectorItems[selectedPresetIndex]?.feeInfo;

        if (!selectedFeeInfo) {
          throw new OneKeyInternalError('No fee info available');
        }

        // Calculate fees for each transaction
        const feeInfos: ISendSelectedFeeInfo[] = [];
        let totalNative = new BigNumber(0);
        let totalFiat = new BigNumber(0);

        for (let i = 0; i < unsignedTxs.length; i += 1) {
          const unsignedTx = unsignedTxs[i];
          // Use per-tx fee info if available (from batch estimation)
          // Otherwise use the shared selectedFeeInfo
          let txFeeInfo = selectedFeeInfo;
          if (perTxFeeInfos && perTxFeeInfos[i]) {
            const perTxFee = perTxFeeInfos[i];
            txFeeInfo = {
              ...selectedFeeInfo,
              gas: perTxFee.gas?.[selectedPresetIndex],
              gasEIP1559: perTxFee.gasEIP1559?.[selectedPresetIndex],
            };
          } else if (isMultiTxs && !unsignedTx.approveInfo) {
            // Fallback mode: scale gasLimit for transfer txs
            // Gas scales with the number of transfers in this tx, not the number of txs
            const transferCount = unsignedTx.transfersInfo?.length ?? 1;
            txFeeInfo = scaleGasLimitForBulkTransfer(
              txFeeInfo,
              transferCount + 1,
            );
          }
          const feeResult = calculateFeeForSend({
            feeInfo: txFeeInfo,
            nativeTokenPrice: txFee.common?.nativeTokenPrice ?? 0,
            txSize: unsignedTx.txSize,
            estimateFeeParams,
          });

          totalNative = totalNative.plus(feeResult.totalNative);
          totalFiat = totalFiat.plus(feeResult.totalFiat);
          feeInfos.push({
            feeInfo: txFeeInfo,
            total: feeResult.total,
            totalNative: feeResult.totalNative,
            totalFiat: feeResult.totalFiat,
            totalNativeForDisplay: feeResult.totalNativeForDisplay,
            totalFiatForDisplay: feeResult.totalFiatForDisplay,
          });
        }

        setFeeState((prev) => ({
          ...prev,
          feeStatus: ESendFeeStatus.Success,
          errMessage: '',
          isInitialized: true,
          feeSelectorItems,
          selectedFee: {
            feeType: EFeeType.Standard,
            presetIndex: selectedPresetIndex,
          },
          totalFeeNative: totalNative.toFixed(),
          totalFeeFiat: totalFiat.toFixed(),
          nativeSymbol: txFee.common?.nativeSymbol ?? '',
          feeInfos,
          perTxFeeInfos,
        }));

        return {
          feeSelectorItems,
          estimateFeeParams,
        };
      } catch (e) {
        const errMessage =
          (
            e as {
              data?: { data?: { res?: { error?: { message?: string } } } };
            }
          )?.data?.data?.res?.error?.message ??
          (e as Error).message ??
          'Failed to estimate fee';
        console.error('Fee estimation error:', e);

        // For polling errors when already initialized, don't show error state
        // Just keep the current fee data
        if (!forceLoading && feeState.isInitialized) {
          // Silently fail for polling updates
          return null;
        }

        setFeeState((prev) => ({
          ...prev,
          feeStatus: ESendFeeStatus.Error,
          errMessage,
        }));
        return null;
      } finally {
        isEstimating.current = false;
      }
    },
    [
      accountId,
      feeState.isInitialized,
      feeState.selectedFee.presetIndex,
      intl,
      networkId,
      setFeeState,
      unsignedTxs,
    ],
  );

  // Initial fee estimation (with loading state)
  useEffect(() => {
    void estimateFee({ forceLoading: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Polling for fee updates (silent, no loading state)
  useEffect(() => {
    if (!vaultSettings?.estimatedFeePollingInterval) {
      return;
    }

    const pollingInterval = timerUtils.getTimeDurationMs({
      seconds: vaultSettings.estimatedFeePollingInterval,
    });

    const intervalId = setInterval(() => {
      // Polling updates are silent (no loading state)
      void estimateFee({ forceLoading: false });
    }, pollingInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [estimateFee, vaultSettings?.estimatedFeePollingInterval]);

  // Handle fee level change
  const handleFeeChange = useCallback(
    (presetIndex: number) => {
      const selectedFeeInfo = feeState.feeSelectorItems[presetIndex]?.feeInfo;
      if (!selectedFeeInfo) return;

      const { perTxFeeInfos } = feeState;

      // Recalculate total fee
      let totalNative = new BigNumber(0);
      let totalFiat = new BigNumber(0);
      const feeInfos: ISendSelectedFeeInfo[] = [];

      const isMultiTxs = unsignedTxs.length > 1;

      for (let i = 0; i < unsignedTxs.length; i += 1) {
        const unsignedTx = unsignedTxs[i];
        // Use per-tx fee info if available (from batch estimation)
        let txFeeInfo = selectedFeeInfo;
        if (perTxFeeInfos && perTxFeeInfos[i]) {
          const perTxFee = perTxFeeInfos[i];
          txFeeInfo = {
            ...selectedFeeInfo,
            gas: perTxFee.gas?.[presetIndex],
            gasEIP1559: perTxFee.gasEIP1559?.[presetIndex],
          };
        } else if (isMultiTxs && !unsignedTx.approveInfo) {
          // Fallback mode: scale gasLimit for transfer txs
          // Gas scales with the number of transfers in this tx, not the number of txs
          const transferCount = unsignedTx.transfersInfo?.length ?? 1;
          txFeeInfo = scaleGasLimitForBulkTransfer(
            txFeeInfo,
            transferCount + 1,
          );
        }
        const feeResult = calculateFeeForSend({
          feeInfo: txFeeInfo,
          nativeTokenPrice: selectedFeeInfo.common?.nativeTokenPrice ?? 0,
          txSize: unsignedTx.txSize,
        });

        totalNative = totalNative.plus(feeResult.totalNative);
        totalFiat = totalFiat.plus(feeResult.totalFiat);
        feeInfos.push({
          feeInfo: txFeeInfo,
          total: feeResult.total,
          totalNative: feeResult.totalNative,
          totalFiat: feeResult.totalFiat,
          totalNativeForDisplay: feeResult.totalNativeForDisplay,
          totalFiatForDisplay: feeResult.totalFiatForDisplay,
        });
      }

      setFeeState((prev) => ({
        ...prev,
        selectedFee: {
          feeType: EFeeType.Standard,
          presetIndex,
        },
        totalFeeNative: totalNative.toFixed(),
        totalFeeFiat: totalFiat.toFixed(),
        feeInfos,
      }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      feeState.feeSelectorItems,
      feeState.perTxFeeInfos,
      setFeeState,
      unsignedTxs,
    ],
  );

  // Force refresh fee (for tx updates)
  const forceRefreshFee = useCallback(() => {
    void estimateFee({ forceLoading: true });
  }, [estimateFee]);

  // Get fee label for display
  const feeLabel = useMemo(() => {
    const item = feeState.feeSelectorItems[feeState.selectedFee.presetIndex];
    return item?.label ?? '';
  }, [feeState.feeSelectorItems, feeState.selectedFee.presetIndex]);

  return {
    feeState,
    feeLabel,
    handleFeeChange,
    estimateFee,
    forceRefreshFee,
    vaultSettings,
  };
}
