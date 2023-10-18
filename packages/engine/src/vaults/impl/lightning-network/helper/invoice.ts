import { TransactionStatus } from '@onekeyhq/engine/src/types/provider';

import { InvoiceStatusEnum } from '../types/invoice';

export function getInvoiceTransactionStatus(status: InvoiceStatusEnum) {
  if (
    status === InvoiceStatusEnum.StateOpen ||
    status === InvoiceStatusEnum.StateInitialized
  ) {
    return TransactionStatus.PENDING;
  }
  if (status === InvoiceStatusEnum.StateSettled) {
    return TransactionStatus.CONFIRM_AND_SUCCESS;
  }
  if (status === InvoiceStatusEnum.StateError) {
    return TransactionStatus.CONFIRM_BUT_FAILED;
  }
}
