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
  ETabRoutes,
  type IModalBulkSendParamList,
} from '@onekeyhq/shared/src/routes';
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
  IFeeInfoUnit,
  ISendSelectedFeeInfo,
} from '@onekeyhq/shared/types/fee';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useReceiveToken } from '@onekeyhq/kit/src/hooks/useReceiveToken';

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

function BulkSendProcess() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const route = useAppRoute<
    IModalBulkSendParamList,
    EModalBulkSendRoutes.BulkSendProcess
  >();

  const {
    networkId,
    accountId,
    isInModal,
    isMaxMode,
    tokenInfo,
    transfersInfo,
    totalTokenAmount,
    totalFiatAmount,
    intervalSettings,
    onSuccess,
    onFail,
  } = route.params ?? {};

  const tokenPrice = useMemo(() => {
    if (!totalTokenAmount || !totalFiatAmount) return undefined;
    const tokenBN = new BigNumber(totalTokenAmount);
    const fiatBN = new BigNumber(totalFiatAmount);
    if (tokenBN.isZero() || tokenBN.isNaN() || fiatBN.isNaN()) return undefined;
    return fiatBN.div(tokenBN).toNumber();
  }, [totalTokenAmount, totalFiatAmount]);

  // Use first sender's accountId for fill-up receive screen
  const firstAccountId =
    route.params?.unsignedTxs?.[0]?.accountId || accountId || '';
  const { handleOnReceive } = useReceiveToken({
    accountId: firstAccountId,
    networkId,
    walletId: accountUtils.getWalletIdFromAccountId({
      accountId: firstAccountId,
    }),
    indexedAccountId: route.params?.unsignedTxs?.[0]?.indexedAccountId ?? '',
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

  const [unsignedTxs, setUnsignedTxs] = useState<IUnsignedTxPro[]>(
    route.params?.unsignedTxs ?? [],
  );

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

  // Track native balance per sender (keyed by networkId:accountAddress)
  const networkStatusRef = useRef<
    Record<
      string,
      {
        isInsufficientFunds: boolean;
        nativeBalance: string;
        nativeSymbol: string;
      }
    >
  >({});

  // Fee overflow only needs to be checked once (same network for all txs)
  const feeOverflowCheckedRef = useRef(false);

  // Fee estimation cache — same network/structure, refresh every 30s
  const FEE_CACHE_TTL_MS = 30_000;
  const feeCacheRef = useRef<{
    feeInfo: IFeeInfoUnit;
    estimateFeeParams: any;
    nativeTokenPrice: number;
    timestamp: number;
  } | null>(null);

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
                isInsufficientFunds: false,
                nativeBalance: resp[0].balanceParsed,
                nativeSymbol: resp[0].info?.symbol ?? '',
              };
            }
          } catch (error) {
            console.error('fetchAccountNativeBalance error', error);
          }
        }

        if (isAborted.current) break;
        await waitUntilInProgress();

        // Check if sender already marked as insufficient
        if (networkStatusRef.current[balanceKey]?.isInsufficientFunds) {
          const nativeSymbol =
            networkStatusRef.current[balanceKey]?.nativeSymbol;
          setTxStatusMap((prev) => ({
            ...prev,
            [i]: {
              isInsufficientFunds: true,
              status: EBulkSendTxStatus.Skipped,
              errorMessage: `Insufficient ${nativeSymbol} for network fees`,
            },
          }));
          continue;
        }

        // Set processing status
        setTxStatusMap((prev) => ({
          ...prev,
          [i]: { status: EBulkSendTxStatus.Processing },
        }));

        // Estimate fees (cached with TTL refresh)
        let feeInfo: IFeeInfoUnit;
        let estimateFeeParams: any;
        let nativeTokenPrice: number;

        const now = Date.now();
        const cached = feeCacheRef.current;
        if (cached && now - cached.timestamp < FEE_CACHE_TTL_MS) {
          feeInfo = cached.feeInfo;
          estimateFeeParams = cached.estimateFeeParams;
          nativeTokenPrice = cached.nativeTokenPrice;
        } else {
          const buildResult =
            await backgroundApiProxy.serviceGas.buildEstimateFeeParams({
              accountId: txAccountId,
              networkId,
              encodedTx: tx.encodedTx,
            });

          const resp = await backgroundApiProxy.serviceGas.estimateFee({
            accountId: txAccountId,
            networkId,
            encodedTx: buildResult.encodedTx,
            accountAddress,
          });

          feeInfo = {
            common: {
              baseFee: resp.common.baseFee,
              feeDecimals: resp.common.feeDecimals,
              feeSymbol: resp.common.feeSymbol,
              nativeDecimals: resp.common.nativeDecimals,
              nativeSymbol: resp.common.nativeSymbol,
              nativeTokenPrice: resp.common.nativeTokenPrice,
            },
            gas: resp.gas?.[1] ?? resp.gas?.[0],
            gasEIP1559: resp.gasEIP1559?.[1] ?? resp.gasEIP1559?.[0],
            feeTron: resp.feeTron?.[1] ?? resp.feeTron?.[0],
          };
          estimateFeeParams = buildResult.estimateFeeParams;
          nativeTokenPrice = resp.common.nativeTokenPrice ?? 0;

          feeCacheRef.current = {
            feeInfo,
            estimateFeeParams,
            nativeTokenPrice,
            timestamp: now,
          };
        }

        const feeResult = calculateFeeForSend({
          feeInfo,
          nativeTokenPrice,
          txSize: tx.txSize,
          estimateFeeParams,
        });

        if (isAborted.current) break;
        await waitUntilInProgress();

        // Balance vs fee check
        if (
          !isNil(networkStatusRef.current[balanceKey]?.nativeBalance) &&
          new BigNumber(networkStatusRef.current[balanceKey]?.nativeBalance).lt(
            feeResult.totalNativeForDisplay ?? feeResult.totalNative,
          )
        ) {
          networkStatusRef.current[balanceKey].isInsufficientFunds = true;
          networkStatusRef.current[balanceKey].nativeSymbol =
            feeInfo.common.nativeSymbol;
          setTxStatusMap((prev) => ({
            ...prev,
            [i]: {
              isInsufficientFunds: true,
              status: EBulkSendTxStatus.Failed,
              errorMessage: `Insufficient ${feeInfo.common.nativeSymbol} for network fees`,
            },
          }));
          continue;
        }

        // Native Token + Max mode: deduct fee from send amount
        let updatedTx = tx;
        if (isMaxMode && tokenInfo?.isNative) {
          const network = await backgroundApiProxy.serviceNetwork.getNetwork({
            networkId,
          });
          const currentBalance =
            networkStatusRef.current[balanceKey]?.nativeBalance ?? '0';
          const feeWithRatio = new BigNumber(feeResult.totalNative).times(
            network.feeMeta?.maxSendFeeUpRatio ?? 1,
          );
          const maxSendAmount = new BigNumber(currentBalance).minus(
            feeWithRatio,
          );

          if (maxSendAmount.lte(0)) {
            networkStatusRef.current[balanceKey].isInsufficientFunds = true;
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

          updatedTx = await backgroundApiProxy.serviceSend.updateUnsignedTx({
            networkId,
            accountId: txAccountId,
            unsignedTx: updatedTx,
            feeInfo,
            nativeAmountInfo: { maxSendAmount: maxSendAmount.toFixed() },
          });
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
          // For max mode native token, also deduct the sent amount
          if (isMaxMode && tokenInfo?.isNative && transfersInfoState?.[i]) {
            deduction = deduction.plus(transfersInfoState[i].amount || '0');
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
        if (
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
          if (
            (error as { code: number }).code ===
            EResponseCode.insufficient_funds_for_tx_fee
          ) {
            const accountAddress2 = await backgroundApiProxy.serviceAccount
              .getAccountAddressForApi({
                networkId,
                accountId: tx.accountId || accountId || '',
              })
              .catch(() => '');
            const key2 = `${networkId}:${accountAddress2}`;
            if (networkStatusRef.current[key2]) {
              networkStatusRef.current[key2].isInsufficientFunds = true;
            }
          }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unsignedTxs, waitUntilInProgress, intl]);

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
      setProgressState(EBulkSendProgressState.InProgress);
      networkStatusRef.current = {};
      const failedIndices = new Set<number>();
      Object.entries(txStatusMap).forEach(([idx, s]) => {
        if (s.status !== EBulkSendTxStatus.Succeeded) {
          failedIndices.add(Number(idx));
        }
      });
      setUnsignedTxs((prev) => prev.filter((_, idx) => failedIndices.has(idx)));
      setTransfersInfoState((prev) =>
        prev.filter((_, idx) => failedIndices.has(idx)),
      );
      setTxStatusMap({});
      feeOverflowCheckedRef.current = false;
      feeCacheRef.current = null;
      resultsRef.current = [];
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

export default BulkSendProcess;
