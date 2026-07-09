import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IntlShape } from 'react-intl';

const KYT_RISK_FACTOR_CATEGORY_TRANSLATIONS: Record<string, ETranslations> = {
  sanctioned_entity: ETranslations.kyt_risk_factor_sanctioned_entity__title,
  illicit_activity: ETranslations.kyt_risk_factor_illicit_activity__title,
  mixer: ETranslations.kyt_risk_factor_mixer__title,
  gambling: ETranslations.kyt_risk_factor_gambling__title,
  risk_exchange: ETranslations.kyt_risk_factor_risk_exchange__title,
  bridge: ETranslations.kyt_risk_factor_bridge__title,
};

export function formatKytRiskFactorCategory({
  category,
  intl,
}: {
  category: string;
  intl: IntlShape;
}) {
  const translationId = KYT_RISK_FACTOR_CATEGORY_TRANSLATIONS[category];
  return translationId ? intl.formatMessage({ id: translationId }) : category;
}
