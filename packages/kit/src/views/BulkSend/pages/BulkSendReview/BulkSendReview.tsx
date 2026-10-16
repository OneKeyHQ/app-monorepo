import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Alert,
  Page,
  Toast,
  YStack,
  popModalPages,
  popToTabRootScreen,
  rootNavigationRef,
  switchTab,
} from '@onekeyhq/components';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalBulkSendRoutes,
  EModalRoutes,
  EModalSignatureConfirmRoutes,
  ERootRoutes,
  ETabHomeRoutes,
  ETabRoutes,
  type IModalBulkSendParamList,
} from '@onekeyhq/shared/src/routes';
import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { waitAsync } from '@onekeyhq/shared/src/utils/promiseUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import tokenRebaseUtils from '@onekeyhq/shared/src/utils/tokenRebaseUtils';
import { EBulkSendMode } from '@onekeyhq/shared/types/bulkSend';
import type { ISendSelectedFeeInfo } from '@onekeyhq/shared/types/fee';
import { EFeeType, ESendFeeStatus } from '@onekeyhq/shared/types/fee';
import type { IPrimeFreeTrialBroadcastUsage } from '@onekeyhq/shared/types/prime/primeFreeTrialTypes';
import { ESendPreCheckTimingEnum } from '@onekeyhq/shared/types/send';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import {
  isPrimeFreeTrialUserCancelError,
  usePrimeFreeTrialUsage,
} from '../../../Prime/hooks/usePrimeFreeTrialUsage';
import { usePreCheckFeeInfo } from '../../../SignatureConfirm/hooks/usePreCheckFeeInfo';
import BulkSendSplitTxAlert from '../../components/BulkSendSplitTxAlert';
import BulkSendTxDetails from '../../components/BulkSendTxDetails';
import { useRedirectToBulkSendAddressesInput } from '../../hooks/useRedirectToBulkSendAddressesInput';
import { BulkSendTestIDs } from '../../testIDs';

import BulkSendApprovalCard from './components/BulkSendApprovalCard';
import BulkSendReviewAlert from './components/BulkSendReviewAlert';
import BulkSendReviewCostCard from './components/BulkSendReviewCostCard';
import BulkSendReviewGrandSummary from './components/BulkSendReviewGrandSummary';
import {
  BulkSendReviewContext,
  type IBulkSendFeeState,
  useBulkSendReviewContext,
} from './components/Context';
import { showStandaloneApproveEditor } from './components/StandaloneApproveEditor';
import { useApprovalRecheck } from './hooks/useApprovalRecheck';
import { useBulkSendFeeEstimation } from './hooks/useBulkSendFeeEstimation';

// Stable reference so the memoized BulkSendTxDetails skips progress renders
const TX_DETAILS_CONTAINER_PROPS = { px: '$5' } as const;

