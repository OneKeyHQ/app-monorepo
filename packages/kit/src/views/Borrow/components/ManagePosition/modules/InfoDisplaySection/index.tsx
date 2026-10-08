import { StyleSheet } from 'react-native';

import { Divider, YStack } from '@onekeyhq/components';

import { useManagePositionContext } from '../../ManagePositionContext';

import { ApyInfo } from './ApyInfo';
import { BorrowInfoSectionSkeleton } from './BorrowInfoSectionSkeleton';
import { CollateralInfo } from './CollateralInfo';
import { FeeInfo } from './FeeInfo';
import { HealthFactorInfo } from './HealthFactorInfo';
import { PositionInfo } from './PositionInfo';
import { SwapOrBridgeInfo } from './SwapOrBridgeInfo';

import type { IInfoDisplaySectionProps } from '../../types';

export function InfoDisplaySection({
  showApyDetail: showApyDetailProp,
  showSwapOrBridge = true,
}: IInfoDisplaySectionProps) {
  const { state, actionResult } = useManagePositionContext();

  const {
    action,
    isDisabled,
    token,
    accountId,
    networkId,
    showApyDetail: showApyDetailState,
  } = state;
  const { transactionConfirmation, transactionConfirmationLoading } =
    actionResult;

  const showApyDetail = showApyDetailProp ?? showApyDetailState;

  // Supply always renders info section (no isDisabled check in original code)
  // Other actions check isDisabled
  if (action !== 'supply' && isDisabled) return null;

  if (!transactionConfirmation && transactionConfirmationLoading) {
    return <BorrowInfoSectionSkeleton action={action} />;
  }

  // Check what info items are available
  const hasHealthFactor = !!transactionConfirmation?.healthFactor;
  const hasMySupply = !!transactionConfirmation?.mySupply;
  const hasMyBorrow = !!transactionConfirmation?.myBorrow;
  const hasApyDetail = showApyDetail && !!transactionConfirmation?.apyDetail;
  const hasRefundableFee = !!transactionConfirmation?.refundableFee;
  const hasRefundFee = !!transactionConfirmation?.refundFee;
  const canBeCollateral = transactionConfirmation?.canBeCollateral;
  const usageAsCollateral = transactionConfirmation?.usageAsCollateral;
  // Older responses omit usageAsCollateral; do not infer the collateral switch state.
  const hasCollateralStatus =
    canBeCollateral === false ||
    (canBeCollateral === true && usageAsCollateral !== undefined);

  // Determine if we should show swap/bridge based on action
  const shouldShowSwapOrBridge =
    showSwapOrBridge && token && (action === 'supply' || action === 'repay');

  const hasPrimaryInfo = hasHealthFactor || hasMySupply || hasMyBorrow;
  const hasSecondaryInfo =
    hasApyDetail ||
    hasRefundableFee ||
    hasRefundFee ||
    hasCollateralStatus ||
    shouldShowSwapOrBridge;

  const showInfoSection = hasPrimaryInfo || hasSecondaryInfo;

  if (!showInfoSection) return null;

  // Divider rendering logic differs by action:
  // - Supply: shows divider when token exists and has primary or secondary info
  // - Borrow/Repay: always shows divider
  // - Withdraw: shows divider when has primary info AND has secondary info
  const showDivider = (() => {
    if (action === 'supply') {
      // Supply: complex condition from original code
      return (
        token &&
        (hasHealthFactor ||
          hasMySupply ||
          hasApyDetail ||
          hasRefundableFee ||
          hasCollateralStatus)
      );
    }
    if (action === 'borrow' || action === 'repay') {
      // Borrow/Repay: always show divider
      return true;
    }
    // Withdraw: show divider when both sections have content
    return (hasHealthFactor || hasMySupply) && (hasApyDetail || hasRefundFee);
  })();

  return (
    <YStack
      p="$3.5"
      pt="$5"
      borderRadius="$3"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
    >
      {/* Primary Info (Health Factor, Position) */}
      {hasPrimaryInfo ? (
        <YStack gap="$6">
          {hasHealthFactor ? (
            <HealthFactorInfo
              data={transactionConfirmation.healthFactor!}
              liquidationAt={transactionConfirmation.liquidationAt}
            />
          ) : null}
          {hasMySupply ? (
            <PositionInfo
              type="supply"
              data={transactionConfirmation.mySupply!}
            />
          ) : null}
          {hasMyBorrow ? (
            <PositionInfo
              type="borrow"
              data={transactionConfirmation.myBorrow!}
            />
          ) : null}
        </YStack>
      ) : null}

      {/* Divider based on action-specific logic */}
      {showDivider ? <Divider my="$5" /> : null}

      {/* Secondary Info (APY, Fees, Collateral, Swap) */}
      {hasSecondaryInfo ? (
        <YStack gap="$6">
          {hasApyDetail ? (
            <ApyInfo
              action={action}
              data={transactionConfirmation.apyDetail!}
            />
          ) : null}
          {hasRefundableFee ? (
            <FeeInfo
              type="refundable"
              data={transactionConfirmation.refundableFee!}
            />
          ) : null}
          {hasRefundFee ? (
            <FeeInfo type="refund" data={transactionConfirmation.refundFee!} />
          ) : null}
          {hasCollateralStatus ? (
            <CollateralInfo
              canBeCollateral={canBeCollateral}
              usageAsCollateral={usageAsCollateral}
            />
          ) : null}
          {shouldShowSwapOrBridge ? (
            <SwapOrBridgeInfo
              token={token}
              accountId={accountId}
              networkId={networkId}
            />
          ) : null}
        </YStack>
      ) : null}
    </YStack>
  );
}
