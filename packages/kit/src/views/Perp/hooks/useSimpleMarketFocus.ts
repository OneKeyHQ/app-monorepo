import { useEffect, useState } from 'react';

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
      .then((subscriptionRecoveryProof) => {
        if (
          controller.signal.aborted ||
          !navigation.isFocused() ||
          !subscriptionRecoveryProof
        )
          return;
        return actions.current.switchTradeInstrument({
          mode: 'perp',
          coin,
          subscriptionRecoveryProof,
          restorationSignal: controller.signal,
        });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) errorToastUtils.toastIfError(error);
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
  ]);
}
