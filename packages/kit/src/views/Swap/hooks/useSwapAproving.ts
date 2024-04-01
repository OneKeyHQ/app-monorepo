import { useEffect } from 'react';

import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import {
  useSwapActions,
  useSwapApprovingTransactionAtom,
} from '../../../states/jotai/contexts/swap';

export function useSwapApproving() {
  const { approvingStateAction, cleanApprovingInterval } =
    useSwapActions().current;
  const [swapApprovingTransactionAtom] = useSwapApprovingTransactionAtom();
  useEffect(() => {
    void approvingStateAction();
    return () => {
      cleanApprovingInterval();
    };
  }, [
    approvingStateAction,
    cleanApprovingInterval,
    swapApprovingTransactionAtom?.txId,
  ]);

  useListenTabFocusState(
    ETabRoutes.Swap,
    (isFocus: boolean, isHiddenModel: boolean) => {
      if (isFocus && !isHiddenModel) {
        void approvingStateAction();
      } else {
        cleanApprovingInterval();
      }
    },
  );
}
