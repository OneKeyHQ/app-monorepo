import WebView from '@onekeyhq/kit/src/components/WebView';

import type { ITradingViewRuntimeViewProps } from './TradingViewRuntimeView.types';

export function TradingViewRuntimeView({
  onChartError: _onChartError,
  onChartReady: _onChartReady,
  onVisualReady: _onVisualReady,
  ...props
}: ITradingViewRuntimeViewProps) {
  return <WebView {...props} />;
}
