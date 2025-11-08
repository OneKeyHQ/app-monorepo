import bgLossGreen from '@onekeyhq/kit/assets/perps/share_bg_loss_green.png';
import bgLossRed from '@onekeyhq/kit/assets/perps/share_bg_loss_red.png';
import bgNeutral from '@onekeyhq/kit/assets/perps/share_bg_neutral.png';
import bgNeutralGreen from '@onekeyhq/kit/assets/perps/share_bg_neutral_green.png';
import bgNeutralRed from '@onekeyhq/kit/assets/perps/share_bg_neutral_red.png';
import bgProfitGreen from '@onekeyhq/kit/assets/perps/share_bg_profit_green.png';
import bgProfitRed from '@onekeyhq/kit/assets/perps/share_bg_profit_red.png';
import bgProfitYellow from '@onekeyhq/kit/assets/perps/share_bg_profit_yellow.png';

import type { ICanvasConfig } from './types';
import type { ImageSourcePropType } from 'react-native';

export const REFERRAL_CODE = 'https://app.onekey.so/perps/ONEKEY';

export const SHOW_REFERRAL_CODE = true;

export const BACKGROUNDS: {
  neutral: ImageSourcePropType[];
  profit: ImageSourcePropType[];
  loss: ImageSourcePropType[];
} = {
  neutral: [bgNeutral, bgNeutralGreen, bgNeutralRed],
  profit: [bgProfitGreen, bgProfitYellow, bgProfitRed],
  loss: [bgLossGreen, bgLossRed],
};

export const STICKERS = ['🤑', '😎', '😭', '💀', '🤔'];

export function getDefaultShareText(side: string, coin: string): string {
  return `Check out my ${side.toUpperCase()} position on ${coin}! 🚀`;
}

export const CANVAS_CONFIG: ICanvasConfig = {
  size: 1080,
  padding: 60,

  colors: {
    background: ['#1a1a1a', '#0a0a0a', '#1a1a1a'],
    long: '#24FF00',
    short: '#FF0000',
    textPrimary: '#ffffff',
    textSecondary: '#FFFFFF',
    textTertiary: '#ffffff',
    referralBackground: '#00000098',
    sideLongBackground: '#0C5300',
    sideShortBackground: '#630A0A',
  },

  fonts: {
    coin: 67.5,
    side: 24,
    pnl: 180,
    priceLabel: 25,
    priceValue: 25,
  },

  layout: {
    // Size
    tokenSize: 67.5,
    stickerSize: 200,
    referralHeight: 216,
    // Position
    tokenY: 250,
    tokenOffsetX: 13.5,
    pnlY: 426,
    entryPriceY: 580,
    markPriceY: 700,
    priceSpacingY: 40,
    // Spacing
    badgePaddingX: 20,
    badgePaddingY: 18,
    tokenSpacing: 40,
    priceGap: 1.5,
    referralOffset: 20,
    // Style
    lineHeight: 1.2,
    badgeRadius: 58,
    labelOpacity: 0.5,
  },

  display: {
    showTokenIcon: true,
    showCoinName: true,
    showSideAndLeverage: true,
    showPnl: true,
    showEntryPrice: true,
    showMarkPrice: true,
  },
};
