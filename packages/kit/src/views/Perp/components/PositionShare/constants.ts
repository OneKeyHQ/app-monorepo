import BigNumber from 'bignumber.js';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { ICanvasConfig, IPnlDisplayMode, IShareData } from './types';

export const SHOW_REFERRAL_CODE = true;

const CDN_BASE_URL = 'https://uni.onekey-asset.com/static/perps';

const BACKGROUND_FILE_NAMES = {
  neutral: [
    'share_bg_neutral.png',
    'share_bg_neutral_green.png',
    'share_bg_neutral_red.png',
  ],
  profit: [
    'perp_referral_profit.png',
    'share_bg_profit_green.png',
    'share_bg_profit_yellow.png',
    'share_bg_profit_red.png',
  ],
  loss: [
    'perp_referral_loss.png',
    'share_bg_loss_green.png',
    'share_bg_loss_red.png',
  ],
} as const;

function getBackgroundUrl(filename: string): string {
  return `${CDN_BASE_URL}/${filename}`;
}

export const BACKGROUNDS: {
  neutral: string[];
  profit: string[];
  loss: string[];
} = {
  neutral: BACKGROUND_FILE_NAMES.neutral.map(getBackgroundUrl),
  profit: BACKGROUND_FILE_NAMES.profit.map(getBackgroundUrl),
  loss: BACKGROUND_FILE_NAMES.loss.map(getBackgroundUrl),
};

export function getBackgroundUrlByIndex(
  type: 'neutral' | 'profit' | 'loss',
  index: number,
): string {
  const fileNames = BACKGROUND_FILE_NAMES[type];
  if (index < 0 || index >= fileNames.length) {
    return getBackgroundUrl(fileNames[0]);
  }
  return getBackgroundUrl(fileNames[index]);
}

export function getAllBackgroundUrls(): string[] {
  return [
    ...BACKGROUND_FILE_NAMES.neutral.map(getBackgroundUrl),
    ...BACKGROUND_FILE_NAMES.profit.map(getBackgroundUrl),
    ...BACKGROUND_FILE_NAMES.loss.map(getBackgroundUrl),
  ];
}

export const STICKERS = ['🤑', '😎', '😭', '💀', '🤔'];

export const DEFAULT_PNL_DISPLAY_MODE: IPnlDisplayMode = 'roe';

export function getPnlDisplayInfo(
  data: IShareData,
  mode: IPnlDisplayMode,
): string {
  if (mode === 'pnl') {
    const pnlBn = new BigNumber(data.pnl || '0');
    const pnlAbs = pnlBn.abs();
    if (pnlAbs.lt(0.01)) {
      return `${pnlBn.lt(0) ? '-' : '+'}< $0.01`;
    }
    const pnlStr = pnlAbs.toFixed();
    const decimalIndex = pnlStr.indexOf('.');

    const pnlFormatted =
      decimalIndex !== -1 && pnlStr.length - decimalIndex - 1 > 2
        ? pnlAbs.toFixed(2, BigNumber.ROUND_DOWN)
        : pnlStr;

    return `${pnlBn.lt(0) ? '-' : '+'}$${pnlFormatted}`;
  }

  const pnlPercentBn = new BigNumber(data.pnlPercent || '0');
  const pnlPercentText = pnlPercentBn.abs().toFixed(2);
  const pnlPercentSign = pnlPercentBn.gte(0) ? '+' : '-';
  return `${pnlPercentSign}${pnlPercentText}%`;
}

export function getDefaultShareText({
  side,
  coin,
  displayName,
  mode = 'perp',
}: {
  side: IShareData['side'];
  coin: string;
  displayName?: string;
  mode?: IShareData['mode'];
}): string {
  const name = displayName || coin;
  if (mode === 'spot') {
    const action = side === 'long' ? 'BUY' : 'SELL';
    return `Check out my ${action} spot trade on ${name}! 🚀`;
  }

  return `Check out my ${side.toUpperCase()} position on ${name}! 🚀`;
}

export function getSharePriceLabelIds({
  mode,
  priceType = 'mark',
}: Pick<IShareData, 'mode' | 'priceType'>): {
  entryPriceLabelId: ETranslations;
  markPriceLabelId: ETranslations;
} {
  if (mode === 'spot') {
    return {
      entryPriceLabelId: ETranslations.perp_spot_average_cost_price__title,
      markPriceLabelId: ETranslations.perp_spot_current_price__title,
    };
  }

  return {
    entryPriceLabelId: ETranslations.perp_position_entry_price,
    markPriceLabelId:
      priceType === 'exit'
        ? ETranslations.perp_position_exit_price
        : ETranslations.perp_position_mark_price,
  };
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
      long: '#44D62C',
      short: '#FF0000',
      textPrimary: '#ffffff',
      textSecondary: '#FFFFFF',
      textTertiary: '#ffffff',
      referralBackground: '#000000B3',
      sideLongBackground: '#073100',
      sideShortBackground: '#3F0000',
    },

    fonts: {
      coin: scale(67.5, currentSize),
      side: scale(28, currentSize),
      pnl: scale(180, currentSize),
      priceLabel: scale(28, currentSize),
      priceValue: scale(28, currentSize),
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
      priceSpacingY: scale(50, currentSize, true),
      badgePaddingX: scale(20, currentSize, true),
      badgePaddingY: scale(18, currentSize, true),
      tokenSpacing: scale(48, currentSize, true),
      priceGap: scale(8, currentSize),
      referralOffset: scale(25, currentSize, true),
      lineHeight: 1.2,
      badgeRadius: scale(58, currentSize, true),
      labelOpacity: 0.5,
      qrCodeSize: scale(120, currentSize, true),
      qrCodeSpacing: scale(20, currentSize, true),
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
