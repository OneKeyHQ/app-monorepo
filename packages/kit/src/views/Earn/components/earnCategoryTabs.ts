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

/**
 * Flat home sections on mobile (OK-58506):
 *  - Trending tokens (SimpleEarn; Staking assets are merged into this section)
 *  - Fixed income
 * No standalone Staked section. The desktop TabView / search dialog still
 * use buildEarnAvailableAssetCategoryTabs and are unaffected.
 */
export function buildEarnHomeFlatSections(
  intl: Pick<IntlShape, 'formatMessage'>,
): IEarnAvailableAssetCategoryTab[] {
  return [
    {
      type: EAvailableAssetsTypeEnum.SimpleEarn,
      title: intl.formatMessage({
        id: ETranslations.trending_tokens__title,
      }),
    },
    {
      type: EAvailableAssetsTypeEnum.FixedRate,
      title: getEarnAvailableAssetCategoryTitle(
        intl,
        EAvailableAssetsTypeEnum.FixedRate,
      ),
    },
  ];
}
