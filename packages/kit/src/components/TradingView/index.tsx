import { TradingViewV1 } from './TradingViewV1';
import { TradingViewV2 } from './TradingViewV2';

import type { ITradingViewProps } from './TradingViewV1';
import type { WebViewProps } from 'react-native-webview';

interface ITradingViewWithVersionProps extends ITradingViewProps {
  version?: 'v1' | 'v2';
  symbol?: string;
  decimal?: number;
  onPanesCountChange?: (count: number) => void;
}

export function TradingView({
  version = 'v1',
  symbol,
  decimal,
  onPanesCountChange,
  ...props
}: ITradingViewWithVersionProps & WebViewProps) {
  if (version === 'v2') {
    return (
      <TradingViewV2
        {...props}
        decimal={decimal || 2}
        symbol={symbol ?? ''}
        onPanesCountChange={onPanesCountChange}
      />
    );
  }

  return <TradingViewV1 {...props} />;
}

export type { ITradingViewProps, ITradingViewWithVersionProps, TradingViewV2 };
