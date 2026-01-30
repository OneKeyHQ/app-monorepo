import { YStack } from '@onekeyhq/components';
import { EAmountInputMode } from '@onekeyhq/shared/types/bulkSend';

import BulkSendTxDetails from '../../../components/BulkSendTxDetails';

import { AmountInputSection } from './AmountInput';
import { useBulkSendAmountsInputContext } from './Context';
import { useTransferInfoActions } from './useTransferInfoActions';

function MobileLayout() {
  const {
    tokenInfo,
    transfersInfo,
    transferInfoErrors,
    amountInputMode,
    bulkSendMode,
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

  const isEditMode = amountInputMode === EAmountInputMode.Custom;

  return (
    <YStack>
      <AmountInputSection />
      <BulkSendTxDetails
        tokenInfo={tokenInfo}
        editMode={isEditMode}
        transfersInfo={transfersInfo}
        transferInfoErrors={transferInfoErrors}
        bulkSendMode={bulkSendMode}
        onDeleteTransfer={handleDeleteTransfer}
        onAmountChange={isEditMode ? handleAmountChange : undefined}
      />
    </YStack>
  );
}

export default MobileLayout;
