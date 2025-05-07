import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { TradingViewV1 } from './TradingViewV1';
import { TradingViewV2 } from './TradingViewV2';

import type { ITradingViewProps } from './TradingViewV1';
import type { WebViewProps } from 'react-native-webview';

export function TradingView(props: ITradingViewProps & WebViewProps) {
  const [devSettings] = useDevSettingsPersistAtom();
  const useTradingViewTestDomain =
    devSettings.enabled && devSettings.settings?.useTradingViewTestDomain;

  if (useTradingViewTestDomain) {
    return <TradingViewV2 {...props} />;
  }

  return <TradingViewV1 {...props} />;
}

export type { ITradingViewProps };
