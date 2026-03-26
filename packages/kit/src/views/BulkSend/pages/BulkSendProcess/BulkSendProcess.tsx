/* eslint-disable no-continue */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { isNil, isUndefined } from 'lodash';
import { type IntlShape, useIntl } from 'react-intl';

import {
  Alert,
  Button,
  Dialog,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
  getCurrentVisibilityState,
  onVisibilityStateChange,
  popModalPages,
  popToTabRootScreen,
  switchTab,
} from '@onekeyhq/components';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useReceiveToken } from '@onekeyhq/kit/src/hooks/useReceiveToken';
import { EResponseCode } from '@onekeyhq/shared/src/consts/requestConsts';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import type {
  IOneKeyError,
  IOneKeyRpcError,
} from '@onekeyhq/shared/src/errors/types/errorTypes';
import { isHardwareInterruptErrorByCode } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  type EModalBulkSendRoutes,
  type IModalBulkSendParamList,
} from '@onekeyhq/shared/src/routes';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { calculateFeeForSend } from '@onekeyhq/shared/src/utils/feeUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  EBulkSendProgressState,
  EBulkSendTxStatus,
  EIntervalMode,
  type IBulkSendTxStatus,
} from '@onekeyhq/shared/types/bulkSend';
import type {
  IEstimateFeeParams,
  IFeeInfoUnit,
  IFeesInfoUnit,
  ISendSelectedFeeInfo,
} from '@onekeyhq/shared/types/fee';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import { useRedirectToBulkSendAddressesInput } from '../../hooks/useRedirectToBulkSendAddressesInput';

import BulkSendProcessItem from './BulkSendProcessItem';

function getConfirmText({
  intl,
  progressState,
}: {
  intl: IntlShape;
  progressState: EBulkSendProgressState;
}) {
  if (progressState === EBulkSendProgressState.Finished) {
    return intl.formatMessage({ id: ETranslations.global_finish });
  }
  return progressState === EBulkSendProgressState.InProgress
    ? intl.formatMessage({ id: ETranslations.global_pause })
    : intl.formatMessage({ id: ETranslations.global_resume });
}

