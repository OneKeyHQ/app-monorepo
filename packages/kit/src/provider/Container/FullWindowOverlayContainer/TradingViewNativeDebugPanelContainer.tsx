import { memo, useCallback } from 'react';

import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { ITradingViewNativeDebugPanelProps } from '../../../components/TradingView/TradingViewNative/TradingViewNativeDebugPanel';

const TradingViewNativeDebugPanel = LazyLoad<ITradingViewNativeDebugPanelProps>(
  () =>
    import('../../../components/TradingView/TradingViewNative/TradingViewNativeDebugPanel'),
);

function TradingViewNativeDebugPanelSettingGate() {
  const [devSettings, setDevSettings] = useDevSettingsPersistAtom();
  const handleClose = useCallback(() => {
    setDevSettings((current) => ({
      ...current,
      settings: {
        ...current.settings,
        showTradingViewNativeDebugPanel: false,
      },
    }));
  }, [setDevSettings]);

  if (
    !devSettings.enabled ||
    devSettings.settings?.showTradingViewNativeDebugPanel === false
  ) {
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
