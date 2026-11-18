import { ETranslations } from '@onekeyhq/shared/src/locale';

import { getTokenAgeInfo } from '../../utils/tokenListHelpers';

import type { IntlShape } from 'react-intl';

const TOKEN_AGE_TRANSLATION_MAP = {
  hour: ETranslations.dexmarket_token_age_h,
  day: ETranslations.dexmarket_token_age_d,
  month: ETranslations.dexmarket_token_age_m,
  year: ETranslations.dexmarket_token_age_y,
} as const;

/** The localized "2M" / "3d" age of a token, or nothing when it has no first trade. */
export function getTokenAgeLabel(
  intl: IntlShape,
  firstTradeTime?: number,
): string | undefined {
  const ageInfo = getTokenAgeInfo(firstTradeTime);
  if (!ageInfo) {
    return undefined;
  }
  return intl.formatMessage(
    { id: TOKEN_AGE_TRANSLATION_MAP[ageInfo.unit] },
    { amount: ageInfo.amount },
  );
}
