import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EAvailableAssetsTypeEnum } from '@onekeyhq/shared/types/earn';

import type { IntlShape } from 'react-intl';

export type IEarnAvailableAssetCategoryTab = {
  title: string;
  type: EAvailableAssetsTypeEnum;
};

function getEarnAvailableAssetCategoryTranslationId(
  categoryType: EAvailableAssetsTypeEnum,
) {
  switch (categoryType) {
    case EAvailableAssetsTypeEnum.FixedRate:
      return ETranslations.earn_fixed_income;
    case EAvailableAssetsTypeEnum.Staking:
      return ETranslations.wallet_defi_position_module_staked;
    case EAvailableAssetsTypeEnum.SimpleEarn:
    default:
      return ETranslations.defi_simple_earn;
  }
}

export function getEarnAvailableAssetCategoryTitle(
  intl: Pick<IntlShape, 'formatMessage'>,
  categoryType: EAvailableAssetsTypeEnum,
) {
  return intl.formatMessage({
    id: getEarnAvailableAssetCategoryTranslationId(categoryType),
  });
}

export function buildEarnAvailableAssetCategoryTabs(
  intl: Pick<IntlShape, 'formatMessage'>,
): IEarnAvailableAssetCategoryTab[] {
  return [
    EAvailableAssetsTypeEnum.SimpleEarn,
    EAvailableAssetsTypeEnum.FixedRate,
    EAvailableAssetsTypeEnum.Staking,
  ].map((type) => ({
    type,
    title: getEarnAvailableAssetCategoryTitle(intl, type),
  }));
}
