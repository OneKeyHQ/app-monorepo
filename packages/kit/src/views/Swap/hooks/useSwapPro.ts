import { useCallback, useEffect } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import {
  useSwapProSelectTokenAtom,
  useSwapTypeSwitchAtom,
} from '../../../states/jotai/contexts/swap';

export function useSwapProInit() {
  const [, setSwapSwitchType] = useSwapTypeSwitchAtom();
  const [, setSwapProSelectToken] = useSwapProSelectTokenAtom();
  const swapSwitchProToken = useCallback(
    (payload: { token: ISwapToken }) => {
      setSwapSwitchType(ESwapTabSwitchType.LIMIT);
      setSwapProSelectToken(payload.token);
    },
    [setSwapSwitchType, setSwapProSelectToken],
  );
  useEffect(() => {
    appEventBus.off(EAppEventBusNames.JumpSwapPro, swapSwitchProToken);
    appEventBus.on(EAppEventBusNames.JumpSwapPro, swapSwitchProToken);
  }, [swapSwitchProToken]);
}

export function useSwapProActions() {}
