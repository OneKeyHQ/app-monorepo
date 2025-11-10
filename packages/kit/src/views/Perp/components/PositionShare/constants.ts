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

const BASE_SIZE = 1080;

const scale = (value: number, currentSize: number, round = false) =>
  round
    ? Math.round(value * (currentSize / BASE_SIZE))
    : value * (currentSize / BASE_SIZE);

export function getCanvasConfig(currentSize = 1080): ICanvasConfig {
  return {
    size: currentSize,
    padding: scale(60, currentSize, true),

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
      coin: scale(67.5, currentSize),
      side: scale(24, currentSize),
      pnl: scale(180, currentSize),
      priceLabel: scale(25, currentSize),
      priceValue: scale(25, currentSize),
    },

    layout: {
      tokenSize: scale(67.5, currentSize),
      stickerSize: scale(200, currentSize, true),
      referralHeight: scale(216, currentSize, true),
      tokenY: scale(250, currentSize, true),
      tokenOffsetX: scale(13.5, currentSize),
      pnlY: scale(426, currentSize, true),
      entryPriceY: scale(580, currentSize, true),
      markPriceY: scale(700, currentSize, true),
      priceSpacingY: scale(40, currentSize, true),
      badgePaddingX: scale(20, currentSize, true),
      badgePaddingY: scale(18, currentSize, true),
      tokenSpacing: scale(40, currentSize, true),
      priceGap: scale(1.5, currentSize),
      referralOffset: scale(20, currentSize, true),
      lineHeight: 1.2,
      badgeRadius: scale(58, currentSize, true),
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
}

export const CANVAS_CONFIG = getCanvasConfig();
