import { useEffect } from 'react';

import {
  useActiveTradeInstrumentAtom,
  useHyperliquidActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';

export function useSimpleMarketFocus(coin: string, enabled: boolean) {
  const [instrument] = useActiveTradeInstrumentAtom();
  const actions = useHyperliquidActions();
  useEffect(() => {
    if (!enabled || (instrument.mode === 'perp' && instrument.coin === coin))
      return;
    let active = true;
    // Returning from another market restores this route's instrument. Hidden
    // pages must never compete with the foreground page for the global feed.
    void actions.current
      .switchTradeInstrument({ mode: 'perp', coin })
      .catch((error: unknown) => {
        if (active) errorToastUtils.toastIfError(error);
      });
    return () => {
      active = false;
    };
  }, [actions, coin, enabled, instrument.coin, instrument.mode]);
}
