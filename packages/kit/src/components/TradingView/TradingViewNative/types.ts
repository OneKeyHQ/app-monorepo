import type { ReactElement, ReactNode } from 'react';

import type { IIconButtonProps } from '@onekeyhq/components';
import type {
  ITradingViewNativeChartLineStyle,
  ITradingViewNativeChartType,
} from '@onekeyhq/shared/types/tradingViewNative';

import type { ITradingViewNativeChartInterval } from './data/tradingViewNativeIntervals';
import type { ITradingViewNativeIndicatorQuickBarState } from '../TradingViewChartControls/indicatorSelector/nativeIndicatorQuickBarState';
import type { ITradingViewIntervalSegmentsProps } from '../TradingViewChartControls/types';

type IChartButtonAppearance = Pick<
  IIconButtonProps,
  | 'width'
  | 'height'
  | 'p'
  | 'hitSlop'
  | 'bg'
  | 'borderWidth'
  | 'borderColor'
  | 'borderRadius'
  | 'pressStyle'
  | 'iconSize'
  | 'left'
>;

export interface ITradingViewMobileControlsAppearance {
  renderIntervals: (props: ITradingViewIntervalSegmentsProps) => ReactElement;
  settingsButton: IChartButtonAppearance;
  fullscreenButton: IChartButtonAppearance;
  denseIndicators: boolean;
}

export type { ITradingViewNativeChartType } from '@onekeyhq/shared/types/tradingViewNative';

export type ITradingViewNativeHyperliquidEnvironment = 'mainnet' | 'testnet';
export type ITradingViewNativeChartDisplayMode =
  | 'default'
  | 'compact'
  | 'marketDetail';
export type ITradingViewNativeStorageNamespace = 'market' | 'perps' | 'swap';
export type ITradingViewNativePriceScaleMode = 'linear' | 'logarithmic';
export type ITradingViewNativeCandleTimeMode = 'calendar' | 'fixed';

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

export type ITradingViewNativeInitialRightOffset = {
  // Keep padding and pan limits stable when a sidebar changes the visible width.
  referenceWidth?: number;
} & (
  | {
      type: 'chartWidthPercentage';
      value: number;
    }
  | {
      type: 'pointCount';
      value: number;
    }
);

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
    interactive: boolean;
    cancelable?: boolean;
    draggable?: boolean;
    pending?: ITradingViewNativeReferenceLineAction['type'];
    style: ITradingViewNativeChartLineStyle | 'dotted';
    title: string;
    /** Opt into an outlined label with an optional quantity segment. */
    label?: {
      variant?: 'order';
      priceBadgeBackgroundColor?: string;
      /** Offset from the chart's left edge; numbers are pixels. */
      offset: number | { type: 'chartWidthPercentage'; value: number };
      backgroundColor: string;
      color: string;
      quantity?: {
        text: string;
        backgroundColor: string;
        color: string;
      };
    };
  };
}

export interface ITradingViewNativeChartComponentGroup {
  id: string;
  type: 'group';
  children: readonly ITradingViewNativeChartComponentNode[];
}

export type ITradingViewNativeReferenceLineAction = {
  id: string;
  originalPrice: number;
} & ({ type: 'cancel' } | { type: 'priceChange'; price: number });

export interface ITradingViewNativeTradeMark {
  id: string;
  label: 'B' | 'S';
  text: string;
  time: number;
}

export interface ITradingViewNativeTradeMarksComponent {
  id: string;
  type: 'tradeMarks';
  props: {
    marks: readonly ITradingViewNativeTradeMark[];
  };
}

export type ITradingViewNativeChartLeafComponent =
  | ITradingViewNativeReferenceLineComponent
  | ITradingViewNativeTradeMarksComponent;

export type ITradingViewNativeChartComponentNode =
  | ITradingViewNativeChartComponentGroup
  | ITradingViewNativeChartLeafComponent;

export interface ITradingViewNativeAccountMarksContext {
  accountAddress?: string;
  networkId: string;
  tokenAddress: string;
}

