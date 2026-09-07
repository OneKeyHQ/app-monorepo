import type { ReactNode } from 'react';

import type {
  ITradingViewNativeChartLineStyle,
  ITradingViewNativeChartType,
} from '@onekeyhq/shared/types/tradingViewNative';

import type { ITradingViewNativeChartInterval } from './data/tradingViewNativeIntervals';

export type { ITradingViewNativeChartType } from '@onekeyhq/shared/types/tradingViewNative';

export type ITradingViewNativeHyperliquidEnvironment = 'mainnet' | 'testnet';
export type ITradingViewNativeChartDisplayMode = 'default' | 'compact';
export type ITradingViewNativePriceScaleMode = 'linear' | 'logarithmic';

export interface ITradingViewNativeCandleLabels {
  close: string;
  high: string;
  low: string;
  open: string;
}

export type ITradingViewNativeSource =
  | {
      kind: 'asset';
      assetId: string;
    }
  | {
      kind: 'hyperliquid';
      coin: string;
      environment: ITradingViewNativeHyperliquidEnvironment;
    }
  | {
      kind: 'market';
      fallbackCoinGeckoId?: string;
      isNative?: boolean;
      networkId: string;
      tokenAddress: string;
      symbol: string;
      realtime: 'disabled' | 'websocket';
    }
  | {
      kind: 'stock';
      stockId: string;
    };

export type ITradingViewNativeDataStatus =
  | 'idle'
  | 'loading'
  | 'live'
  | 'stale'
  | 'reconnecting'
  | 'error';

export interface ITradingViewNativeDataState {
  status: ITradingViewNativeDataStatus;
  error?: unknown;
  lastUpdatedAt?: number;
}

export interface ITradingViewNativePriceUpdateData {
  price: number;
  receivedAt: number;
  source: 'history' | 'realtime';
  timestamp: number;
}

export interface ITradingViewNativeIntervalChangeData {
  fromInterval: ITradingViewNativeChartInterval;
  toInterval: ITradingViewNativeChartInterval;
}

export type ITradingViewNativeInitialRightOffset =
  | {
      type: 'chartWidthPercentage';
      value: number;
    }
  | {
      type: 'pointCount';
      value: number;
    };

export interface ITradingViewNativePriceChartAnchor {
  type: 'price';
  price: number;
}

export interface ITradingViewNativeReferenceLineComponent {
  id: string;
  type: 'referenceLine';
  props: {
    anchor: ITradingViewNativePriceChartAnchor;
    color: string;
    interactive: false;
    style: ITradingViewNativeChartLineStyle;
    title: string;
  };
}

export interface ITradingViewNativeChartComponentGroup {
  id: string;
  type: 'group';
  children: readonly ITradingViewNativeChartComponentNode[];
}

export type ITradingViewNativeChartLeafComponent =
  ITradingViewNativeReferenceLineComponent;

export type ITradingViewNativeChartComponentNode =
  | ITradingViewNativeChartComponentGroup
  | ITradingViewNativeChartLeafComponent;

export interface ITradingViewNativeProps {
  testID?: string;
  source: ITradingViewNativeSource;
  forcedChartType?: ITradingViewNativeChartType;
  chartComponents?: readonly ITradingViewNativeChartComponentNode[];
  enableNativeChartSettings?: boolean;
  initialRightOffset?: ITradingViewNativeInitialRightOffset;
  nativeChartDisplayMode?: ITradingViewNativeChartDisplayMode;
  /** Limits new selections without hiding sub-indicators that are already active. */
  maxSelectableSubIndicatorCount?: number;
  nativeControlsLayoutMode?: 'mobile' | 'desktop';
  /**
   * Drops the desktop controls row's own horizontal inset so its first control
   * lines up with the leading edge of the plot below it. For assemblies that
   * embed the widget flush in their own layout; off by default.
   */
  nativeControlsFlushHorizontalInset?: boolean;
  showNativeChartCloseControl?: boolean;
  isNativeChartFullscreen?: boolean;
  nativeChartFullscreenHeader?: ReactNode;
  isChartSwitchDisabled?: boolean;
  onChartSwitch?: () => void;
  onDataStateChange?: (state: ITradingViewNativeDataState) => void;
  onIntervalChange?: (data: ITradingViewNativeIntervalChangeData) => void;
  onNativeChartClose?: () => void;
  onNativeSubIndicatorCountChange?: (count: number | null) => void;
  onNativeChartFullscreenChange?: (isFullscreen: boolean) => void;
  onPriceUpdate?: (data: ITradingViewNativePriceUpdateData) => void;
}
