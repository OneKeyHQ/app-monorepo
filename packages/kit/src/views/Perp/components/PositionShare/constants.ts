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
    long: '#86EA90',
    short: '#ef4444',
    textPrimary: '#ffffff',
    textSecondary: '#ffffff',
    textTertiary: '#ffffff',
  },

  fonts: {
    coin: 80,
    side: 48,
    pnl: 170,
    priceLabel: 32,
    priceValue: 40,
    referral: 28,
    customText: 36,
  },

  layout: {
    logoSize: 80,
    tokenSize: 120,
    tokenY: 150,
    tokenOffsetX: 20,
    tokenOffsetY: 20,
    sideOffsetY: 80,
    pnlYOffset: 0,
    priceSpacingY: 120,
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
