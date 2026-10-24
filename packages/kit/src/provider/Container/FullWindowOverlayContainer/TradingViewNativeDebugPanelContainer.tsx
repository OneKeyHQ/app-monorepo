import { memo, useCallback, useLayoutEffect } from 'react';

import { OverlayView } from '@onekeyfe/react-native-native-overlay';

import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { setTradingViewNativeDebugEventCollectionEnabled } from '../../../components/TradingView/TradingViewNative/data/tradingViewNativeDebugLogger';

import type { ITradingViewNativeDebugPanelProps } from '../../../components/TradingView/TradingViewNative/TradingViewNativeDebugPanel';

const TradingViewNativeDebugPanel = LazyLoad<ITradingViewNativeDebugPanelProps>(
  () =>
    import('../../../components/TradingView/TradingViewNative/TradingViewNativeDebugPanel'),
);

const DEBUG_OVERLAY_ANIMATION = { enter: { type: 'none' } } as const;

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

  return (
    <OverlayView
      visible
      level="debug"
      presentation="fullscreen"
      blocking={false}
      backdrop={false}
      dismissOnBackPress={false}
      animation={DEBUG_OVERLAY_ANIMATION}
    >
      <TradingViewNativeDebugPanel onClose={handleClose} />
    </OverlayView>
  );
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
