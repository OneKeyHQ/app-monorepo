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
}

export function TradingView({
  version = 'v1',
  symbol,
  decimal,
  onPanesCountChange,
  disabledFeatures,
  storageNamespace,
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
