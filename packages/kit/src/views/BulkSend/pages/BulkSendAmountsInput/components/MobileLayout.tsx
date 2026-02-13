import { useCallback } from 'react';

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
    transfersInfo: baseTransfersInfo,
    currentModeData,
    updateCurrentModeData,
  } = useBulkSendAmountsInputContext();

  const { transfersInfo: modeTransfersInfo, transferInfoErrors } =
    currentModeData;

  const displayTransfersInfo =
    modeTransfersInfo.length > 0 ? modeTransfersInfo : baseTransfersInfo;

  const setModeTransfersInfo = useCallback(
    (newTransfersInfo: typeof modeTransfersInfo) => {
      updateCurrentModeData({ transfersInfo: newTransfersInfo });
    },
    [updateCurrentModeData],
  );

  const setTransferInfoErrors = useCallback(
    (newErrors: typeof transferInfoErrors) => {
      updateCurrentModeData({ transferInfoErrors: newErrors });
    },
    [updateCurrentModeData],
  );

  const { handleDeleteTransfer, handleAmountChange } = useTransferInfoActions({
    tokenInfo,
    transfersInfo: displayTransfersInfo,
    setTransfersInfo: setModeTransfersInfo,
    transferInfoErrors,
    setTransferInfoErrors,
  });

  // Use base transfersInfo for generating preview, mode-specific for display
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
