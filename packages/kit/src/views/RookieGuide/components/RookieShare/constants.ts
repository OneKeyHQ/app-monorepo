import { Image } from 'react-native';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import { getLocaleMessages } from '@onekeyhq/shared/src/locale/getDefaultLocale';
import { LOCALES, enUS } from '@onekeyhq/shared/src/locale/localeJsonMap';
import type { ILocaleJSONSymbol } from '@onekeyhq/shared/src/locale/type';

// Canvas configuration for Rookie Share image generation
// Based on Figma design: 640x640 square

const BASE_SIZE = 640;

export const getCanvasConfig = (currentSize: number = BASE_SIZE) => {
  const scale = (value: number, round = false): number =>
    round
      ? Math.round(value * (currentSize / BASE_SIZE))
      : value * (currentSize / BASE_SIZE);

  return {
    size: currentSize,

    background: {
      color: '#4bf55c',
    },

    card: {
      width: scale(576),
      borderRadius: scale(24),
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      shadowColor: 'rgba(0, 0, 0, 0.25)',
      shadowBlur: scale(24),
      shadowOffsetY: scale(4),
      padding: scale(50),
      x: scale(32),
      y: scale(42),
    },

    badge: {
      width: scale(156),
      height: scale(162),
      marginBottom: scale(22),
    },

    fonts: {
      title: {
        size: scale(24),
        weight: 500,
        color: '#000000',
        lineHeight: 1.5,
        maxWidth: scale(476),
      },
      subtitle: {
        size: scale(14),
        weight: 500,
        color: 'rgba(0, 0, 0, 0.5)',
        lineHeight: 1.2,
        maxWidth: scale(476),
      },
      footerCta: {
        size: scale(16),
        weight: 500,
        color: '#000000',
        lineHeight: 1.3,
      },
      referralLabel: {
        size: scale(14),
        weight: 500,
        color: 'rgba(0, 0, 0, 0.5)',
        lineHeight: 1.2,
      },
      referralCode: {
        size: scale(14),
        weight: 500,
        color: '#007317',
        letterSpacing: scale(1),
        lineHeight: 1.2,
        monoFontFamily:
          'GeistMono-Medium, GeistMono-Regular, ui-monospace, SFMono-Regular, Menlo, monospace',
      },
      qrCaption: {
        size: scale(10),
        weight: 600,
        color: 'rgba(0, 0, 0, 0.6)',
        letterSpacing: scale(0.8),
        lineHeight: 1.2,
      },
    },

    // Subtle green tint + 1px top divider bridges footer to the main card's
    // green gradient.
    footer: {
      y: scale(504),
      height: scale(136),
      backgroundColor: '#f6fdf7',
      borderTopColor: 'rgba(0, 115, 23, 0.08)',
      borderTopWidth: scale(1),
      paddingX: scale(32),
      paddingY: scale(20),
    },

    logo: {
      size: scale(64),
      footerOffsetY: scale(-4),
    },

    qrCode: {
      size: scale(88),
      color: '#007317',
    },

    referralPill: {
      backgroundColor: 'rgba(41, 223, 38, 0.12)',
      paddingX: scale(8),
      paddingY: scale(2),
      borderRadius: scale(999),
    },

    spacing: {
      cardBadgeTitleGap: scale(22),
      cardTitleSubtitleGap: scale(10),
      footerLogoTextGap: scale(12),
      footerTextLineGap: scale(6),
      footerReferralInlineGap: scale(6),
      qrCaptionGap: scale(6),
    },
  };
};

export type IRookieShareLocaleText = {
  footerText: string;
  referralLabel: string;
  downloadTitle: string;
  downloadSubtitle: string;
  qrCaption: string;
};

const DEFAULT_ROOKIE_SHARE_LOCALE: ILocaleJSONSymbol = 'en-US';

const LOCALE_KEY_BY_NORMALIZED = Object.keys(LOCALES).reduce<
  Record<string, ILocaleJSONSymbol>
>((result, locale) => {
  result[locale.toLowerCase()] = locale as ILocaleJSONSymbol;
  return result;
}, {});

const LOCALE_KEYS = Object.keys(LOCALES) as ILocaleJSONSymbol[];

function normalizeLocaleInput(locale?: string): string | undefined {
  const normalizedLocale = locale?.trim().replace(/_/g, '-').toLowerCase();
  if (!normalizedLocale || normalizedLocale === 'system') return undefined;
  return normalizedLocale;
}

