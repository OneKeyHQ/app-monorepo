import { TradingViewV1 } from './TradingViewV1';
import { TradingViewV2 } from './TradingViewV2';

import type { ITradingViewProps } from './TradingViewV1';
import type { WebViewProps } from 'react-native-webview';

interface ITradingViewWithVersionProps extends ITradingViewProps {
  version?: 'v1' | 'v2';
}

export function TradingView({
  version = 'v1',
  ...props
}: ITradingViewWithVersionProps & WebViewProps) {
  if (version === 'v2') {
    return <TradingViewV2 {...props} />;
  }

  return <TradingViewV1 {...props} />;
}

export type { ITradingViewProps, ITradingViewWithVersionProps, TradingViewV2 };