export interface ITradingViewNativeProps {
  testID?: string;
  /** Pause live updates while retaining the chart's viewport and data. */
  active?: boolean;
  /** Embed a default solid background without changing saved chart settings. */
  defaultBackgroundColor?: string;
  source: ITradingViewNativeSource;
  priceDecimalPlaces?: number;
  isPricePrecisionLoading?: boolean;
  onPriceSelect?: (selection: ITradingViewNativePriceSelection) => void;
  priceSelectionLabel?: string;
  onInteractionChange?: (isInteracting: boolean) => void;
  useFullscreenOverlay?: boolean;
  storageNamespace?: ITradingViewNativeStorageNamespace;
  /** Opt-in for drawing tools on full Market charts across all platforms. */
  enableDrawings?: boolean;
  /** Let the enclosing page claim vertical drags on an embedded native chart. */
  prioritizePageScroll?: boolean;
  forcedChartType?: ITradingViewNativeChartType;
  chartComponents?: readonly ITradingViewNativeChartComponentNode[];
  onReferenceLineAction?: (
    action: ITradingViewNativeReferenceLineAction,
  ) => Promise<void>;
  accountMarksContext?: ITradingViewNativeAccountMarksContext;
  /**
   * Opt-in for stock detail charts, which can anchor the Prev close line on the
   * stock's previous session close. It shows the chart setting and lets the
   * line draw from `previousClose`; every other chart hides both.
   */
  enablePreviousClose?: boolean;
  /** Previous session close anchoring the Prev close reference line. */
  previousClose?: number;
  enableNativeChartSettings?: boolean;
  nativeChartSettingsInToolbar?: boolean;
  /** Extra controls rendered in the mobile toolbar, to the left of settings. */
  mobileToolbarExtra?: ReactNode;
  mobileControlsAppearance?: ITradingViewMobileControlsAppearance;
  initialRightOffset?: ITradingViewNativeInitialRightOffset;
  initialZoomScale?: number;
  defaultPriceRangeScale?: number;
  nativeChartDisplayMode?: ITradingViewNativeChartDisplayMode;
  /** Limits new selections without hiding sub-indicators that are already active. */
  maxSelectableSubIndicatorCount?: number;
  nativeControlsLayoutMode?: 'mobile' | 'desktop';
  mobileControlsPaddingHorizontal?: number;
  /**
   * Drops the desktop controls row's own horizontal inset so its first control
   * lines up with the leading edge of the plot below it. For assemblies that
   * embed the widget flush in their own layout; off by default.
   */
  nativeControlsFlushHorizontalInset?: boolean;
  showNativeChartCloseControl?: boolean;
  showNativeIndicatorQuickBar?: boolean;
  /**
   * The parent grows the chart container by one pane height per visible
   * sub-indicator, so the main price chart keeps its height.
   */
  nativeChartGrowsWithSubIndicators?: boolean;
  isNativeChartFullscreen?: boolean;
  nativeChartFullscreenHeader?: ReactNode;
  isChartSwitchDisabled?: boolean;
  onChartSwitch?: () => void;
  onDataStateChange?: (state: ITradingViewNativeDataState) => void;
  onIntervalChange?: (data: ITradingViewNativeIntervalChangeData) => void;
  onNativeChartClose?: () => void;
  onNativeSubIndicatorCountChange?: (count: number | null) => void;
  onNativeIndicatorQuickBarChange?: (
    state: ITradingViewNativeIndicatorQuickBarState,
  ) => void;
  onNativeChartFullscreenChange?: (isFullscreen: boolean) => void;
  /**
   * Android: set while a fullscreen session rotates the window, from the
   * session's start until the window has settled in portrait again. Only then
   * is a landscape page layout transient; a window can also be landscape on
   * its own, e.g. in split screen.
   */
  onNativeChartWindowRotationChange?: (isRotating: boolean) => void;
  onPriceUpdate?: (data: ITradingViewNativePriceUpdateData) => void;
}

export interface ITradingViewNativePriceSelection {
  price: number;
  screenX: number;
  screenY: number;
  onClose?: () => void;
}
