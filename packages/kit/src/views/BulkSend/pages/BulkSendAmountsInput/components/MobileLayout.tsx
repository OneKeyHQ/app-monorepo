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
    transfersInfo,
    transferInfoErrors,
    amountInputMode,
    bulkSendMode,
    previewState,
    setPreviewState,
    setTransfersInfo,
    setTransferInfoErrors,
  } = useBulkSendAmountsInputContext();

  const { handleDeleteTransfer, handleAmountChange } = useTransferInfoActions({
    tokenInfo,
    transfersInfo,
    setTransfersInfo,
    transferInfoErrors,
    setTransferInfoErrors,
  });

  const { shouldShowTxDetails } = useAmountPreview({
    tokenInfo,
    transfersInfo,
    setTransfersInfo,
    previewState,
    setPreviewState,
  });

  const isEditMode = amountInputMode === EAmountInputMode.Custom;
  const showTxDetails = shouldShowTxDetails(amountInputMode);

  return (
    <YStack gap="$12">
      <AmountInputSection />
      {showTxDetails ? (
        <BulkSendTxDetails
          tokenInfo={tokenInfo}
          editMode={isEditMode}
          transfersInfo={transfersInfo}
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