function normalizeLocale(locale?: string): ILocaleJSONSymbol | undefined {
  const normalizedLocale = normalizeLocaleInput(locale);
  if (!normalizedLocale) return undefined;

  const [language] = normalizedLocale.split('-');
  if (language === 'en') return DEFAULT_ROOKIE_SHARE_LOCALE;

  const localeKey = LOCALE_KEY_BY_NORMALIZED[normalizedLocale];
  if (localeKey) return localeKey;

  return (
    LOCALE_KEY_BY_NORMALIZED[language] ||
    LOCALE_KEYS.find((key) => key.toLowerCase().startsWith(`${language}-`))
  );
}

function resolveLocale(
  locale?: string,
  fallbackLocale?: string,
): ILocaleJSONSymbol {
  const normalizedLocale = normalizeLocale(locale);
  if (normalizedLocale) return normalizedLocale;
  if (normalizeLocaleInput(locale)) return DEFAULT_ROOKIE_SHARE_LOCALE;
  return normalizeLocale(fallbackLocale) || DEFAULT_ROOKIE_SHARE_LOCALE;
}

type ILocaleMessageMap = Record<string, string>;

function unwrapLocaleMessages(messages: unknown): ILocaleMessageMap {
  const moduleDefault = (messages as { default?: ILocaleMessageMap })?.default;
  return moduleDefault || (messages as ILocaleMessageMap);
}

async function loadLocaleMessages(
  locale: ILocaleJSONSymbol,
): Promise<ILocaleMessageMap> {
  try {
    const messages = await getLocaleMessages(locale);
    return unwrapLocaleMessages(messages);
  } catch {
    if (locale === DEFAULT_ROOKIE_SHARE_LOCALE) return {};
    const messages = await getLocaleMessages(DEFAULT_ROOKIE_SHARE_LOCALE);
    return unwrapLocaleMessages(messages);
  }
}

function getMessage(
  messages: ILocaleMessageMap,
  fallbackMessages: ILocaleMessageMap,
  id: ETranslations,
): string {
  return messages[id] || fallbackMessages[id] || id;
}

function buildRookieShareLocaleText(
  messages: ILocaleMessageMap,
  fallbackMessages: ILocaleMessageMap,
): IRookieShareLocaleText {
  return {
    footerText: getMessage(
      messages,
      fallbackMessages,
      ETranslations.rookie_share_footer_text,
    ),
    referralLabel: getMessage(
      messages,
      fallbackMessages,
      ETranslations.rookie_share_referral_code_label,
    ),
    downloadTitle: getMessage(
      messages,
      fallbackMessages,
      ETranslations.rookie_share_download_title,
    ),
    downloadSubtitle: getMessage(
      messages,
      fallbackMessages,
      ETranslations.rookie_share_download_subtitle,
    ),
    qrCaption: getMessage(
      messages,
      fallbackMessages,
      ETranslations.rookie_share_qr_caption,
    ),
  };
}

export const DEFAULT_ROOKIE_SHARE_LOCALE_TEXT = buildRookieShareLocaleText(
  enUS as ILocaleMessageMap,
  {},
);

export async function resolveRookieShareLocaleText(
  locale?: string,
  fallbackLocale?: string,
): Promise<IRookieShareLocaleText> {
  const resolvedLocale = resolveLocale(locale, fallbackLocale);
  const [messages, fallbackMessages] = await Promise.all([
    loadLocaleMessages(resolvedLocale),
    resolvedLocale === DEFAULT_ROOKIE_SHARE_LOCALE
      ? Promise.resolve({} as ILocaleMessageMap)
      : loadLocaleMessages(DEFAULT_ROOKIE_SHARE_LOCALE),
  ]);

  return buildRookieShareLocaleText(messages, fallbackMessages);
}

export const resolveFooterCtaText = (
  referralCode: string | undefined,
  footerText: string | undefined,
  localeText: IRookieShareLocaleText,
): string =>
  referralCode ? footerText || localeText.footerText : localeText.downloadTitle;

// Webpack returns a URL string; Metro returns a numeric asset id requiring resolveAssetSource.
const logoAsset = require('@onekeyhq/kit/assets/logo.png') as number | string;

export const ONEKEY_LOGO_URL =
  typeof logoAsset === 'string'
    ? logoAsset
    : Image.resolveAssetSource(logoAsset).uri;

export const CANVAS_CONFIG = getCanvasConfig(BASE_SIZE);

export const BACKGROUND_GRADIENT_COLORS = [
  '#4bf55c',
  '#77ff90',
  '#29df26',
  '#007317',
];
