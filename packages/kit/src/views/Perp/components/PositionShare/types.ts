export interface IShareConfig {
  customText: string;
  stickerIndex: number | null;
  backgroundIndex: number;
}

export interface IShareData {
  side: 'long' | 'short';
  token: string;
  tokenImageUrl?: string;
  pnl: string;
  pnlPercent: string;
  leverage: number;
  entryPrice: string;
  markPrice: string;
}

export interface IShareImageGeneratorRef {
  generate: () => Promise<string>;
}

export interface ICanvasConfig {
  size: number;
  padding: number;
  colors: {
    background: string[];
    long: string;
    short: string;
    textPrimary: string;
    textSecondary: string;
    textTertiary: string;
  };
  fonts: {
    coin: number;
    side: number;
    pnl: number;
    priceLabel: number;
    priceValue: number;
    referral: number;
    customText: number;
  };
  layout: {
    logoSize: number;
    tokenSize: number;
    tokenY: number;
    tokenOffsetX: number;
    tokenOffsetY: number;
    sideOffsetY: number;
    pnlYOffset: number;
    priceSpacingY: number;
    priceValueOffsetX: number;
    stickerSize: number;
    customTextMaxWidth: number;
    customTextTopOffset: number;
    customTextLineHeight: number;
    referralBottomOffset: number;
  };
  display: {
    showTokenIcon: boolean;
    showCoinName: boolean;
    showSideAndLeverage: boolean;
    showPnl: boolean;
    showEntryPrice: boolean;
    showMarkPrice: boolean;
  };
}
