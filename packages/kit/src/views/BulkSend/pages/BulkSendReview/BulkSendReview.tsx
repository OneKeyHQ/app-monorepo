import { useCallback, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Page, Toast, YStack } from '@onekeyhq/components';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import {
  type EModalBulkSendRoutes,
  type IModalBulkSendParamList,
} from '@onekeyhq/shared/src/routes';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESendPreCheckTimingEnum } from '@onekeyhq/shared/types/send';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EFeeType, ESendFeeStatus } from '@onekeyhq/shared/types/fee';

import { usePreCheckFeeInfo } from '../../../SignatureConfirm/hooks/usePreCheckFeeInfo';

import BulkSendApprovalCard from './components/BulkSendApprovalCard';
import BulkSendReviewAlert from './components/BulkSendReviewAlert';
import BulkSendReviewCostCard from './components/BulkSendReviewCostCard';
import BulkSendReviewGrandSummary from './components/BulkSendReviewGrandSummary';
import BulkSendTxDetails from '../../components/BulkSendTxDetails';
import { showStandaloneApproveEditor } from './components/StandaloneApproveEditor';
import { useBulkSendFeeEstimation } from './hooks/useBulkSendFeeEstimation';

import {
  BulkSendReviewContext,
  type IBulkSendFeeState,
  useBulkSendReviewContext,
} from './components/Context';

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
    approvesInfo,
    unsignedTxs,
    setApprovesInfo,
    setUnsignedTxs,
    initialApprovesInfoRef,
    feeState,
    setFeeState,
    isSubmitting,
    setIsSubmitting,
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

  // Fee overflow check hook
  const { checkFeeInfoIsOverflow, showFeeInfoOverflowConfirm } =
    usePreCheckFeeInfo();

  // Determine button text based on whether approvals are needed
  const confirmButtonText =
    approvesInfo.length > 0 ? 'Approve and Confirm' : 'Confirm';

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
  const handleRetryFeeEstimation = useCallback(() => {
    forceRefreshFee();
  }, [forceRefreshFee]);

  const handleCancel = useCallback(() => {
    navigation.pop();
  }, [navigation]);

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

    // Step 4: Sign and send transactions
    try {
      const result = await serviceSend.batchSignAndSendTransaction({
        accountId,
        networkId,
        unsignedTxs: newUnsignedTxs,
        feeInfos: feeState.feeInfos,
        signOnly: false,
        transferPayload: undefined,
      });

      // Step 5: Show success toast
      Toast.success({
        title: intl.formatMessage({
          id: ETranslations.feedback_transaction_submitted,
        }),
      });

      setIsSubmitting(false);
      onSuccess?.(result);

      // Step 6: Handle QR account navigation
      if (accountUtils.isQrAccount({ accountId })) {
        navigation.popStack();
      } else {
        navigation.pop();
      }
    } catch (e: any) {
      // Handle QR account navigation on error
      if (accountUtils.isQrAccount({ accountId })) {
        navigation.popStack();
      }
      setIsSubmitting(false);
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
    isSubmitting;

  return (
    <Page scrollEnabled>
      <Page.Header title="Review transaction" />
      <Page.Body>
        <YStack>
          {/* Fee Error Alert - Top Section */}
          <BulkSendReviewAlert onRetry={handleRetryFeeEstimation} />

          {/* Grand Summary - Top Section */}
          <BulkSendReviewGrandSummary />

          {/* Approval Card - Show if there are approvals */}
          {approvesInfo.length > 0 ? (
            <BulkSendApprovalCard onEditApproval={handleEditApproval} />
          ) : null}

          {/* Cost Card - Middle Section */}
          <BulkSendReviewCostCard
            feeLevel={feeLabel}
            isMultiTxs={isMultiTxs}
            onFeeChange={handleFeeChange}
            editFeeEnabled={vaultSettings?.editFeeEnabled}
          />

          {/* Transaction Details - Bottom Section */}
          <BulkSendTxDetails
            editMode={false}
            tokenInfo={tokenInfo}
            transfersInfo={transfersInfo}
          />
        </YStack>
      </Page.Body>
      <Page.Footer>
        <Page.FooterActions
          onConfirmText={confirmButtonText}
          onCancelText="Cancel"
          cancelButtonProps={{
            onPress: handleCancel,
          }}
          confirmButtonProps={{
            onPress: handleConfirm,
            disabled: isConfirmDisabled,
            loading: isSubmitting,
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
