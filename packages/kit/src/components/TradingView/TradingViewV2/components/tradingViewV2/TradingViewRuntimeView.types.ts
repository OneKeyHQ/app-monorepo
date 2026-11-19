import type { IWebViewProps } from '@onekeyhq/kit/src/components/WebView';

export interface ITradingViewRuntimeViewProps extends IWebViewProps {
  onChartError?: () => void;
  onChartReady?: () => void;
  onVisualReady?: () => void;
}
