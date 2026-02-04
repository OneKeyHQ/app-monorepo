import { useIntl } from 'react-intl';

import { Icon, SizableText, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EAmountInputMode } from '@onekeyhq/shared/types/bulkSend';

import BulkSendTxDetails from '../../../components/BulkSendTxDetails';

import { AmountInputSection } from './AmountInput';
import { useBulkSendAmountsInputContext } from './Context';
import { useAmountPreview } from './useAmountPreview';
import { useTransferInfoActions } from './useTransferInfoActions';

function MobileLayout() {
  const intl = useIntl();
  const {
    tokenInfo,
    tokenDetails,
    amountInputMode,
    bulkSendMode,
    previewState,
    setPreviewState,
    // Shared transfersInfo (base addresses) for generating preview
    transfersInfo: baseTransfersInfo,
    // Mobile uses currentModeData for mode-specific data
    currentModeData,
    updateCurrentModeData,
  } = useBulkSendAmountsInputContext();

  // Use mode-specific data for mobile display
  const {
    transfersInfo: modeTransfersInfo,
    transferInfoErrors,
    isInsufficientBalance,
    totalTokenAmount,
  } = currentModeData;

  // For display: use mode-specific data if available, otherwise use base
  const displayTransfersInfo =
    modeTransfersInfo.length > 0 ? modeTransfersInfo : baseTransfersInfo;

  // Create setters that update current mode's data
  const setModeTransfersInfo = (newTransfersInfo: typeof modeTransfersInfo) => {
    updateCurrentModeData({ transfersInfo: newTransfersInfo });
  };

  const setTransferInfoErrors = (newErrors: typeof transferInfoErrors) => {
    updateCurrentModeData({ transferInfoErrors: newErrors });
  };

  const { handleDeleteTransfer, handleAmountChange } = useTransferInfoActions({
    tokenInfo,
    transfersInfo: displayTransfersInfo,
    setTransfersInfo: setModeTransfersInfo,
    transferInfoErrors,
    setTransferInfoErrors,
  });

  // Use base transfersInfo for generating preview (has addresses)
  // but setTransfersInfo updates mode-specific data
  const { shouldShowTxDetails } = useAmountPreview({
    tokenInfo,
    transfersInfo: baseTransfersInfo,
    setTransfersInfo: setModeTransfersInfo,
    previewState,
    setPreviewState,
  });

  const isEditMode = amountInputMode === EAmountInputMode.Custom;
  const showTxDetails = shouldShowTxDetails(amountInputMode);

  // Only show insufficient balance error in Custom mode
  // In Specified/Range modes, the user hasn't confirmed the amounts yet
  const showInsufficientBalanceError = isEditMode && isInsufficientBalance;

  return (
    <YStack gap="$6">
      <AmountInputSection />
      {/* Insufficient Balance Error - only shown in Custom mode */}
      {showInsufficientBalanceError ? (
        <XStack gap="$1" alignItems="center">
          <Icon name="InfoCircleOutline" size="$4" color="$iconCritical" />
          <SizableText size="$bodySm" color="$textCritical">
            {intl.formatMessage(
              {
                id: ETranslations.wallet_bulk_send_insufficient_balance_detail,
              },
              {
                available: tokenDetails?.balanceParsed,
                symbol: tokenInfo.symbol,
                total: totalTokenAmount,
              },
            )}
          </SizableText>
        </XStack>
      ) : null}
      {showTxDetails ? (
        <BulkSendTxDetails
          tokenInfo={tokenInfo}
          editMode={isEditMode}
          transfersInfo={displayTransfersInfo}
          transferInfoErrors={transferInfoErrors}
          bulkSendMode={bulkSendMode}
          onDeleteTransfer={handleDeleteTransfer}
          onAmountChange={isEditMode ? handleAmountChange : undefined}
        />
      ) : null}
    </YStack>
  );
}

export default MobileLayout;
