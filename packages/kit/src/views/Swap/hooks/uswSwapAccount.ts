import { useCallback, useEffect, useRef } from 'react';

import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import { ETabRoutes } from '../../../routes/Tab/type';
import { useAccountSelectorActions } from '../../../states/jotai/contexts/accountSelector';
import {
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
} from '../../../states/jotai/contexts/swap';

export function useSwapAccountNetworkSync() {
  const { updateSelectedAccount } = useAccountSelectorActions().current;
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const fromTokenRef = useRef<ISwapToken | undefined>();
  const toTokenRef = useRef<ISwapToken | undefined>();
  if (fromTokenRef.current !== fromToken) {
    fromTokenRef.current = fromToken;
  }
  if (toTokenRef.current !== toToken) {
    toTokenRef.current = toToken;
  }

  const checkTokenForAccountNetwork = useCallback(() => {
    if (fromTokenRef.current) {
      updateSelectedAccount({
        num: 0,
        builder: (v) => ({
          ...v,
          networkId: fromTokenRef.current?.networkId,
        }),
      });
    }
    if (toTokenRef.current) {
      updateSelectedAccount({
        num: 1,
        builder: (v) => ({
          ...v,
          networkId: toTokenRef.current?.networkId,
        }),
      });
    }
  }, [updateSelectedAccount]);

  useListenTabFocusState(
    ETabRoutes.Swap,
    (isFocus: boolean, isHideByModal: boolean) => {
      if (isHideByModal) return;
      if (isFocus) {
        checkTokenForAccountNetwork();
      }
    },
  );

  useEffect(() => {
    checkTokenForAccountNetwork();
  }, [checkTokenForAccountNetwork, fromToken, toToken]);
}
