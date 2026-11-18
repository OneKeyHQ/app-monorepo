import { HELP_CENTER_URL } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  openUrlExternal,
  openUrlInDiscovery,
} from '@onekeyhq/shared/src/utils/openUrlUtils';

export type IPerpGuideArticle = {
  titleId: ETranslations;
  descriptionId: ETranslations;
  articleId: string;
};

export type IPerpGuideCategory = {
  titleId: ETranslations;
  articles: IPerpGuideArticle[];
};

export function openGuideUrl(url: string): void {
  if (platformEnv.isNative || platformEnv.isDesktop) {
    openUrlInDiscovery({ url });
  } else {
    openUrlExternal(url);
  }
}

export function buildHelpUrl(path: string): string {
  return `${HELP_CENTER_URL}/${path.replace(/^\/+/, '')}`;
}

export const PERP_GUIDE_CATEGORIES: IPerpGuideCategory[] = [
  {
    titleId: ETranslations.perp_guide_getting_started,
    articles: [
      {
        titleId: ETranslations.perp_guide_article_introduction,
        descriptionId: ETranslations.perp_guide_desc_introduction,
        articleId: '13987899',
      },
      {
        titleId: ETranslations.perp_guide_article_basic_concepts,
        descriptionId: ETranslations.perp_guide_desc_basic_concepts,
        articleId: '13988790',
      },
    ],
  },
  {
    titleId: ETranslations.perp_guide_trading_operations,
    articles: [
      {
        titleId: ETranslations.perp_guide_article_spot_trading,
        descriptionId: ETranslations.perp_guide_desc_spot_trading,
        articleId: '14737659',
      },
      {
        titleId: ETranslations.perp_guide_article_open_position,
        descriptionId: ETranslations.perp_guide_desc_open_position,
        articleId: '13988742',
      },
      {
        titleId: ETranslations.perp_guide_article_view_close_positions,
        descriptionId: ETranslations.perp_guide_desc_view_close_positions,
        articleId: '13988753',
      },
      {
        titleId: ETranslations.perp_guide_article_position_sharing,
        descriptionId: ETranslations.perp_guide_desc_position_sharing,
        articleId: '13988794',
      },
    ],
  },
  {
    titleId: ETranslations.perp_guide_funds_and_fees,
    articles: [
      {
        titleId: ETranslations.perp_guide_article_deposit_withdrawal,
        descriptionId: ETranslations.perp_guide_desc_deposit_withdrawal,
        articleId: '13988073',
      },
      {
        titleId: ETranslations.perp_guide_article_trading_fees,
        descriptionId: ETranslations.perp_guide_desc_trading_fees,
        articleId: '13988593',
      },
    ],
  },
  {
    titleId: ETranslations.perp_guide_video_tutorials,
    articles: [
      {
        titleId: ETranslations.perp_guide_article_video_tutorials,
        descriptionId: ETranslations.perp_guide_desc_video_tutorials,
        articleId: '13990229',
      },
    ],
  },
];

// Contextual article IDs for inline help links
export const CONTEXTUAL_ARTICLE_IDS = {
  leverage: '13988790',
  marginMode: '13988790',
  tpsl: '13988742',
  enableTrading: '13987899',
} as const;
