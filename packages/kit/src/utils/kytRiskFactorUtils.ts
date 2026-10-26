import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IKytRiskFactor } from '@onekeyhq/shared/types/kyt';

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

// Provider entity values are free text: brand and incident names stay as is,
// but common generic labels are risk subtypes that read better translated.
// Keys are normalized (lowercase, `_` → space).
const KYT_RISK_ENTITY_TRANSLATIONS: Record<string, ETranslations> = {
  'theft': ETranslations.kyt_risk_entity_theft__title,
  'phishing': ETranslations.kyt_risk_entity_phishing__title,
  'fake phishing': ETranslations.kyt_risk_entity_phishing__title,
  'scam': ETranslations.kyt_risk_entity_scam__title,
  'zero transfer scam': ETranslations.kyt_risk_entity_zero_transfer_scam__title,
  'dusting attack': ETranslations.kyt_risk_entity_dusting_attack__title,
  'ransom': ETranslations.kyt_risk_entity_ransom__title,
  'money laundering': ETranslations.kyt_risk_entity_money_laundering__title,
  'usdt banned address':
    ETranslations.kyt_risk_entity_usdt_banned_address__title,
  'ofac sanctions': ETranslations.kyt_risk_entity_ofac_sanctions__title,
  'sanctioned entity': ETranslations.kyt_risk_factor_sanctioned_entity__title,
  'illegal services': ETranslations.kyt_risk_entity_illegal_services__title,
  'guarantee merchant': ETranslations.kyt_risk_entity_guarantee_merchant__title,
};

export function formatKytRiskFactorEntity({
  entity,
  intl,
}: {
  entity: string;
  intl: IntlShape;
}) {
  const normalized = entity
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, ' ');
  const translationId = KYT_RISK_ENTITY_TRANSLATIONS[normalized];
  return translationId ? intl.formatMessage({ id: translationId }) : entity;
}

// Short name for one factor: the entity when the provider gives one,
// otherwise its category.
export function formatKytRiskFactorName({
  factor,
  intl,
}: {
  factor: Pick<IKytRiskFactor, 'entity' | 'category'>;
  intl: IntlShape;
}) {
  return factor.entity
    ? formatKytRiskFactorEntity({ entity: factor.entity, intl })
    : formatKytRiskFactorCategory({ category: factor.category, intl });
}
