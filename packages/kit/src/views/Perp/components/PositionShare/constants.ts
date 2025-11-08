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
    referralBackground: '#00000080',
  },

  fonts: {
    coin: 67.5,
    side: 24,
    pnl: 180,
    priceLabel: 25,
    priceValue: 25,
    referral: 28,
    customText: 36,
  },

  layout: {
    logoSize: 80,
    tokenSize: 67.5,
    tokenY: 250,
    tokenOffsetX: 13.5,
    tokenOffsetY: 20,
    sideOffsetY: 80,
    pnlY: 426,
    pnlYOffset: 0,
    markPriceY: 700,
    entryPriceY: 580,
    priceSpacingY: 40,
    priceValueOffsetX: 200,
    stickerSize: 200,
    customTextMaxWidth: 850,
    customTextTopOffset: 40,
    customTextLineHeight: 50,
    referralBottomOffset: 40,
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
