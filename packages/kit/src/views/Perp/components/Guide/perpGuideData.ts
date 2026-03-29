import { HELP_CENTER_URL } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  openUrlExternal,
  openUrlInDiscovery,
} from '@onekeyhq/shared/src/utils/openUrlUtils';

export type IPerpGuideArticle = {
  titleId: ETranslations;
  descriptionId: ETranslations;
  articleSlug: string;
};

export type IPerpGuideCategory = {
  titleId: ETranslations;
  articles: IPerpGuideArticle[];
};

// Intercom help center supported language codes
// Unsupported app locales (id, it-IT, hi-IN, bn, uk-UA) fallback to 'en'
const localeToHelpCenterLang: Record<string, string> = {
  'en-US': 'en',
  'en': 'en',
  'zh-CN': 'zh-CN',
  'zh-HK': 'zh-TW',
  'zh-TW': 'zh-TW',
  'ja-JP': 'ja',
  'ko-KR': 'ko',
  'de': 'de',
  'ru': 'ru',
  'fr-FR': 'fr',
  'es': 'es',
  'pt-BR': 'pt-BR',
  'pt': 'pt-BR',
  'vi': 'vi',
  'th-TH': 'th',
};

function getHelpCenterLang(): string {
  const currentLocale = appLocale.getLocale();
  return localeToHelpCenterLang[currentLocale] || 'en';
}

export function buildArticleUrl(articleSlug: string): string {
  const lang = getHelpCenterLang();
  return `${HELP_CENTER_URL}/${lang}/articles/${articleSlug}`;
}

export function buildSearchUrl(query: string): string {
  const lang = getHelpCenterLang();
  return `${HELP_CENTER_URL}/${lang}?q=${encodeURIComponent(query)}`;
}

export function openGuideUrl(url: string): void {
  if (platformEnv.isNative || platformEnv.isDesktop) {
    openUrlInDiscovery({ url });
  } else {
    openUrlExternal(url);
  }
}

export const PERP_GUIDE_CATEGORIES: IPerpGuideCategory[] = [
  {
    titleId: ETranslations.perp_guide_getting_started,
    articles: [
      {
        titleId: ETranslations.perp_guide_article_introduction,
        descriptionId: ETranslations.perp_guide_desc_introduction,
        articleSlug: '13987899-onekey-perps-introduction',
      },
      {
        titleId: ETranslations.perp_guide_article_basic_concepts,
        descriptionId: ETranslations.perp_guide_desc_basic_concepts,
        articleSlug: '13988790-basic-concepts-of-futures-trading',
      },
    ],
  },
  {
    titleId: ETranslations.perp_guide_trading_operations,
    articles: [
      {
        titleId: ETranslations.perp_guide_article_open_position,
        descriptionId: ETranslations.perp_guide_desc_open_position,
        articleSlug: '13988742-completing-an-open-position-operation',
      },
      {
        titleId: ETranslations.perp_guide_article_view_close_positions,
        descriptionId: ETranslations.perp_guide_desc_view_close_positions,
        articleSlug: '13988753-viewing-positions-and-closing-positions',
      },
      {
        titleId: ETranslations.perp_guide_article_position_sharing,
        descriptionId: ETranslations.perp_guide_desc_position_sharing,
        articleSlug: '13988794-historical-position-sharing',
      },
    ],
  },
  {
    titleId: ETranslations.perp_guide_funds_and_fees,
    articles: [
      {
        titleId: ETranslations.perp_guide_article_deposit_withdrawal,
        descriptionId: ETranslations.perp_guide_desc_deposit_withdrawal,
        articleSlug:
          '13988073-perps-deposit-withdrawal-and-settlement-currency',
      },
      {
        titleId: ETranslations.perp_guide_article_trading_fees,
        descriptionId: ETranslations.perp_guide_desc_trading_fees,
        articleSlug: '13988593-trading-fee-explanation',
      },
    ],
  },
  {
    titleId: ETranslations.perp_guide_video_tutorials,
    articles: [
      {
        titleId: ETranslations.perp_guide_article_video_tutorials,
        descriptionId: ETranslations.perp_guide_desc_video_tutorials,
        articleSlug: '13990229-video-tutorials',
      },
    ],
  },
];

// Map of contextual field names to their relevant article slugs
export const CONTEXTUAL_ARTICLE_SLUGS = {
  leverage: '13988790-basic-concepts-of-futures-trading',
  marginMode: '13988790-basic-concepts-of-futures-trading',
  tpsl: '13988742-completing-an-open-position-operation',
  enableTrading: '13987899-onekey-perps-introduction',
} as const;
