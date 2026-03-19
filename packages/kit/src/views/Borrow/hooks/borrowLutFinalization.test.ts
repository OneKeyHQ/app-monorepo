import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import {
  getBorrowLutFinalizationErrorTranslation,
  mapBorrowLutFinalizationToTxStatus,
} from './borrowLutFinalization';

describe('borrowLutFinalization', () => {
  it('maps timeout to pending instead of failed', () => {
    expect(mapBorrowLutFinalizationToTxStatus('timeout')).toBe(
      EDecodedTxStatus.Pending,
    );
    expect(getBorrowLutFinalizationErrorTranslation('timeout')).toBe(
      ETranslations.global_failed,
    );
  });

  it('keeps failed finalization as failed', () => {
    expect(mapBorrowLutFinalizationToTxStatus('failed')).toBe(
      EDecodedTxStatus.Failed,
    );
    expect(getBorrowLutFinalizationErrorTranslation('failed')).toBe(
      ETranslations.global_failed,
    );
  });
});
