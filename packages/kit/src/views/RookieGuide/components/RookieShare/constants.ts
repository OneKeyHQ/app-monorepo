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

    // Background
    background: {
      color: '#4bf55c',
      // Wave pattern should be loaded as background image
    },

    // Content card
    card: {
      width: scale(576),
      borderRadius: scale(24),
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      shadowColor: 'rgba(0, 0, 0, 0.25)',
      shadowBlur: scale(24),
      shadowOffsetY: scale(4),
      padding: scale(50),
      x: scale(32), // (640 - 576) / 2
      y: scale(42), // Approximate top position based on design
    },

    // Badge image
    badge: {
      width: scale(156),
      height: scale(162),
      marginBottom: scale(22),
    },

    // Typography
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
      footerText: {
        size: scale(16),
        weight: 500,
        color: '#000000',
        lineHeight: 1.2,
      },
      referralText: {
        size: scale(13),
        weight: 500,
        color: 'rgba(0, 0, 0, 0.5)',
      },
    },

    // Footer
    footer: {
      y: scale(512),
      height: scale(128),
      backgroundColor: '#ffffff',
      paddingX: scale(32),
      paddingY: scale(16),
    },

    // Logo
    logo: {
      size: scale(64),
    },

    // QR Code
    qrCode: {
      size: scale(96),
    },

    // Layout spacing
    spacing: {
      cardContentGap: scale(22),
      footerLogoTextGap: scale(12),
      footerTextLineGap: scale(12),
    },
  };
};

export const DEFAULT_FOOTER_TEXT = 'Open source and easy to use from day one.';
export const DEFAULT_REFERRAL_LABEL = 'Referral Code:';

// OneKey logo URL - should be replaced with actual asset
export const ONEKEY_LOGO_URL =
  'https://uni.onekey-asset.com/static/logo/onekey-icon-256.png';

// Background image URL - should be exported from Figma
// For now, we'll use a gradient fallback
// Pre-computed config at base size for native ShareContentRenderer
export const CANVAS_CONFIG = getCanvasConfig(BASE_SIZE);

export const BACKGROUND_GRADIENT_COLORS = [
  '#4bf55c', // Primary green
  '#77ff90', // Light green
  '#29df26', // Medium green
  '#007317', // Dark green
];
