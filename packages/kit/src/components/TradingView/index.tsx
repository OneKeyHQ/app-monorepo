import { TradingViewV1 } from './TradingViewV1';
import { TradingViewV2 } from './TradingViewV2';

import type { ITradingViewDisabledFeature } from './constants';
import type { ITradingViewProps } from './TradingViewV1';
import type { WebViewProps } from 'react-native-webview';

interface ITradingViewWithVersionProps extends ITradingViewProps {
  version?: 'v1' | 'v2';
  symbol?: string;
  decimal?: number;
  onPanesCountChange?: (count: number) => void;
  disabledFeatures?: readonly ITradingViewDisabledFeature[];
  storageNamespace?: string;
  enableNativeChartControls?: boolean;
  enableNativeIntervalSelector?: boolean;
  nativeChartTypeControlMode?: 'toggle' | 'select';
  nativeIndicatorControlMode?: 'dialog' | 'popover';
  nativeIntervalControlMode?: 'dialog' | 'popover';
  nativePriceMarketCapControlMode?: 'settings' | 'select';
  nativeControlsLayoutMode?: 'mobile' | 'desktop';
  isNativeChartFullscreen?: boolean;
  showNativeIndicatorQuickBar?: boolean;
  onNativeChartFullscreenChange?: (isFullscreen: boolean) => void;
}

export function TradingView({
  version = 'v1',
  symbol,
  decimal,
  onPanesCountChange,
  disabledFeatures,
  storageNamespace,
  enableNativeChartControls,
  enableNativeIntervalSelector,
  nativeChartTypeControlMode,
  nativeIndicatorControlMode,
  nativeIntervalControlMode,
  nativePriceMarketCapControlMode,
  nativeControlsLayoutMode,
  isNativeChartFullscreen,
  showNativeIndicatorQuickBar,
  onNativeChartFullscreenChange,
  ...props
}: ITradingViewWithVersionProps & WebViewProps) {
  if (version === 'v2') {
    return (
      <TradingViewV2
        {...props}
        decimal={decimal ?? 2}
        symbol={symbol ?? ''}
        onPanesCountChange={onPanesCountChange}
        disabledFeatures={disabledFeatures}
        storageNamespace={storageNamespace}
        enableNativeChartControls={enableNativeChartControls}
        enableNativeIntervalSelector={enableNativeIntervalSelector}
        nativeChartTypeControlMode={nativeChartTypeControlMode}
        nativeIndicatorControlMode={nativeIndicatorControlMode}
        nativeIntervalControlMode={nativeIntervalControlMode}
        nativePriceMarketCapControlMode={nativePriceMarketCapControlMode}
        nativeControlsLayoutMode={nativeControlsLayoutMode}
        isNativeChartFullscreen={isNativeChartFullscreen}
        showNativeIndicatorQuickBar={showNativeIndicatorQuickBar}
        onNativeChartFullscreenChange={onNativeChartFullscreenChange}
      />
    );
  }

  return <TradingViewV1 {...props} />;
}

export type { ITradingViewProps, ITradingViewWithVersionProps, TradingViewV2 };
export {
  TRADING_VIEW_DISABLED_FEATURES,
  TRADING_VIEW_DISABLED_FEATURES_URL_PARAM,
} from './constants';
export type { ITradingViewDisabledFeature } from './constants';