function BaseBulkSendReview({
  onSuccess,
  onFail,
}: {
  onSuccess?: (data: any[]) => void;
  onFail?: (error: Error) => void;
}) {
  const {
    networkId,
    accountId,
    tokenInfo,
    transfersInfo,
    bulkSendMode,
    totalTokenAmount,
    totalFiatAmount,
    approvesInfo,
    unsignedTxs,
    setApprovesInfo,
    setUnsignedTxs,
    initialApprovesInfoRef,
    feeState,
    setFeeState,
    isSubmitting,
    setIsSubmitting,
    isInModal,
    isMaxMode,
    ataCount,
    intervalSettings,
  } = useBulkSendReviewContext();

  const intl = useIntl();
  const navigation = useAppNavigation();
  const isMultiTxs = unsignedTxs.length > 1;
  const transferTxCount = unsignedTxs.length - approvesInfo.length;
  const isTransferSplit = transferTxCount > 1;

  const receiverGroups = useMemo(() => {
    if (
      bulkSendMode !== EBulkSendMode.OneToMany ||
      !isTransferSplit ||
      unsignedTxs.length === 0
    ) {
      return undefined;
    }
    const txBatches = unsignedTxs
      .map((tx) => tx.transfersInfo ?? [])
      .filter((batch) => batch.length > 0);
    return txBatches.length > 1 ? txBatches : undefined;
  }, [bulkSendMode, isTransferSplit, unsignedTxs]);

  // Use fee estimation hook
  const { feeLabel, handleFeeChange, vaultSettings, forceRefreshFee } =
    useBulkSendFeeEstimation({
      networkId,
      accountId,
      unsignedTxs,
      feeState,
      setFeeState,
      ataCount,
      tokenInfo,
      totalTokenAmount,
      bulkSendMode,
      isSubmitting,
    });

  // Approval recheck hook - polls allowance after partial batch failure
  const { isRecheckingApproval, startApprovalRecheck } = useApprovalRecheck({
    networkId,
    accountId,
    tokenInfo,
    approvesInfo,
    setApprovesInfo,
    setUnsignedTxs,
  });

  // Fee overflow check hook
  const { checkFeeInfoIsOverflow, showFeeInfoOverflowConfirm } =
    usePreCheckFeeInfo();

  // Handle editing approval amount
  const handleEditApproval = useCallback(
    (index: number) => {
      const approveInfo = approvesInfo[index];
      const originalApproveInfo = initialApprovesInfoRef.current[index];
      if (!approveInfo || !originalApproveInfo || !accountId || !networkId)
        return;

      const tokenAddress = approveInfo.tokenInfo?.address ?? '';
      const tokenDecimals = approveInfo.tokenInfo?.decimals ?? 18;
      const tokenSymbol = approveInfo.tokenInfo?.symbol ?? '';

      // Scaled-UI (rebase) tokens: the standalone editor re-encodes the
      // string as raw units; fail-close editing (same policy as the
      // signature-confirm editor). The pre-built approve amount stays as-is.
      if (
        tokenRebaseUtils.isScalingBalanceMultiplier(
          approveInfo.tokenInfo?.balanceMultiplier,
        )
      ) {
        return;
      }

      showStandaloneApproveEditor({
        accountId,
        networkId,
        allowance: approveInfo.amount,
        isUnlimited: approveInfo.isMax ?? false,
        tokenAddress,
        tokenDecimals,
        tokenSymbol,
        approveInfo,
        // Use original values for reset
        originalAllowance: originalApproveInfo.amount,
        originalIsUnlimited: originalApproveInfo.isMax ?? false,
        onConfirm: async ({ allowance, isUnlimited }) => {
          // Update the unsignedTx for this approval
          const newUnsignedTx =
            await backgroundApiProxy.serviceSend.updateUnsignedTx({
              accountId,
              networkId,
              unsignedTx: unsignedTxs[index],
              tokenApproveInfo: {
                allowance,
                isUnlimited,
              },
            });

          // Update unsignedTxs
          setUnsignedTxs((prev) => {
            const newUnsignedTxs = [...prev];
            newUnsignedTxs[index] = newUnsignedTx;
            return newUnsignedTxs;
          });

          // Update approvesInfo for display
          setApprovesInfo((prev) => {
            const newApprovesInfo = [...prev];
            newApprovesInfo[index] = {
              ...newApprovesInfo[index],
              amount: allowance,
              isMax: isUnlimited,
            };
            return newApprovesInfo;
          });

          // Force refresh fee after tx update
          forceRefreshFee();
        },
        onReset: async () => {
          // Reset to original value
          const newUnsignedTx =
            await backgroundApiProxy.serviceSend.updateUnsignedTx({
              accountId,
              networkId,
              unsignedTx: unsignedTxs[index],
              tokenApproveInfo: {
                allowance: originalApproveInfo.amount,
                isUnlimited: originalApproveInfo.isMax ?? false,
              },
            });

          // Update unsignedTxs
          setUnsignedTxs((prev) => {
            const newUnsignedTxs = [...prev];
            newUnsignedTxs[index] = newUnsignedTx;
            return newUnsignedTxs;
          });

          // Reset approvesInfo to original
          setApprovesInfo((prev) => {
            const newApprovesInfo = [...prev];
            newApprovesInfo[index] = {
              ...newApprovesInfo[index],
              amount: originalApproveInfo.amount,
              isMax: originalApproveInfo.isMax,
            };
            return newApprovesInfo;
          });

          // Force refresh fee after tx update
          forceRefreshFee();
        },
      });
    },
    [
      approvesInfo,
      accountId,
      networkId,
      unsignedTxs,
      setUnsignedTxs,
      setApprovesInfo,
      forceRefreshFee,
      initialApprovesInfoRef,
    ],
  );

  // Handle retry fee estimation (force loading state)
  const handleRetryFeeEstimation = useCallback(
    () => forceRefreshFee(),
    [forceRefreshFee],
  );

  // Resolves once the Tron confirm page of the current tx is gone. A failed
  // send keeps that page open, and a retry there still broadcasts with the
  // round's free-trial usage.
  const tronConfirmPageExitRef = useRef<Promise<void>>(Promise.resolve());

  // Lets the background skip already broadcast txs when the user retries;
  // also keys this page's signing progress events.
  const [sentTxsTrackingId] = useState(() => generateUUID());

  // uuid → recorded, for txs this page knows went out. Background batches
  // are read back after a failure. Tron signs each tx on its own confirm page
  // (with that page's tracking id), so the Tron flow records them here.
  const sentTxsRef = useRef<Map<string, boolean>>(new Map());

  // 1-based index of the tx being signed across approve + transfer txs;
  // 0 when idle. Shown on the confirm button for multi-tx submits.
  const [signingIndex, setSigningIndex] = useState(0);
  // Transfer txs sent / total across all attempts after a partial failure.
  // Sent txs are pruned from unsignedTxs, so the count is kept cumulatively.
  const [partialSent, setPartialSent] = useState<
    { sent: number; total: number } | undefined
  >();
  const sentTransferUuidsRef = useRef<Set<string>>(new Set());
  // Approve and transfer txs are sent in separate batches; offset the
  // transfer batch's per-batch index by the approve count.
  const progressOffsetRef = useRef(0);

  useEffect(() => {
    const onProgress = ({
      progressEventId,
      current,
    }: IAppEventBusPayload[EAppEventBusNames.BatchSignTxProgress]) => {
      if (progressEventId !== sentTxsTrackingId) return;
      setSigningIndex(progressOffsetRef.current + current);
    };
    appEventBus.on(EAppEventBusNames.BatchSignTxProgress, onProgress);
    return () => {
      appEventBus.off(EAppEventBusNames.BatchSignTxProgress, onProgress);
    };
  }, [sentTxsTrackingId]);

  // Multi-tx submits show signing progress; split sends state the signature
  // count; otherwise reflect approvals
  const confirmButtonText = useMemo(() => {
    if (isSubmitting && isMultiTxs && signingIndex > 0) {
      return intl.formatMessage(
        { id: ETranslations.wallet_bulk_send_signing_progress },
        { current: signingIndex, total: unsignedTxs.length },
      );
    }
    if (receiverGroups) {
      return intl.formatMessage(
        { id: ETranslations.wallet_bulk_send_btn_confirm_and_sign },
        { count: unsignedTxs.length },
      );
    }
    return intl.formatMessage({
      id:
        approvesInfo.length > 0
          ? ETranslations.wallet_bulk_send_btn_approve_and_confirm
          : ETranslations.wallet_bulk_send_btn_confirm,
    });
  }, [
    intl,
    isSubmitting,
    isMultiTxs,
    signingIndex,
    receiverGroups,
    unsignedTxs.length,
    approvesInfo.length,
  ]);

  // After a failed submit: learn which txs went out, show the partial-send
  // status, recheck the allowance if the approvals went out, and drop
  // finished txs so a retry neither re-signs nor pre-checks them.
  const settleAfterFailure = useCallback(
    async (txs: IUnsignedTxPro[]) => {
      try {
        const broadcasted =
          await backgroundApiProxy.serviceSend.getBatchBroadcastedTxUuids({
            sentTxsTrackingId,
          });
        for (const { uuid, recorded } of broadcasted) {
          sentTxsRef.current.set(
            uuid,
            recorded || sentTxsRef.current.get(uuid) === true,
          );
        }
      } catch {
        // Keep what this page already tracked
      }
      const isTxSent = (tx: IUnsignedTxPro) =>
        !!tx.uuid && sentTxsRef.current.has(tx.uuid);
      // Broadcast-but-unrecorded txs stay so the background can finish them
      const isTxDone = (tx: IUnsignedTxPro) =>
        !!tx.uuid && sentTxsRef.current.get(tx.uuid) === true;

      const approveCount = approvesInfo.length;
      const transferTxs = txs.slice(approveCount);
      const approveTxsSent =
        approveCount > 0 && txs.slice(0, approveCount).every(isTxSent);

      // done: recorded; kept: broadcast, history pending; pending: unsent
      const keptTxs: IUnsignedTxPro[] = [];
      const pendingTxs: IUnsignedTxPro[] = [];
      let hasDoneTx = false;
      for (const tx of transferTxs) {
        if (!tx.uuid || !isTxSent(tx)) {
          pendingTxs.push(tx);
        } else {
          sentTransferUuidsRef.current.add(tx.uuid);
          if (isTxDone(tx)) hasDoneTx = true;
          else keptTxs.push(tx);
        }
      }
      const sentCount = sentTransferUuidsRef.current.size;
      setPartialSent(
        sentCount > 0 && pendingTxs.length > 0
          ? { sent: sentCount, total: sentCount + pendingTxs.length }
          : undefined,
      );

      // Polling the allowance only makes sense once the approvals went out.
      // The approval state and approve txs stay until it confirms the
      // allowance and installs the rebuilt transfers.
      if (approveTxsSent) {
        startApprovalRecheck({
          pendingTransfersInfo: pendingTxs.flatMap(
            (tx) => tx.transfersInfo ?? [],
          ),
          keptTxs,
          sentTxsTrackingId,
        });
      }
      if (hasDoneTx) {
        setUnsignedTxs((prev) =>
          prev.filter((tx) => !!tx.approveInfo || !isTxDone(tx)),
        );
      }
    },
    [
      sentTxsTrackingId,
      approvesInfo.length,
      startApprovalRecheck,
      setUnsignedTxs,
    ],
  );

  // Free trial: the usage of this Review page instance. OneToMany keeps it
  // for a resubmit (e.g. transfer failed after the approve went through)
  // while it is already consumed, so the transfer can still be sent with a
  // single monthly free use. Leaving the page starts a new usage next time.
  const { settleUsage, prepareRetryUsage } = usePrimeFreeTrialUsage({
    featureId: EPrimeFeatures.BulkSend,
  });
  const reviewUsageIdRef = useRef<string | undefined>(undefined);
  // Starting or checking a usage can take a while; a page closed meanwhile
  // must not send.
  const isUnmountedRef = useRef(false);
  useEffect(() => {
    isUnmountedRef.current = false;
    return () => {
      isUnmountedRef.current = true;
    };
  }, []);

  // `usageId` is the usage of this round (undefined: not metered);
  // `prepared: false` means the round must not run. The shared retry
  // preparation reuses a consumed usage or starts a new one, and runs no
  // round for a page closed meanwhile on either path.
  const prepareFreeTrialUsage = useCallback(
    async ({
      allowReuse,
    }: {
      allowReuse: boolean;
    }): Promise<{ prepared: boolean; usageId?: string }> => {
      if (platformEnv.isE2E) {
        return { prepared: true };
      }
      const { proceed, usageId, isNewUsage } = await prepareRetryUsage({
        usageId: allowReuse ? reviewUsageIdRef.current : undefined,
        succeededLocally: false,
        networkId,
        isCallerGone: () => isUnmountedRef.current,
      });
      if (!proceed) {
        return { prepared: false };
      }
      if (isNewUsage) {
        reviewUsageIdRef.current = usageId;
      }
      return { prepared: true, usageId };
    },
    [networkId, prepareRetryUsage],
  );

  // Settles a round that ended with an error. Ignored by the background
  // when a broadcast of this usage already succeeded.
  const settleFreeTrialRoundError = useCallback(
    async (usageId: string | undefined, error: unknown) => {
      const isCancelled =
        isPrimeFreeTrialUserCancelError(error) ||
        (error instanceof Error && error.message === 'User cancelled');
      await settleUsage(usageId, isCancelled ? 'cancelled' : 'failed');
    },
    [settleUsage],
  );

  // Handle Tron transactions one by one
  const handleTronTxsOneByOne = useCallback(
    async (
      txs: IUnsignedTxPro[],
      txFeeInfos: ISendSelectedFeeInfo[],
      freeTrialUsage: IPrimeFreeTrialBroadcastUsage | undefined,
    ) => {
      const allResults: ISendTxOnSuccessData[] = [];
      tronConfirmPageExitRef.current = Promise.resolve();

      for (let i = 0, len = txs.length; i < len; i += 1) {
        const unsignedTx = txs[i];
        const isFirstTx = i === 0;

        // Set fee info from Review page estimation
        // This is critical for multi-tx scenarios where later txs can't estimate fee
        // until earlier txs are confirmed (e.g., approve must be on-chain before swap)
        const txFeeInfo = txFeeInfos[i];
        if (txFeeInfo?.feeInfo) {
          unsignedTx.feeInfo = txFeeInfo.feeInfo;
        }

        // Add delay between transactions (except first one)
        if (!isFirstTx) {
          await waitAsync(300);
        }

        setSigningIndex(i + 1);
        let lastError: Error | undefined;
        let markConfirmPageExited: () => void = () => {};
        tronConfirmPageExitRef.current = new Promise<void>((resolve) => {
          markConfirmPageExited = resolve;
        });
        const result: ISendTxOnSuccessData[] = await new Promise(
          (resolve, reject) => {
            navigation.pushModal(EModalRoutes.SignatureConfirmModal, {
              screen: EModalSignatureConfirmRoutes.TxConfirm,
              params: {
                accountId: accountId ?? '',
                networkId: networkId ?? '',
                unsignedTxs: [unsignedTx],
                popStack: false,
                useFeeInTx: true, // Use the fee info we set on unsignedTx
                gasAccountScenario: 'send',
                // ServiceSend marks the usage at the broadcast point, which
                // also covers broadcasts whose onSuccess never fires.
                freeTrialUsage,
                onSuccess: (data: ISendTxOnSuccessData[]) => {
                  markConfirmPageExited();
                  resolve(data);
                },
                // A failed send keeps the confirm page open for a retry, so
                // only remember the error; settle on success or exit so an
                // in-page retry is recorded and the batch continues.
                onFail: (error: Error) => {
                  lastError = error;
                },
                // Also called when the page unmounts without a success.
                onCancel: () => {
                  markConfirmPageExited();
                  reject(lastError ?? new Error('User cancelled'));
                },
              },
            });
          },
        );

        // Confirmed through its own confirm page, so also fully recorded
        if (unsignedTx.uuid) {
          sentTxsRef.current.set(unsignedTx.uuid, true);
        }

        // Collect results
        if (result && result.length > 0) {
          allResults.push(...result);
        }
      }

      return allResults;
    },
    [navigation, accountId, networkId],
  );

  // Navigate back to wallet home after successful transaction
  const navigateAfterSuccess = useCallback(async () => {
    if (accountUtils.isQrAccount({ accountId: accountId ?? '' })) {
      navigation.popStack();
      return;
    }

    // ext popup/sidebar && native
    if (isInModal) {
      // Mobile: close the entire bulk send modal stack
      navigation.popStack();
    } else {
      // Web/Desktop: switch tab and pop to root screen
      await popModalPages();
      switchTab(ETabRoutes.Home);
      await timerUtils.wait(50);
      await popToTabRootScreen();
    }
  }, [isInModal, navigation, accountId]);

  const handleConfirm = useCallback(async () => {
    if (!accountId) return;
    // feeInfos are matched to txs by index; wait for the re-estimate
    if (feeState.estimatedTxs !== unsignedTxs) return;

    const { serviceSend } = backgroundApiProxy;

    setIsSubmitting(true);
    setSigningIndex(0);

    // Step 1: Pre-check unsigned transactions
    // For multi-sender modes, pre-check per accountId group
    try {
      if (bulkSendMode !== EBulkSendMode.OneToMany) {
        const accountGroups = new Map<string, IUnsignedTxPro[]>();
        for (const tx of unsignedTxs) {
          const txAccId = tx.accountId || accountId;
          if (!accountGroups.has(txAccId)) accountGroups.set(txAccId, []);
          accountGroups.get(txAccId)!.push(tx);
        }
        for (const [accId, groupTxs] of accountGroups) {
          await serviceSend.precheckUnsignedTxs({
            networkId,
            accountId: accId,
            unsignedTxs: groupTxs,
            precheckTiming: ESendPreCheckTimingEnum.Confirm,
            feeInfos: feeState.feeInfos,
          });
        }
      } else {
        await serviceSend.precheckUnsignedTxs({
          networkId,
          accountId,
          unsignedTxs,
          precheckTiming: ESendPreCheckTimingEnum.Confirm,
          feeInfos: feeState.feeInfos,
        });
      }
    } catch (e: any) {
      setIsSubmitting(false);
      onFail?.(e as Error);
      throw e;
    }

    // Step 2: Update unsigned transactions before sending
    // For ManyToMany/ManyToOne, expand single fee info to match tx count
    const expandedFeeInfos =
      bulkSendMode !== EBulkSendMode.OneToMany &&
      feeState.feeInfos.length === 1 &&
      unsignedTxs.length > 1
        ? (Array(unsignedTxs.length).fill(
            feeState.feeInfos[0],
          ) as ISendSelectedFeeInfo[])
        : feeState.feeInfos;

    let newUnsignedTxs: IUnsignedTxPro[];
    try {
      // For multi-sender modes, update per accountId to use correct vault context
      if (bulkSendMode !== EBulkSendMode.OneToMany) {
        const accountIdxGroups = new Map<
          string,
          {
            indices: number[];
            txs: IUnsignedTxPro[];
            fees: ISendSelectedFeeInfo[];
          }
        >();
        unsignedTxs.forEach((tx, idx) => {
          const txAccId = tx.accountId || accountId;
          if (!accountIdxGroups.has(txAccId)) {
            accountIdxGroups.set(txAccId, { indices: [], txs: [], fees: [] });
          }
          const group = accountIdxGroups.get(txAccId)!;
          group.indices.push(idx);
          group.txs.push(tx);
          group.fees.push(expandedFeeInfos[idx]);
        });

        const result: IUnsignedTxPro[] = new Array(unsignedTxs.length);
        for (const [accId, group] of accountIdxGroups) {
          const updated = await serviceSend.updateUnSignedTxBeforeSending({
            accountId: accId,
            networkId,
            unsignedTxs: group.txs,
            feeInfos: group.fees,
          });
          group.indices.forEach((origIdx, groupIdx) => {
            result[origIdx] = updated[groupIdx];
          });
        }
        newUnsignedTxs = result;
      } else {
        newUnsignedTxs = await serviceSend.updateUnSignedTxBeforeSending({
          accountId,
          networkId,
          unsignedTxs,
          feeInfos: expandedFeeInfos,
        });
      }
    } catch (e: any) {
      setIsSubmitting(false);
      onFail?.(e as Error);
      throw e;
    }

    // Step 3: Check fee overflow (for ManyToMany/ManyToOne, only check first tx)
    const feeOverflowCheckCount =
      bulkSendMode !== EBulkSendMode.OneToMany ? 1 : newUnsignedTxs.length;
    for (let i = 0; i < feeOverflowCheckCount; i += 1) {
      const feeInfo = expandedFeeInfos[i];
      if (feeInfo) {
        const isFeeInfoOverflow = await checkFeeInfoIsOverflow({
          accountId,
          networkId,
          feeAmount: feeInfo.totalNative,
          feeSymbol: feeInfo.feeInfo.common?.nativeSymbol ?? '',
          encodedTx: newUnsignedTxs[i].encodedTx,
        });

        if (isFeeInfoOverflow) {
          const isConfirmed = await showFeeInfoOverflowConfirm();
          if (!isConfirmed) {
            setIsSubmitting(false);
            return;
          }
          // User confirmed, no need to check remaining transactions
          break;
        }
      }
    }

    // Free trial: reserve one use after local checks and confirmations, right
    // before the first signature. Cancelling the confirm above reserves
    // nothing.
    const freeTrialPrepared = await prepareFreeTrialUsage({
      allowReuse: bulkSendMode === EBulkSendMode.OneToMany,
    });
    if (!freeTrialPrepared.prepared) {
      setIsSubmitting(false);
      return;
    }
    const freeTrialUsageId = freeTrialPrepared.usageId;
    const freeTrialUsage: IPrimeFreeTrialBroadcastUsage | undefined =
      freeTrialUsageId
        ? { featureId: EPrimeFeatures.BulkSend, usageId: freeTrialUsageId }
        : undefined;

    // Step 3.5: ManyToMany/ManyToOne — navigate to BulkSendProcess
    if (bulkSendMode !== EBulkSendMode.OneToMany) {
      setIsSubmitting(false);

      const processParams = {
        networkId,
        accountId,
        isInModal,
        isMaxMode,
        unsignedTxs: newUnsignedTxs,
        feeInfo: feeState.feeInfos[0],
        feePresetIndex: feeState.selectedFee.presetIndex,
        tokenInfo,
        transfersInfo,
        bulkSendMode,
        totalTokenAmount,
        totalFiatAmount,
        intervalSettings,
        freeTrialUsageId,
        onSuccess,
        onFail,
      };

      if (isInModal) {
        navigation.push(EModalBulkSendRoutes.BulkSendProcess, processParams);
      } else {
        await popModalPages();
        rootNavigationRef.current?.navigate(ERootRoutes.Main, {
          screen: ETabRoutes.Home,
          params: {
            screen: ETabHomeRoutes.TabHomeBulkSendProcess,
            params: processParams,
          },
        });
      }
      return;
    }

    // Step 4: Check if Tron network - confirm transactions one by one
    if (networkUtils.isTronNetworkByNetworkId(networkId)) {
      try {
        // Pass fee infos from Review page estimation
        const results = await handleTronTxsOneByOne(
          newUnsignedTxs,
          feeState.feeInfos,
          freeTrialUsage,
        );

        defaultLogger.prime.usage.bulkSendSuccess({
          recipientCount: transfersInfo.length,
          sendMode: bulkSendMode,
          network: networkId ?? '',
          tokenSymbol: tokenInfo?.symbol ?? '',
        });

        setIsSubmitting(false);
        onSuccess?.(results);

        await navigateAfterSuccess();
      } catch (e) {
        setIsSubmitting(false);
        await settleAfterFailure(newUnsignedTxs);
        // Settled once the confirm page is gone: a retry on a page left open
        // by a failed send still broadcasts with this usage, and a settled
        // usage would not count that broadcast.
        void tronConfirmPageExitRef.current.then(() =>
          settleFreeTrialRoundError(freeTrialUsageId, e),
        );
        if (e instanceof Error && e.message === 'User cancelled') {
          return;
        }
        onFail?.(e as Error);
        throw e;
      }
      return;
    }

    // Step 5: Sign and send transactions (for non-Tron networks)
    const approveCount = approvesInfo.length;
    progressOffsetRef.current = 0;

    // Step 5a: Send approve txs first (if any), so we can track whether
    // they were broadcast before the transfer phase
    if (approveCount > 0) {
      try {
        await serviceSend.batchSignAndSendTransaction({
          accountId,
          networkId,
          unsignedTxs: newUnsignedTxs.slice(0, approveCount),
          feeInfos: feeState.feeInfos.slice(0, approveCount),
          signOnly: false,
          transferPayload: undefined,
          sentTxsTrackingId,
          freeTrialUsage,
          progressEventId: sentTxsTrackingId,
        });
      } catch (e: any) {
        // Approve txs failed — nothing was broadcast, no need to recheck
        if (accountUtils.isQrAccount({ accountId })) {
          navigation.popStack();
        }
        await settleFreeTrialRoundError(freeTrialUsageId, e);
        setIsSubmitting(false);
        onFail?.(e as Error);
        throw e;
      }
    }

    // Step 5b: Send transfer tx(s)
    progressOffsetRef.current = approveCount;
    try {
      const result = await serviceSend.batchSignAndSendTransaction({
        accountId,
        networkId,
        unsignedTxs: newUnsignedTxs.slice(approveCount),
        feeInfos: feeState.feeInfos.slice(approveCount),
        signOnly: false,
        transferPayload: undefined,
        sentTxsTrackingId,
        freeTrialUsage,
        progressEventId: sentTxsTrackingId,
      });
      // A resubmit that only finished broadcasts of an earlier attempt
      // (replayed through sentTxsTrackingId) used nothing, so this round's
      // usage is released. One a broadcast already marked stays charged.
      void settleUsage(freeTrialUsageId, 'cancelled');

      // Step 6: Show success toast
      Toast.success({
        title: intl.formatMessage({
          id: ETranslations.feedback_transaction_submitted,
        }),
      });

      defaultLogger.prime.usage.bulkSendSuccess({
        recipientCount: transfersInfo.length,
        sendMode: bulkSendMode,
        network: networkId ?? '',
        tokenSymbol: tokenInfo?.symbol ?? '',
      });

      setIsSubmitting(false);
      onSuccess?.(result);

      // Step 7: Navigate back to wallet home
      await navigateAfterSuccess();
    } catch (e: any) {
      // Handle QR account navigation on error
      if (accountUtils.isQrAccount({ accountId })) {
        navigation.popStack();
      }
      await settleFreeTrialRoundError(freeTrialUsageId, e);
      setIsSubmitting(false);
      await settleAfterFailure(newUnsignedTxs);
      onFail?.(e as Error);
      throw e;
    }
  }, [
    accountId,
    networkId,
    unsignedTxs,
    feeState.feeInfos,
    feeState.estimatedTxs,
    feeState.selectedFee.presetIndex,
    setIsSubmitting,
    onFail,
    onSuccess,
    checkFeeInfoIsOverflow,
    showFeeInfoOverflowConfirm,
    intl,
    navigation,
    handleTronTxsOneByOne,
    navigateAfterSuccess,
    settleAfterFailure,
    approvesInfo.length,
    bulkSendMode,
    transfersInfo,
    tokenInfo,
    totalTokenAmount,
    totalFiatAmount,
    intervalSettings,
    isInModal,
    isMaxMode,
    prepareFreeTrialUsage,
    settleFreeTrialRoundError,
    settleUsage,
    sentTxsTrackingId,
  ]);

  // Determine if confirm button should be disabled
  // Only disable when:
  // 1. Not initialized yet (initial loading)
  // 2. Force loading (tx update)
  // 3. Error state (no valid fee data)
  // 4. Currently submitting
  const isConfirmDisabled =
    !feeState.isInitialized ||
    feeState.estimatedTxs !== unsignedTxs ||
    (feeState.feeStatus === ESendFeeStatus.Loading &&
      !feeState.isInitialized) ||
    feeState.feeStatus === ESendFeeStatus.Error ||
    feeState.insufficientSol ||
    isSubmitting ||
    isRecheckingApproval;

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.wallet_bulk_send_review_title,
        })}
      />
      <Page.Body>
        <YStack gap="$8">
          {/* Notices: fee error, then partial-send status (replaces the
              split notice once some txs went out) or the split notice */}
          {feeState.errMessage || partialSent || receiverGroups ? (
            <YStack px="$5" gap="$3">
              <BulkSendReviewAlert onRetry={handleRetryFeeEstimation} />
              {partialSent ? (
                <Alert
                  icon="InfoCircleOutline"
                  type="warning"
                  title={intl.formatMessage(
                    { id: ETranslations.wallet_bulk_send_partial_sent },
                    partialSent,
                  )}
                />
              ) : null}
              {!partialSent && receiverGroups ? (
                <BulkSendSplitTxAlert txCount={receiverGroups.length} />
              ) : null}
            </YStack>
          ) : null}

          {/* Grand Summary - Top Section */}
          <BulkSendReviewGrandSummary />

          {/* Approval & Cost Cards */}
          <YStack gap="$4">
            {approvesInfo.length > 0 ? (
              <BulkSendApprovalCard onEditApproval={handleEditApproval} />
            ) : null}
            <BulkSendReviewCostCard
              feeLevel={feeLabel}
              isMultiTxs={isMultiTxs}
              onFeeChange={handleFeeChange}
              editFeeEnabled={vaultSettings?.editFeeEnabled}
              transferTxCount={transferTxCount}
              isTransferSplit={isTransferSplit}
              intervalSettings={intervalSettings}
            />
          </YStack>

          {/* Transaction Details - Bottom Section */}
          <BulkSendTxDetails
            editMode={false}
            tokenInfo={tokenInfo}
            transfersInfo={transfersInfo}
            bulkSendMode={bulkSendMode}
            receiverGroups={receiverGroups}
            containerProps={TX_DETAILS_CONTAINER_PROPS}
          />
        </YStack>
      </Page.Body>
      <Page.Footer>
        <YStack $md={{ pb: '$5' }}>
          <Page.FooterActions
            onConfirmText={confirmButtonText}
            confirmButtonProps={{
              testID: BulkSendTestIDs.reviewConfirmBtn,
              onPress: handleConfirm,
              disabled: isConfirmDisabled,
              loading: isSubmitting || isRecheckingApproval,
            }}
          />
        </YStack>
      </Page.Footer>
    </Page>
  );
}

