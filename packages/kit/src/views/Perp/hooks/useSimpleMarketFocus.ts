import { useCallback, useEffect, useRef, useState } from 'react';

import { useNavigation } from '@react-navigation/native';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  useActiveTradeInstrumentAtom,
  useHyperliquidActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  captureSubscriptionRecoveryProof,
  isTradeInstrumentLoaded,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/utils/instrumentSwitch';
import {
  appIsLocked,
  useAppIsLockedAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import {
  getCurrentVisibilityState,
  onVisibilityStateChange,
} from '@onekeyhq/shared/src/utils/appVisibility';

export function useSimpleMarketFocus(coin: string, enabled: boolean) {
  const [instrument] = useActiveTradeInstrumentAtom();
  const actions = useHyperliquidActions();
  const navigation = useNavigation();
  const [isLocked] = useAppIsLockedAtom();
  const [isVisible, setIsVisible] = useState(getCurrentVisibilityState);
  const [retryCount, setRetryCount] = useState(0);
  const pendingMetaRefresh = useRef(false);
  const [failedCoin, setFailedCoin] = useState<string>();
  const [isSwitching, setIsSwitching] = useState(false);
  const retry = useCallback(() => {
    pendingMetaRefresh.current = true;
    setRetryCount((count) => count + 1);
  }, []);
  const matches =
    instrument.mode === 'perp' &&
    instrument.coin === coin &&
    isTradeInstrumentLoaded(instrument);
  useEffect(() => onVisibilityStateChange(setIsVisible), []);
  useEffect(() => {
    const refreshMetadata = pendingMetaRefresh.current;
    pendingMetaRefresh.current = false;
    if (!enabled || !isVisible || isLocked || matches) return;
    const controller = new AbortController();
    setIsSwitching(true);
    setFailedCoin(undefined);
    const cancel = () => controller.abort();
    const unsubscribe = navigation.addListener('blur', cancel);
    // Returning from another market restores this route's instrument. Hidden
    // pages must never compete with the foreground page for the global feed.
    void captureSubscriptionRecoveryProof({
      source: 'simple-market',
      isSourceLive: () => !controller.signal.aborted && navigation.isFocused(),
      isAppVisible: getCurrentVisibilityState,
      isAppLocked: () => appIsLocked.get(),
      readDisabledCount: () =>
        backgroundApiProxy.serviceHyperliquidSubscription.getSubscriptionsHandlerDisabledCount(),
    })
      .then(async (subscriptionRecoveryProof) => {
        if (controller.signal.aborted || !navigation.isFocused()) return;
        if (!subscriptionRecoveryProof) {
          setFailedCoin(coin);
          return;
        }
        if (refreshMetadata) {
          await backgroundApiProxy.serviceHyperliquid.refreshTradingMeta();
          if (controller.signal.aborted || !navigation.isFocused()) return;
        }
        const switched = await actions.current.switchTradeInstrument({
          mode: 'perp',
          coin,
          subscriptionRecoveryProof,
          restorationSignal: controller.signal,
        });
        if (!controller.signal.aborted && switched === false)
          setFailedCoin(coin);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setFailedCoin(coin);
          errorToastUtils.toastIfError(error);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsSwitching(false);
      });
    return () => {
      unsubscribe();
      cancel();
    };
  }, [
    actions,
    coin,
    enabled,
    instrument.coin,
    instrument.mode,
    isLocked,
    isVisible,
    matches,
    navigation,
    retryCount,
  ]);
  return {
    failed: !matches && failedCoin === coin,
    isSwitching: !matches && isSwitching,
    retry,
  };
}
