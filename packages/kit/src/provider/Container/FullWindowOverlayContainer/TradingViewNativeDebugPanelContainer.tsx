import { memo, useCallback, useLayoutEffect } from 'react';

import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { setTradingViewNativeDebugEventCollectionEnabled } from '../../../components/TradingView/TradingViewNative/data/tradingViewNativeDebugLogger';

import type { ITradingViewNativeDebugPanelProps } from '../../../components/TradingView/TradingViewNative/TradingViewNativeDebugPanel';

const TradingViewNativeDebugPanel = LazyLoad<ITradingViewNativeDebugPanelProps>(
  () =>
    import('../../../components/TradingView/TradingViewNative/TradingViewNativeDebugPanel'),
);

function TradingViewNativeDebugPanelSettingGate() {
  const [devSettings, setDevSettings] = useDevSettingsPersistAtom();
  const isEnabled = Boolean(
    devSettings.enabled &&
    devSettings.settings?.showTradingViewNativeDebugPanel === true,
  );
  const handleClose = useCallback(() => {
    setDevSettings((current) => ({
      ...current,
      settings: {
        ...current.settings,
        showTradingViewNativeDebugPanel: false,
      },
    }));
  }, [setDevSettings]);

  // Enable collection before chart passive effects emit initial lifecycle events.
  useLayoutEffect(() => {
    setTradingViewNativeDebugEventCollectionEnabled(isEnabled);
    return () => {
      setTradingViewNativeDebugEventCollectionEnabled(false);
    };
  }, [isEnabled]);

  if (!isEnabled) {
    return null;
  }

  return <TradingViewNativeDebugPanel onClose={handleClose} />;
}

function BasicTradingViewNativeDebugPanelContainer() {
  if (!platformEnv.isDev || !platformEnv.isWeb || !globalThis.document?.body) {
    return null;
  }

  return <TradingViewNativeDebugPanelSettingGate />;
}

export const TradingViewNativeDebugPanelContainer = memo(
  BasicTradingViewNativeDebugPanelContainer,
);
