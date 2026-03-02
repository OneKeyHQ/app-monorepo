import { useCallback, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Page,
  Toast,
  YStack,
  popModalPages,
  popToTabRootScreen,
  switchTab,
} from '@onekeyhq/components';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  type EModalBulkSendRoutes,
  EModalRoutes,
  EModalSignatureConfirmRoutes,
  ETabRoutes,
  type IModalBulkSendParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { waitAsync } from '@onekeyhq/shared/src/utils/promiseUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { ISendSelectedFeeInfo } from '@onekeyhq/shared/types/fee';
import { EFeeType, ESendFeeStatus } from '@onekeyhq/shared/types/fee';
import { ESendPreCheckTimingEnum } from '@onekeyhq/shared/types/send';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import { usePreCheckFeeInfo } from '../../../SignatureConfirm/hooks/usePreCheckFeeInfo';
import BulkSendTxDetails from '../../components/BulkSendTxDetails';

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
  } = useBulkSendReviewContext();

  const intl = useIntl();
  const navigation = useAppNavigation();
  const isMultiTxs = unsignedTxs.length > 1;

  // Use fee estimation hook
  const { feeLabel, handleFeeChange, vaultSettings, forceRefreshFee } =
    useBulkSendFeeEstimation({
      networkId,
      accountId,
      unsignedTxs,
      feeState,
      setFeeState,
    });

  // Approval recheck hook - polls allowance after partial batch failure
  const { isRecheckingApproval, startApprovalRecheck } = useApprovalRecheck({
    networkId,
    accountId,
    tokenInfo,
    transfersInfo,
    totalTokenAmount,
    approvesInfo,
    setApprovesInfo,
    setUnsignedTxs,
    forceRefreshFee,
  });

  // Fee overflow check hook
  const { checkFeeInfoIsOverflow, showFeeInfoOverflowConfirm } =
    usePreCheckFeeInfo();

  // Determine button text based on whether approvals are needed
  const confirmButtonText =
    approvesInfo.length > 0
      ? intl.formatMessage({
          id: ETranslations.wallet_bulk_send_btn_approve_and_confirm,
        })
      : intl.formatMessage({ id: ETranslations.wallet_bulk_send_btn_confirm });

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

  // Track how many txs were successfully sent (used by Tron one-by-one flow)
  const sentTxCountRef = useRef(0);

  // Handle Tron transactions one by one
  const handleTronTxsOneByOne = useCallback(
    async (txs: IUnsignedTxPro[], txFeeInfos: ISendSelectedFeeInfo[]) => {
      const allResults: ISendTxOnSuccessData[] = [];
      sentTxCountRef.current = 0;

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
                onSuccess: (data: ISendTxOnSuccessData[]) => {
                  resolve(data);
                },
                onFail: (error: Error) => {
                  reject(error);
                },
                onCancel: () => {
                  reject(new Error('User cancelled'));
                },
              },
            });
          },
        );

        sentTxCountRef.current = i + 1;

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

    const { serviceSend } = backgroundApiProxy;

    setIsSubmitting(true);

    // Step 1: Pre-check unsigned transactions
    try {
      await serviceSend.precheckUnsignedTxs({
        networkId,
        accountId,
        unsignedTxs,
        precheckTiming: ESendPreCheckTimingEnum.Confirm,
        feeInfos: feeState.feeInfos,
      });
    } catch (e: any) {
      setIsSubmitting(false);
      onFail?.(e as Error);
      throw e;
    }

    // Step 2: Update unsigned transactions before sending
    let newUnsignedTxs: IUnsignedTxPro[];
    try {
      newUnsignedTxs = await serviceSend.updateUnSignedTxBeforeSending({
        accountId,
        networkId,
        unsignedTxs,
        feeInfos: feeState.feeInfos,
      });
    } catch (e: any) {
      setIsSubmitting(false);
      onFail?.(e as Error);
      throw e;
    }

    // Step 3: Check fee overflow for each transaction
    for (let i = 0; i < newUnsignedTxs.length; i += 1) {
      const feeInfo = feeState.feeInfos[i];
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

    // Step 4: Check if Tron network - confirm transactions one by one
    if (networkUtils.isTronNetworkByNetworkId(networkId)) {
      try {
        // Pass fee infos from Review page estimation
        const results = await handleTronTxsOneByOne(
          newUnsignedTxs,
          feeState.feeInfos,
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
        // Only recheck approval if all approve txs were already broadcast.
        // If the error happened during the approve phase, nothing was sent
        // to chain, so polling the allowance is pointless.
        if (
          approvesInfo.length > 0 &&
          sentTxCountRef.current >= approvesInfo.length
        ) {
          startApprovalRecheck();
        }
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
    let approveTxsSent = false;

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
        });
        approveTxsSent = true;
      } catch (e: any) {
        // Approve txs failed — nothing was broadcast, no need to recheck
        if (accountUtils.isQrAccount({ accountId })) {
          navigation.popStack();
        }
        setIsSubmitting(false);
        onFail?.(e as Error);
        throw e;
      }
    }

    // Step 5b: Send transfer tx(s)
    try {
      const result = await serviceSend.batchSignAndSendTransaction({
        accountId,
        networkId,
        unsignedTxs: newUnsignedTxs.slice(approveCount),
        feeInfos: feeState.feeInfos.slice(approveCount),
        signOnly: false,
        transferPayload: undefined,
      });

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
      setIsSubmitting(false);
      // Only recheck approval if approve txs were already broadcast
      if (approveTxsSent) {
        startApprovalRecheck();
      }
      onFail?.(e as Error);
      throw e;
    }
  }, [
    accountId,
    networkId,
    unsignedTxs,
    feeState.feeInfos,
    setIsSubmitting,
    onFail,
    onSuccess,
    checkFeeInfoIsOverflow,
    showFeeInfoOverflowConfirm,
    intl,
    navigation,
    handleTronTxsOneByOne,
    navigateAfterSuccess,
    startApprovalRecheck,
    approvesInfo.length,
    bulkSendMode,
    transfersInfo.length,
    tokenInfo?.symbol,
  ]);

  // Determine if confirm button should be disabled
  // Only disable when:
  // 1. Not initialized yet (initial loading)
  // 2. Force loading (tx update)
  // 3. Error state (no valid fee data)
  // 4. Currently submitting
  const isConfirmDisabled =
    !feeState.isInitialized ||
    (feeState.feeStatus === ESendFeeStatus.Loading &&
      !feeState.isInitialized) ||
    feeState.feeStatus === ESendFeeStatus.Error ||
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
          {/* Fee Error Alert - Top Section */}
          <BulkSendReviewAlert onRetry={handleRetryFeeEstimation} />

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
            />
          </YStack>

          {/* Transaction Details - Bottom Section */}
          <BulkSendTxDetails
            editMode={false}
            tokenInfo={tokenInfo}
            transfersInfo={transfersInfo}
            bulkSendMode={bulkSendMode}
            containerProps={{
              px: '$5',
            }}
          />
        </YStack>
      </Page.Body>
      <Page.Footer>
        <Page.FooterActions
          onConfirmText={confirmButtonText}
          confirmButtonProps={{
            onPress: handleConfirm,
            disabled: isConfirmDisabled,
            loading: isSubmitting || isRecheckingApproval,
          }}
        />
      </Page.Footer>
    </Page>
  );
}

function BulkSendReview() {
  const route = useAppRoute<
    IModalBulkSendParamList,
    EModalBulkSendRoutes.BulkSendReview
  >();

  const {
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
    onSuccess,
    onFail,
  } = route.params ?? {};

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

export default BulkSendReview;
