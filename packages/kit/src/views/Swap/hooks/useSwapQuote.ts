import { useCallback, useEffect, useRef } from 'react';

import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import {
  ESwapDirectionType,
  type ISwapApproveTransaction,
} from '@onekeyhq/shared/types/swap/types';

import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import {
  useSwapActions,
  useSwapApproveAllowanceSelectOpenAtom,
  useSwapApprovingTransactionAtom,
  useSwapFromTokenAmountAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSlippagePopoverOpeningAtom,
} from '../../../states/jotai/contexts/swap';
import { truncateDecimalPlaces } from '../utils/utils';

import { useSwapAddressInfo } from './useSwapAccount';

export function useSwapQuote() {
  const { quoteAction, cleanQuoteInterval, recoverQuoteInterval } =
    useSwapActions().current;
  const swapAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [swapSlippagePopoverOpening] = useSwapSlippagePopoverOpeningAtom();
  const [swapApproveAllowanceSelectOpen] =
    useSwapApproveAllowanceSelectOpenAtom();
  const [fromTokenAmount, setFromTokenAmount] = useSwapFromTokenAmountAtom();
  const [swapApprovingTransactionAtom] = useSwapApprovingTransactionAtom();
  const activeAccountAddressRef = useRef<string | undefined>();
  if (activeAccountAddressRef.current !== swapAddressInfo?.address) {
    activeAccountAddressRef.current = swapAddressInfo?.address;
  }

  const swapApprovingTxRef = useRef<ISwapApproveTransaction | undefined>();
  if (swapApprovingTxRef.current !== swapApprovingTransactionAtom) {
    swapApprovingTxRef.current = swapApprovingTransactionAtom;
  }

  const alignmentDecimal = useCallback(() => {
    const checkedDecimal = truncateDecimalPlaces(
      fromTokenAmount,
      fromToken?.decimals,
    );
    if (checkedDecimal && checkedDecimal !== fromTokenAmount) {
      setFromTokenAmount(checkedDecimal);
    }
  }, [fromToken?.decimals, fromTokenAmount, setFromTokenAmount]);

  useEffect(() => {
    if (swapSlippagePopoverOpening || swapApproveAllowanceSelectOpen) {
      cleanQuoteInterval();
    } else {
      void recoverQuoteInterval(activeAccountAddressRef.current);
    }
  }, [
    cleanQuoteInterval,
    recoverQuoteInterval,
    swapApproveAllowanceSelectOpen,
    swapSlippagePopoverOpening,
  ]);

  useEffect(() => {
    if (!swapApprovingTransactionAtom) {
      void quoteAction(activeAccountAddressRef.current);
    }
  }, [cleanQuoteInterval, quoteAction, swapApprovingTransactionAtom]);

  useEffect(() => {
    alignmentDecimal();
    void quoteAction(activeAccountAddressRef.current);
    return () => {
      cleanQuoteInterval();
    };
  }, [
    cleanQuoteInterval,
    quoteAction,
    swapAddressInfo.address,
    fromToken,
    toToken,
    alignmentDecimal,
  ]);

  useListenTabFocusState(
    ETabRoutes.Swap,
    (isFocus: boolean, isHiddenModel: boolean) => {
      if (isFocus && !isHiddenModel && !swapApprovingTxRef.current?.txId) {
        void recoverQuoteInterval(activeAccountAddressRef.current);
      } else {
        cleanQuoteInterval();
      }
    },
  );
}
