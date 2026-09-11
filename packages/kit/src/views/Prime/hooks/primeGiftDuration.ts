import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IPrimeGiftEligibility } from '@onekeyhq/shared/types/prime/primeGiftTypes';

import type { IntlShape } from 'react-intl';

export function getPrimeGiftDurationText(
  {
    giftMonths,
    giftDays,
  }: Partial<Pick<IPrimeGiftEligibility, 'giftMonths' | 'giftDays'>>,
  intl: Pick<IntlShape, 'formatMessage'>,
) {
  if (typeof giftMonths === 'number' && giftMonths > 0) {
    return intl.formatMessage(
      { id: ETranslations.prime_gift_months__desc },
      { count: giftMonths },
    );
  }
  if (typeof giftDays === 'number' && giftDays > 0) {
    return intl.formatMessage(
      { id: ETranslations.prime_gift_days__desc },
      { count: giftDays },
    );
  }
  return '';
}
