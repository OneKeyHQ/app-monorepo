export type IPnlDisplayMode = 'roe' | 'pnl';

export interface IShareConfig {
  customText: string;
  stickerIndex: number | null;
  backgroundIndex: number;
  pnlDisplayMode: IPnlDisplayMode;
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
  priceType?: 'mark' | 'exit';
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
    referralBackground: string;
    sideLongBackground: string;
    sideShortBackground: string;
  };
  fonts: {
    coin: number;
    side: number;
    pnl: number;
    priceLabel: number;
    priceValue: number;
  };
  layout: {
    tokenSize: number;
    stickerSize: number;
    referralHeight: number;
    tokenY: number;
    tokenOffsetX: number;
    pnlY: number;
    entryPriceY: number;
    markPriceY: number;
    priceSpacingY: number;
    badgePaddingX: number;
    badgePaddingY: number;
    tokenSpacing: number;
    priceGap: number;
    referralOffset: number;
    lineHeight: number;
    badgeRadius: number;
    labelOpacity: number;
    qrCodeSize: number;
    qrCodeSpacing: number;
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