function getIntervalDelay(intervalSettings?: {
  mode: string;
  minSeconds: string;
  maxSeconds: string;
}): number {
  if (!intervalSettings || intervalSettings.mode === EIntervalMode.None) {
    return 0;
  }
  const min = parseFloat(intervalSettings.minSeconds) * 1000;
  const max = parseFloat(intervalSettings.maxSeconds) * 1000;
  if (Number.isNaN(min) || Number.isNaN(max) || max < min) return 0;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function normalizeGasEIP1559Presets(
  presets?: IFeesInfoUnit['gasEIP1559'],
): IFeesInfoUnit['gasEIP1559'] {
  if (!presets) return undefined;
  if (presets.length === 5) {
    return [presets[0], presets[2], presets[4]];
  }
  return presets.length > 3 ? presets.slice(0, 3) : presets;
}

function pickPresetItem<T>(
  presets: T[] | undefined,
  presetIndex: number,
): T | undefined {
  if (!presets?.length) return undefined;
  return presets[presetIndex] ?? presets[presets.length - 1] ?? presets[0];
}

function buildFeeInfoByPreset({
  feesInfo,
  presetIndex,
}: {
  feesInfo: IFeesInfoUnit;
  presetIndex: number;
}): IFeeInfoUnit {
  return {
    common: feesInfo.common,
    gas: pickPresetItem(feesInfo.gas, presetIndex),
    gasEIP1559: pickPresetItem(
      normalizeGasEIP1559Presets(feesInfo.gasEIP1559),
      presetIndex,
    ),
    feeUTXO: pickPresetItem(feesInfo.feeUTXO, presetIndex),
    feeTron: pickPresetItem(feesInfo.feeTron, presetIndex),
    feeSol: pickPresetItem(feesInfo.feeSol, presetIndex),
    feeCkb: pickPresetItem(feesInfo.feeCkb, presetIndex),
    feeAlgo: pickPresetItem(feesInfo.feeAlgo, presetIndex),
    feeDot: pickPresetItem(feesInfo.feeDot, presetIndex),
    feeBudget: pickPresetItem(feesInfo.feeBudget, presetIndex),
    feeNeoN3: pickPresetItem(feesInfo.feeNeoN3, presetIndex),
  };
}

type IBulkSendProcessRouteParams =
  IModalBulkSendParamList[EModalBulkSendRoutes.BulkSendProcess];

function BulkSendProcessContent({
  networkId,
  accountId,
  isInModal,
  isMaxMode,
  feePresetIndex = 1,
  unsignedTxs: initialUnsignedTxs,
  tokenInfo,
  transfersInfo,
  totalTokenAmount,
  totalFiatAmount,
  intervalSettings,
  onSuccess,
  onFail,
}: IBulkSendProcessRouteParams) {
  const intl = useIntl();
  const navigation = useAppNavigation();

  const tokenPrice = useMemo(() => {
    if (!totalTokenAmount || !totalFiatAmount) return undefined;
    const tokenBN = new BigNumber(totalTokenAmount);
    const fiatBN = new BigNumber(totalFiatAmount);
    if (tokenBN.isZero() || tokenBN.isNaN() || fiatBN.isNaN()) return undefined;
    return fiatBN.div(tokenBN).toNumber();
  }, [totalTokenAmount, totalFiatAmount]);

  // Use first sender's accountId for fill-up receive screen
  const firstAccountId = initialUnsignedTxs[0]?.accountId || accountId || '';
  const { handleOnReceive } = useReceiveToken({
    accountId: firstAccountId,
    networkId,
    walletId: accountUtils.getWalletIdFromAccountId({
      accountId: firstAccountId,
    }),
    indexedAccountId: initialUnsignedTxs[0]?.indexedAccountId ?? '',
  });

  const { result: nativeToken } = usePromiseResult(
    async () =>
      backgroundApiProxy.serviceToken.getNativeToken({
        accountId: '',
        networkId,
      }),
    [networkId],
  );

  const handleFillUp = useCallback(() => {
    if (nativeToken) {
      void handleOnReceive({ token: nativeToken });
    }
  }, [handleOnReceive, nativeToken]);

  const [unsignedTxs, setUnsignedTxs] =
    useState<IUnsignedTxPro[]>(initialUnsignedTxs);

  const [transfersInfoState, setTransfersInfoState] = useState(
    transfersInfo ?? [],
  );

  const [txStatusMap, setTxStatusMap] = useState<
    Record<number, IBulkSendTxStatus>
  >({});

  const [progressState, setProgressState] = useState<EBulkSendProgressState>(
    EBulkSendProgressState.InProgress,
  );

  const [currentProcessIndex, setCurrentProcessIndex] = useState(0);

  const isAborted = useRef(false);
  const progressStateRef = useRef(progressState);
  const resultsRef = useRef<ISendTxOnSuccessData[]>([]);

  // Track native balance per sender for native max-send tx updates.
  const networkStatusRef = useRef<
    Record<
      string,
      {
        nativeBalance: string;
      }
    >
  >({});

  // Fee overflow only needs to be checked once (same network for all txs)
  const feeOverflowCheckedRef = useRef(false);

  // Guard against concurrent processing loops (e.g. retry re-triggers usePromiseResult)
  const isProcessingRef = useRef(false);

  // Fee estimation cache — same network/structure, refresh every 30s
  const FEE_CACHE_TTL_MS = 30_000;
  const feeCacheRef = useRef<{
    feeInfo: IFeeInfoUnit;
    estimateFeeParams: IEstimateFeeParams | undefined;
    nativeTokenPrice: number;
    timestamp: number;
  } | null>(null);

  const getCachedFeeContext = useCallback(
    async ({
      txAccountId,
      accountAddress,
      encodedTx,
    }: {
      txAccountId: string;
      accountAddress: string;
      encodedTx: IUnsignedTxPro['encodedTx'];
    }) => {
      const cached = feeCacheRef.current;
      if (cached && Date.now() - cached.timestamp < FEE_CACHE_TTL_MS) {
        return cached;
      }

      const buildResult =
        await backgroundApiProxy.serviceGas.buildEstimateFeeParams({
          accountId: txAccountId,
          networkId,
          encodedTx,
        });

      const resp = await backgroundApiProxy.serviceGas.estimateFee({
        accountId: txAccountId,
        networkId,
        encodedTx: buildResult.encodedTx,
        accountAddress,
      });

      const feesInfo: IFeesInfoUnit = {
        common: {
          baseFee: resp.common.baseFee,
          feeDecimals: resp.common.feeDecimals,
          feeSymbol: resp.common.feeSymbol,
          nativeDecimals: resp.common.nativeDecimals,
          nativeSymbol: resp.common.nativeSymbol,
          nativeTokenPrice: resp.common.nativeTokenPrice,
        },
        gas: resp.gas,
        gasEIP1559: normalizeGasEIP1559Presets(resp.gasEIP1559),
        feeUTXO: resp.feeUTXO,
        feeTron: resp.feeTron,
        feeSol: resp.feeSol,
        feeCkb: resp.feeCkb,
        feeAlgo: resp.feeAlgo,
        feeDot: resp.feeDot,
        feeBudget: resp.feeBudget,
        feeNeoN3: resp.feeNeoN3,
      };

      const nextFeeContext = {
        feeInfo: buildFeeInfoByPreset({
          feesInfo,
          presetIndex: feePresetIndex,
        }),
        estimateFeeParams: buildResult.estimateFeeParams,
        nativeTokenPrice: resp.common.nativeTokenPrice ?? 0,
        timestamp: Date.now(),
      };

      feeCacheRef.current = nextFeeContext;
      // Reset fee overflow check when fee is re-fetched
      feeOverflowCheckedRef.current = false;
      return nextFeeContext;
    },
    [feePresetIndex, networkId],
  );

  const waitUntilInProgress: () => Promise<boolean> = useCallback(async () => {
    if (
      progressStateRef.current === EBulkSendProgressState.InProgress ||
      isAborted.current
    )
      return Promise.resolve(true);
    await timerUtils.wait(1000);
    return waitUntilInProgress();
  }, []);

  const { succeededTxCount, failedTxCount, skippedTxCount } = useMemo(() => {
    let _succeeded = 0;
    let _failed = 0;
    let _skipped = 0;
    Object.values(txStatusMap).forEach((s) => {
      if (s.status === EBulkSendTxStatus.Succeeded) _succeeded += 1;
      else if (s.status === EBulkSendTxStatus.Failed) _failed += 1;
      else if (s.status === EBulkSendTxStatus.Skipped) _skipped += 1;
    });
    return {
      succeededTxCount: _succeeded,
      failedTxCount: _failed,
      skippedTxCount: _skipped,
    };
  }, [txStatusMap]);

  const navigateAfterDone = useCallback(async () => {
    if (accountUtils.isQrAccount({ accountId: accountId ?? '' })) {
      navigation.popStack();
      return;
    }
    if (isInModal) {
      navigation.popStack();
    } else {
      await popModalPages();
      switchTab(ETabRoutes.Home);
      await timerUtils.wait(50);
      await popToTabRootScreen();
    }
  }, [isInModal, navigation, accountId]);

  // Main processing loop
  usePromiseResult(async () => {
    // Prevent concurrent loop execution on retry re-trigger
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    try {
      for (let i = 0; i < unsignedTxs.length; i += 1) {
        const tx = unsignedTxs[i];
        setCurrentProcessIndex(i);

        if (isAborted.current) break;
        await waitUntilInProgress();

        const txAccountId = tx.accountId || accountId || '';

        // Interval delay (skip first tx)
        if (i > 0) {
          const delay = getIntervalDelay(intervalSettings);
          if (delay > 0) {
            setTxStatusMap((prev) => ({
              ...prev,
              [i]: { status: EBulkSendTxStatus.Processing },
            }));
            // Wait in chunks so we can check abort/pause
            const chunkSize = 1000;
            let waited = 0;
            while (waited < delay) {
              if (isAborted.current) break;
              await waitUntilInProgress();
              const waitTime = Math.min(chunkSize, delay - waited);
              await timerUtils.wait(waitTime);
              waited += waitTime;
            }
          }
        }

        if (isAborted.current) break;
        await waitUntilInProgress();

        try {
          // Fetch native balance for this sender (if not cached)
          let accountAddress = '';
          try {
            accountAddress =
              await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
                networkId,
                accountId: txAccountId,
              });
          } catch {
            // fallback
          }

          const balanceKey = `${networkId}:${accountAddress}`;

          if (isNil(networkStatusRef.current[balanceKey]?.nativeBalance)) {
            try {
              const nativeTokenAddress =
                await backgroundApiProxy.serviceToken.getNativeTokenAddress({
                  networkId,
                });
              const resp =
                await backgroundApiProxy.serviceToken.fetchTokensDetails({
                  accountId: txAccountId,
                  networkId,
                  contractList: [nativeTokenAddress],
                });
              if (resp?.[0] && !isNil(resp[0].balanceParsed)) {
                networkStatusRef.current[balanceKey] = {
                  ...networkStatusRef.current[balanceKey],
                  nativeBalance: resp[0].balanceParsed,
                };
              }
            } catch (error) {
              console.error('fetchAccountNativeBalance error', error);
            }
          }

          if (isAborted.current) break;
          await waitUntilInProgress();

          // Set processing status
          setTxStatusMap((prev) => ({
            ...prev,
            [i]: { status: EBulkSendTxStatus.Processing },
          }));

          // Rebuild tx with current chain state before sending.
          // This fixes stale instructions (e.g. Solana ATA creation that
          // was already handled by a previous tx in this batch).
          let updatedTx = tx;
          if (transfersInfoState[i]) {
            try {
              const rebuiltTx =
                await backgroundApiProxy.serviceSend.prepareSendConfirmUnsignedTx(
                  {
                    networkId,
                    accountId: txAccountId,
                    transfersInfo: [transfersInfoState[i]],
                  },
                );
              updatedTx = {
                ...rebuiltTx,
                accountId: tx.accountId,
                indexedAccountId: tx.indexedAccountId,
              };
            } catch {
              // Keep pre-built tx on rebuild failure
            }
          }

          if (isAborted.current) break;
          await waitUntilInProgress();

          // Estimate fees using the rebuilt tx for accuracy
          const feeContext = await getCachedFeeContext({
            txAccountId,
            accountAddress,
            encodedTx: updatedTx.encodedTx,
          });
          const { feeInfo, estimateFeeParams, nativeTokenPrice } = feeContext;

          const feeResult = calculateFeeForSend({
            feeInfo,
            nativeTokenPrice,
            txSize: updatedTx.txSize,
            estimateFeeParams,
          });

          if (isAborted.current) break;
          await waitUntilInProgress();

          // Native token + max mode: update the tx with the latest max amount.
          let updatedMaxSendAmount: string | undefined;
          if (isMaxMode && tokenInfo?.isNative) {
            const network = await backgroundApiProxy.serviceNetwork.getNetwork({
              networkId,
            });
            const currentBalance =
              networkStatusRef.current[balanceKey]?.nativeBalance ??
              transfersInfoState[i]?.amount ??
              tx.transfersInfo?.[0]?.amount ??
              '0';
            if (isNil(networkStatusRef.current[balanceKey]?.nativeBalance)) {
              networkStatusRef.current[balanceKey] = {
                nativeBalance: currentBalance,
              };
            }
            const feeWithRatio = new BigNumber(feeResult.totalNative).times(
              network.feeMeta?.maxSendFeeUpRatio ?? 1,
            );
            const maxSendAmount = new BigNumber(currentBalance).minus(
              feeWithRatio,
            );
            const nextMaxSendAmount = maxSendAmount.toFixed();

            if (maxSendAmount.lte(0)) {
              setTxStatusMap((prev) => ({
                ...prev,
                [i]: {
                  isInsufficientFunds: true,
                  status: EBulkSendTxStatus.Failed,
                  errorMessage: `Insufficient balance for send amount and fees`,
                },
              }));
              continue;
            }

            const finalMaxSendAmount = nextMaxSendAmount;
            updatedMaxSendAmount = finalMaxSendAmount;
            updatedTx = await backgroundApiProxy.serviceSend.updateUnsignedTx({
              networkId,
              accountId: txAccountId,
              unsignedTx: updatedTx,
              feeInfo,
              nativeAmountInfo: { maxSendAmount: finalMaxSendAmount },
            });
            setTransfersInfoState((prev) =>
              prev.map((item, index) =>
                index === i && item.amount !== finalMaxSendAmount
                  ? { ...item, amount: finalMaxSendAmount }
                  : item,
              ),
            );
          }

          // Fee overflow check — only once (same network for all txs)
          if (!feeOverflowCheckedRef.current) {
            const isFeeInfoOverflow =
              await backgroundApiProxy.serviceSend.preCheckIsFeeInfoOverflow({
                encodedTx: updatedTx.encodedTx,
                feeAmount: feeResult.totalNative,
                feeTokenSymbol: feeInfo.common.nativeSymbol,
                networkId,
                accountAddress,
              });

            feeOverflowCheckedRef.current = true;

            if (isAborted.current) break;
            await waitUntilInProgress();

            if (isFeeInfoOverflow) {
              // Fee is abnormally high — abort all remaining txs
              for (let j = i; j < unsignedTxs.length; j += 1) {
                // oxlint-disable-next-line no-loop-func
                setTxStatusMap((prev) => ({
                  ...prev,
                  [j]: {
                    status: EBulkSendTxStatus.Skipped,
                    errorMessage: 'Excessive gas fee detected',
                  },
                }));
              }
              break;
            }
          }

          // Nonce management
          if (isUndefined(updatedTx.nonce)) {
            const nonce = await backgroundApiProxy.serviceSend.getNextNonce({
              accountId: txAccountId,
              networkId,
              accountAddress,
            });
            updatedTx = await backgroundApiProxy.serviceSend.updateUnsignedTx({
              networkId,
              accountId: txAccountId,
              unsignedTx: updatedTx,
              nonceInfo: { nonce },
              feeInfo,
            });
          }

          if (isAborted.current) break;
          await waitUntilInProgress();

          // Build fee info for signing
          const sendSelectedFeeInfo: ISendSelectedFeeInfo = {
            feeInfo,
            total: feeResult.total,
            totalNative: feeResult.totalNative,
            totalFiat: feeResult.totalFiat,
            totalNativeForDisplay: feeResult.totalNativeForDisplay,
            totalFiatForDisplay: feeResult.totalFiatForDisplay,
          };

          // Sign and send
          const result =
            await backgroundApiProxy.serviceSend.batchSignAndSendTransaction({
              accountId: txAccountId,
              networkId,
              unsignedTxs: [updatedTx],
              feeInfos: [sendSelectedFeeInfo],
              transferPayload: undefined,
            });

          // Deduct fee from tracked balance
          if (!isNil(networkStatusRef.current[balanceKey]?.nativeBalance)) {
            let deduction = new BigNumber(
              feeResult.totalNativeForDisplay ?? feeResult.totalNative,
            );
            if (updatedMaxSendAmount) {
              deduction = deduction.plus(updatedMaxSendAmount);
            }
            networkStatusRef.current[balanceKey].nativeBalance = new BigNumber(
              networkStatusRef.current[balanceKey]?.nativeBalance,
            )
              .minus(deduction)
              .toFixed();
          }

          if (isAborted.current) break;
          await waitUntilInProgress();

          // Record success
          resultsRef.current.push({
            signedTx: result[0].signedTx,
          } as ISendTxOnSuccessData);

          setTxStatusMap((prev) => ({
            ...prev,
            [i]: {
              status: EBulkSendTxStatus.Succeeded,
              txId: result[0].signedTx.txid,
              feeNative: feeResult.totalNativeForDisplay,
              feeSymbol: feeInfo.common.nativeSymbol,
              feeFiat: feeResult.totalFiatForDisplay,
            },
          }));
        } catch (error: unknown) {
          let passphraseEnabled;
          let deviceCommunicationError;

          // Hardware interrupt error
          if (
            isHardwareInterruptErrorByCode({
              error: error as IOneKeyError,
            })
          ) {
            i -= 1;
            deviceCommunicationError = true;
            setProgressState(EBulkSendProgressState.Paused);
            progressStateRef.current = EBulkSendProgressState.Paused;
            setTxStatusMap((prev) => ({
              ...prev,
              [i + 1]: { status: EBulkSendTxStatus.Paused },
            }));
          }

          // Passphrase not opened
          else if (
            errorUtils.isErrorByClassName({
              error,
              className: EOneKeyErrorClassNames.DeviceNotOpenedPassphrase,
            })
          ) {
            const p = (error as IOneKeyError).payload as
              | { connectId: string; deviceId: string }
              | undefined;
            passphraseEnabled = await new Promise((resolve) => {
              Dialog.show({
                title: intl.formatMessage({
                  id: ETranslations.passphrase_disabled_dialog_title,
                }),
                description: intl.formatMessage({
                  id: ETranslations.passphrase_disabled_dialog_desc,
                }),
                onConfirmText: intl.formatMessage({
                  id: ETranslations.global_enable,
                }),
                onCancel: (close) => {
                  void close();
                  resolve(false);
                },
                onConfirm: async () => {
                  try {
                    await backgroundApiProxy.serviceHardware.setPassphraseEnabled(
                      {
                        walletId: '',
                        connectId: p?.connectId,
                        featuresDeviceId: p?.deviceId,
                        passphraseEnabled: true,
                      },
                    );
                    resolve(true);
                    i -= 1;
                  } catch {
                    resolve(false);
                  }
                },
              });
            });
          }

          if (!passphraseEnabled && !deviceCommunicationError) {
            // oxlint-disable-next-line no-loop-func
            setTxStatusMap((prev) => ({
              ...prev,
              [i]: {
                isInsufficientFunds:
                  (error as { code: number }).code ===
                  EResponseCode.insufficient_funds_for_tx_fee,
                status: EBulkSendTxStatus.Failed,
                errorMessage:
                  (error as { data: { data: IOneKeyRpcError } }).data?.data?.res
                    ?.error?.message ??
                  (error as Error).message ??
                  String(error),
              },
            }));
          }
        }
      }

      // Skip callbacks and finished state if user aborted
      if (isAborted.current) {
        return;
      }

      setProgressState(EBulkSendProgressState.Finished);

      // Call callbacks
      const results = resultsRef.current;
      if (results.length > 0) {
        onSuccess?.(results);
      } else {
        onFail?.(new Error(`All ${unsignedTxs.length} transactions failed`));
      }
    } finally {
      isProcessingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getCachedFeeContext, unsignedTxs, waitUntilInProgress, intl]);

  // Sync progressStateRef
  useEffect(() => {
    progressStateRef.current = progressState;
  }, [progressState]);

  // Auto-pause when app loses focus
  useEffect(() => {
    const handleVisibilityStateChange = (visible: boolean) => {
      if (
        visible === false &&
        progressState === EBulkSendProgressState.InProgress
      ) {
        setProgressState(EBulkSendProgressState.Paused);
        setTxStatusMap((prev) => ({
          ...prev,
          [currentProcessIndex]: {
            ...prev[currentProcessIndex],
            status: EBulkSendTxStatus.Paused,
          },
        }));
      }
    };
    handleVisibilityStateChange(getCurrentVisibilityState());
    const removeSubscription = onVisibilityStateChange(
      handleVisibilityStateChange,
    );
    return removeSubscription;
  }, [currentProcessIndex, progressState]);

  const handleOnConfirm = useCallback(() => {
    if (progressState === EBulkSendProgressState.Finished) {
      void navigateAfterDone();
      return;
    }
    if (progressState === EBulkSendProgressState.InProgress) {
      setProgressState(EBulkSendProgressState.Paused);
      setTxStatusMap((prev) => ({
        ...prev,
        [currentProcessIndex]: {
          ...prev[currentProcessIndex],
          status: EBulkSendTxStatus.Paused,
        },
      }));
    } else {
      setProgressState(EBulkSendProgressState.InProgress);
      setTxStatusMap((prev) => ({
        ...prev,
        [currentProcessIndex]: {
          ...prev[currentProcessIndex],
          status: EBulkSendTxStatus.Processing,
        },
      }));
    }
  }, [progressState, currentProcessIndex, navigateAfterDone]);

  const handleOnCancel = useCallback(() => {
    if (
      progressState === EBulkSendProgressState.Finished &&
      (failedTxCount > 0 || skippedTxCount > 0)
    ) {
      // Retry: filter out succeeded txs, reset and restart
      networkStatusRef.current = {};
      const failedIndices = new Set<number>();
      Object.entries(txStatusMap).forEach(([idx, s]) => {
        if (s.status !== EBulkSendTxStatus.Succeeded) {
          failedIndices.add(Number(idx));
        }
      });
      setTxStatusMap({});
      feeOverflowCheckedRef.current = false;
      feeCacheRef.current = null;
      // Preserve original successful results so onSuccess receives all successes
      // resultsRef.current is NOT cleared here — retry appends new successes
      // Reset processing guard and progress index before updating unsignedTxs to allow the new loop
      isProcessingRef.current = false;
      setCurrentProcessIndex(0);
      setUnsignedTxs((prev) => prev.filter((_, idx) => failedIndices.has(idx)));
      setTransfersInfoState((prev) =>
        prev.filter((_, idx) => failedIndices.has(idx)),
      );
      setProgressState(EBulkSendProgressState.InProgress);
      return;
    }

    // Abort
    isAborted.current = true;
    setProgressState(EBulkSendProgressState.Aborted);
    navigation.popStack();
  }, [progressState, failedTxCount, skippedTxCount, txStatusMap, navigation]);

  return (
    <Page
      scrollEnabled
      onClose={() => {
        if (progressState !== EBulkSendProgressState.Finished) {
          isAborted.current = true;
          setProgressState(EBulkSendProgressState.Aborted);
        }
      }}
    >
      <Page.Header
        headerTitle={intl.formatMessage({
          id: ETranslations.wallet_bulk_send_title,
        })}
      />
      <Page.Body>
        <Stack pb="$2" px="$5">
          <Alert
            icon="InfoCircleOutline"
            title="Please keep the page active. Exiting will pause the process."
            type="warning"
          />
        </Stack>
        <Stack flex={1} pb="$5">
          {unsignedTxs.map((tx, index) => {
            const transfer = transfersInfoState?.[index];
            if (!transfer) return null;
            const status = txStatusMap[index] ?? {
              status: EBulkSendTxStatus.Pending,
            };
            return (
              <BulkSendProcessItem
                key={`${index}-${tx.uuid ?? ''}`}
                transferInfo={transfer}
                tokenInfo={tokenInfo}
                status={status}
                networkId={networkId}
                tokenPrice={tokenPrice}
                onFillUp={handleFillUp}
              />
            );
          })}
        </Stack>
      </Page.Body>
      <Page.Footer>
        <Page.FooterActions
          onConfirm={handleOnConfirm}
          onConfirmText={getConfirmText({ intl, progressState })}
          cancelButton={
            progressState === EBulkSendProgressState.Finished &&
            failedTxCount === 0 &&
            skippedTxCount === 0 ? undefined : (
              <Button
                $md={
                  {
                    flexGrow: 1,
                    flexBasis: 0,
                    size: 'large',
                  } as any
                }
                onPress={handleOnCancel}
              >
                {progressState === EBulkSendProgressState.Finished &&
                (failedTxCount !== 0 || skippedTxCount !== 0)
                  ? `${intl.formatMessage({
                      id: ETranslations.global_retry,
                    })} (${failedTxCount + skippedTxCount})`
                  : intl.formatMessage({
                      id: ETranslations.global_cancel,
                    })}
              </Button>
            )
          }
        >
          <YStack
            gap="$1"
            $md={{
              width: '100%',
              pb: '$2.5',
            }}
          >
            <XStack
              alignItems="center"
              gap="$2"
              $md={{
                justifyContent: 'space-between',
              }}
            >
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({ id: ETranslations.global_process })}
              </SizableText>
              <SizableText size="$bodyMdMedium">
                {`${currentProcessIndex + 1}/${unsignedTxs.length} (${succeededTxCount} ${intl.formatMessage(
                  {
                    id: ETranslations.global_success,
                  },
                )}, ${failedTxCount} ${intl.formatMessage({
                  id: ETranslations.wallet_approval_bulk_revoke_status_failed,
                })})`}
              </SizableText>
            </XStack>
          </YStack>
        </Page.FooterActions>
      </Page.Footer>
    </Page>
  );
}

function BulkSendProcess() {
  const route = useAppRoute<
    IModalBulkSendParamList,
    EModalBulkSendRoutes.BulkSendProcess
  >();

  const params = route.params;
  const hasRequiredParams = Boolean(
    params?.networkId &&
    params?.tokenInfo &&
    params?.bulkSendMode &&
    params?.transfersInfo?.length &&
    params?.unsignedTxs?.length &&
    params?.totalTokenAmount !== undefined &&
    params?.totalFiatAmount !== undefined,
  );

  useRedirectToBulkSendAddressesInput({
    networkId: params?.networkId,
    accountId: params?.accountId,
    tokenInfo: params?.tokenInfo,
    isInModal: params?.isInModal,
    bulkSendMode: params?.bulkSendMode,
    hasRequiredParams,
  });

  if (!hasRequiredParams || !params) {
    return null;
  }

  return <BulkSendProcessContent {...params} />;
}

export default BulkSendProcess;
