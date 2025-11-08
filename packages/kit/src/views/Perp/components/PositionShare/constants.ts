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

// Base configuration at 1080px
const BASE_SIZE = 1080;
const CURRENT_SIZE = 900;

// Helper function to scale values
const scale = (value: number, round = false) =>
  round
    ? Math.round(value * (CURRENT_SIZE / BASE_SIZE))
    : value * (CURRENT_SIZE / BASE_SIZE);

export const CANVAS_CONFIG: ICanvasConfig = {
  size: CURRENT_SIZE,
  padding: scale(60, true),

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
    coin: scale(67.5),
    side: scale(24),
    pnl: scale(180),
    priceLabel: scale(25),
    priceValue: scale(25),
  },

  layout: {
    tokenSize: scale(67.5),
    stickerSize: scale(200, true),
    referralHeight: scale(216, true),
    tokenY: scale(250, true),
    tokenOffsetX: scale(13.5),
    pnlY: scale(426, true),
    entryPriceY: scale(580, true),
    markPriceY: scale(700, true),
    priceSpacingY: scale(40, true),
    badgePaddingX: scale(20, true),
    badgePaddingY: scale(18, true),
    tokenSpacing: scale(40, true),
    priceGap: scale(1.5),
    referralOffset: scale(20, true),
    lineHeight: 1.2,
    badgeRadius: scale(58, true),
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
