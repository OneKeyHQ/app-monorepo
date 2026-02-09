import { YStack } from '@onekeyhq/components';
import { EAmountInputMode } from '@onekeyhq/shared/types/bulkSend';

import BulkSendTxDetails from '../../../components/BulkSendTxDetails';

import { AmountInputSection } from './AmountInput';
import { useBulkSendAmountsInputContext } from './Context';
import { useAmountPreview } from './useAmountPreview';
import { useTransferInfoActions } from './useTransferInfoActions';

function MobileLayout() {
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
  const { transfersInfo: modeTransfersInfo, transferInfoErrors } =
    currentModeData;

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
    balance: tokenDetails?.balanceParsed,
  });

  const isEditMode = amountInputMode === EAmountInputMode.Custom;
  const showTxDetails = shouldShowTxDetails(amountInputMode);

  return (
    <YStack gap="$6">
      <AmountInputSection />
      {showTxDetails ? (
        <BulkSendTxDetails
          tokenInfo={tokenInfo}
          editMode={isEditMode}
          transfersInfo={displayTransfersInfo}
          transferInfoErrors={transferInfoErrors}
          bulkSendMode={bulkSendMode}
          onDeleteTransfer={handleDeleteTransfer}
          onAmountChange={isEditMode ? handleAmountChange : undefined}
          containerProps={{ mt: '$6' }}
        />
      ) : null}
    </YStack>
  );
}

export default MobileLayout;
