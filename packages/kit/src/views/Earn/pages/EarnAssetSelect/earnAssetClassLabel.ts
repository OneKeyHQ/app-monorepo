import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IEarnAssetType } from '@onekeyhq/shared/types/earn/earnAssetSelect';

import type { IntlShape } from 'react-intl';

// A kind's name, as the Loans filters write it
export function getEarnAssetClassLabel(intl: IntlShape, type: IEarnAssetType) {
  switch (type) {
    case 'stable':
      return intl.formatMessage({
        id: ETranslations.earn_stable_tokens__action,
      });
    case 'other':
      return intl.formatMessage({ id: ETranslations.global_others });
    default:
      return type.toUpperCase();
  }
}
