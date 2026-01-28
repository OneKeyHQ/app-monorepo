import { useCallback, useMemo, useState } from 'react';

import { Page, YStack } from '@onekeyhq/components';
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

import BulkSendApprovalCard from './components/BulkSendApprovalCard';
import BulkSendReviewCostCard from './components/BulkSendReviewCostCard';
import BulkSendReviewGrandSummary from './components/BulkSendReviewGrandSummary';
import BulkSendTxDetails from '../../components/BulkSendTxDetails';
import { showStandaloneApproveEditor } from './components/StandaloneApproveEditor';

import {
  BulkSendReviewContext,
  useBulkSendReviewContext,
} from './components/Context';

function BaseBulkSendReview() {
  const {
    networkId,
    accountId,
    tokenInfo,
    transfersInfo,
    networkImageUri,
    approvesInfo,
    totalTokenAmount,
    totalFiatAmount,
    setApprovesInfo,
  } = useBulkSendReviewContext();

  const navigation = useAppNavigation();

  // Mock data for cost card (will be replaced with real data later)
  const costCardData = useMemo(
    () => ({
      networkFee: '0.0021 ETH',
      networkFeeFiat: '$4.97',
      feeLevel: 'Normal',
      interval: '15 - 50 Seconds',
    }),
    [],
  );

  // Determine button text based on whether approvals are needed
  const confirmButtonText = approvesInfo.length > 0 ? 'Approve and Confirm' : 'Confirm';

  // Handle editing approval amount
  const handleEditApproval = useCallback(
    (index: number) => {
      const approveInfo = approvesInfo[index];
      if (!approveInfo || !accountId || !networkId) return;

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
        originalAllowance: approveInfo.amount,
        originalIsUnlimited: approveInfo.isMax ?? false,
        onConfirm: ({ allowance, isUnlimited }) => {
          setApprovesInfo((prev) => {
            const newApprovesInfo = [...prev];
            newApprovesInfo[index] = {
              ...newApprovesInfo[index],
              amount: allowance,
              isMax: isUnlimited,
            };
            return newApprovesInfo;
          });
        },
        onReset: () => {
          // Reset to original value
          setApprovesInfo((prev) => {
            const newApprovesInfo = [...prev];
            newApprovesInfo[index] = {
              ...newApprovesInfo[index],
              amount: approveInfo.amount,
              isMax: approveInfo.isMax,
            };
            return newApprovesInfo;
          });
        },
      });
    },
    [approvesInfo, accountId, networkId, setApprovesInfo],
  );

  const handleCancel = useCallback(() => {
    navigation.pop();
  }, [navigation]);

  const handleConfirm = useCallback(() => {
    // TODO: Implement confirm logic - sign and send transactions
    console.log('Confirm pressed');
  }, []);

  return (
    <Page scrollEnabled>
      <Page.Header title="Review transaction" />
      <Page.Body>
        <YStack>
          {/* Grand Summary - Top Section */}
          <BulkSendReviewGrandSummary
            tokenInfo={tokenInfo}
            networkImageUri={networkImageUri}
            totalTokenAmount={totalTokenAmount}
            totalFiatAmount={totalFiatAmount}
          />

          {/* Approval Card - Show if there are approvals */}
          {approvesInfo.length > 0 ? (
            <BulkSendApprovalCard
              approvesInfo={approvesInfo}
              networkImageUri={networkImageUri}
              onEditApproval={handleEditApproval}
            />
          ) : null}

          {/* Cost Card - Middle Section */}
          <BulkSendReviewCostCard
            networkFee={costCardData.networkFee}
            networkFeeFiat={costCardData.networkFeeFiat}
            feeLevel={costCardData.feeLevel}
            interval={costCardData.interval}
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
  } = route.params ?? {};

  // Local state for approves info (can be modified by editor)
  const [approvesInfo, setApprovesInfo] = useState<IApproveInfo[]>(
    initialApprovesInfo ?? [],
  );

  // Local state for unsigned transactions (may need to be updated)
  const [unsignedTxs, setUnsignedTxs] = useState<IUnsignedTxPro[]>(
    initialUnsignedTxs ?? [],
  );

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
      approvesInfo,
      setApprovesInfo,
      unsignedTxs,
      setUnsignedTxs,
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
    ],
  );

  if (!tokenInfo || !transfersInfo) {
    return null;
  }

  return (
    <BulkSendReviewContext.Provider value={contextValue}>
      <BaseBulkSendReview />
    </BulkSendReviewContext.Provider>
  );
}

export default BulkSendReview;
