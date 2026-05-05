import { Image } from 'react-native';

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

export const DEFAULT_FOOTER_TEXT = 'Scan to start your Web3 journey';
export const DEFAULT_REFERRAL_LABEL = 'Referral Code:';
export const DEFAULT_DOWNLOAD_TITLE = 'Scan to try OneKey';
export const DEFAULT_DOWNLOAD_SUBTITLE =
  'Your most secure crypto wallet, everywhere.';
export const DEFAULT_QR_CAPTION = 'SCAN TO JOIN';

export const resolveFooterCtaText = (
  referralCode: string | undefined,
  footerText?: string,
): string =>
  referralCode ? footerText || DEFAULT_FOOTER_TEXT : DEFAULT_DOWNLOAD_TITLE;

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
