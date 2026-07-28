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
 * 移动端首页平铺分区 (OK-58506)：
 *  - Trending tokens (SimpleEarn，Staking 资产并入本分区展示)
 *  - Fixed income
 * 不含独立 Staked 分区。桌面端 TabView / 搜索弹窗仍用
 * buildEarnAvailableAssetCategoryTabs，不受影响。
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
