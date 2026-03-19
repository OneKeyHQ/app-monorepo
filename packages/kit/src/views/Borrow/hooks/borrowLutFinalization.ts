import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

export type IBorrowLutFinalizationResult = 'finalized' | 'failed' | 'timeout';

export const mapBorrowLutFinalizationToTxStatus = (
  result: IBorrowLutFinalizationResult,
) => {
  switch (result) {
    case 'finalized':
      return EDecodedTxStatus.Confirmed;
    case 'failed':
      return EDecodedTxStatus.Failed;
    case 'timeout':
    default:
      return EDecodedTxStatus.Pending;
  }
};

export const getBorrowLutFinalizationErrorTranslation = (
  _result: Exclude<IBorrowLutFinalizationResult, 'finalized'>,
) => ETranslations.global_failed;