type IBulkSendReviewRouteParams =
  IModalBulkSendParamList[EModalBulkSendRoutes.BulkSendReview];

function BulkSendReviewContent({
  networkId,
  accountId,
  tokenInfo,
  transfersInfo,
  approvesInfo: initialApprovesInfo,
  unsignedTxs: initialUnsignedTxs,
  bulkSendMode,
  totalTokenAmount,
  totalFiatAmount,
  isInModal,
  isMaxMode,
  ataCount,
  intervalSettings,
  onSuccess,
  onFail,
}: IBulkSendReviewRouteParams) {
  // Local state for approves info (can be modified by editor)
  const [approvesInfo, setApprovesInfo] = useState<IApproveInfo[]>(
    initialApprovesInfo ?? [],
  );

  // Store original approvesInfo for reset functionality
  const initialApprovesInfoRef = useRef<IApproveInfo[]>(
    initialApprovesInfo ?? [],
  );

  // Local state for unsigned transactions (may need to be updated)
  const [unsignedTxs, setUnsignedTxs] = useState<IUnsignedTxPro[]>(
    initialUnsignedTxs ?? [],
  );

  // Fee state
  const [feeState, setFeeState] = useState<IBulkSendFeeState>({
    feeStatus: ESendFeeStatus.Loading,
    errMessage: '',
    isInitialized: false,
    feeSelectorItems: [],
    selectedFee: {
      feeType: EFeeType.Standard,
      presetIndex: 1, // Default to Normal
    },
    totalFeeNative: '0',
    totalFeeFiat: '0',
    nativeSymbol: '',
    feeInfos: [],
  });

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch network info for network icon
  const { result: networkInfo } = usePromiseResult(
    async () => {
      if (!networkId) return null;
      return backgroundApiProxy.serviceNetwork.getNetwork({ networkId });
    },
    [networkId],
    { initResult: null },
  );

  const contextValue = useMemo(
    () => ({
      networkId,
      accountId,
      tokenInfo,
      transfersInfo,
      bulkSendMode,
      totalTokenAmount,
      totalFiatAmount,
      isInModal,
      isMaxMode,
      ataCount,
      intervalSettings,
      networkImageUri: networkInfo?.logoURI,
      initialApprovesInfoRef,
      approvesInfo,
      setApprovesInfo,
      unsignedTxs,
      setUnsignedTxs,
      feeState,
      setFeeState,
      isSubmitting,
      setIsSubmitting,
    }),
    [
      networkId,
      accountId,
      tokenInfo,
      transfersInfo,
      bulkSendMode,
      totalTokenAmount,
      totalFiatAmount,
      isInModal,
      isMaxMode,
      ataCount,
      intervalSettings,
      networkInfo?.logoURI,
      approvesInfo,
      unsignedTxs,
      feeState,
      isSubmitting,
    ],
  );

  if (!tokenInfo || !transfersInfo) {
    return null;
  }

  return (
    <BulkSendReviewContext.Provider value={contextValue}>
      <BaseBulkSendReview onSuccess={onSuccess} onFail={onFail} />
    </BulkSendReviewContext.Provider>
  );
}

function BulkSendReview() {
  const route = useAppRoute<
    IModalBulkSendParamList,
    EModalBulkSendRoutes.BulkSendReview
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

  return <BulkSendReviewContent {...params} />;
}

export default BulkSendReview;
