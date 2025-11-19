import { useCallback, useEffect } from 'react';

import { useSwapProJumpTokenAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/swap';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import {
  useSwapProSelectTokenAtom,
  useSwapTypeSwitchAtom,
} from '../../../states/jotai/contexts/swap';

export function useSwapProInit() {
  const [, setSwapSwitchType] = useSwapTypeSwitchAtom();
  const [, setSwapProSelectToken] = useSwapProSelectTokenAtom();
  const [swapProJumpToken, setSwapProJumpToken] = useSwapProJumpTokenAtom();
  const swapSwitchProToken = useCallback(
    (payload: { token: ISwapToken }) => {
      setSwapSwitchType(ESwapTabSwitchType.LIMIT);
      setSwapProSelectToken(payload.token);
    },
    [setSwapSwitchType, setSwapProSelectToken],
  );
  useEffect(() => {
    if (swapProJumpToken.token) {
      swapSwitchProToken({ token: swapProJumpToken.token });
      setSwapProJumpToken({ token: undefined });
    }
  }, [swapProJumpToken, swapSwitchProToken, setSwapProJumpToken]);
}

export function useSwapProActions() {}
