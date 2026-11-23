import { useCallback, useEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/native';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  useActiveTradeInstrumentAtom,
  useHyperliquidActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { captureSubscriptionRecoveryProof } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/utils/instrumentSwitch';
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
  const [failedCoin, setFailedCoin] = useState<string>();
  const [isSwitching, setIsSwitching] = useState(false);
  const retry = useCallback(() => setRetryCount((count) => count + 1), []);
  useEffect(() => onVisibilityStateChange(setIsVisible), []);
  useEffect(() => {
    if (
      !enabled ||
      !isVisible ||
      isLocked ||
      (instrument.mode === 'perp' && instrument.coin === coin)
    )
      return;
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
        if (
          controller.signal.aborted ||
          !navigation.isFocused() ||
          !subscriptionRecoveryProof
        )
          return;
        if (retryCount > 0) {
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
    navigation,
    retryCount,
  ]);
  const matches = instrument.mode === 'perp' && instrument.coin === coin;
  return {
    failed: !matches && failedCoin === coin,
    isSwitching: !matches && isSwitching,
    retry,
  };
}
