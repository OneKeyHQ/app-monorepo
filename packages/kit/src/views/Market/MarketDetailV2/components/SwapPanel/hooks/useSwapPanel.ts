import { useCallback, useEffect, useState } from 'react';

import BigNumber from 'bignumber.js';

import type { ISwapMaxAmountSnapshot } from '@onekeyhq/kit/src/views/Swap/utils/swapAmountUtils';

import { useTradeType } from './useTradeType';

import type { IToken } from '../types';

type IMarketTradeAmount = {
  amount: BigNumber;
  maxAmountSnapshot?: ISwapMaxAmountSnapshot;
};

export function useSwapPanel({
  networkId: initialNetworkId,
}: { networkId?: string } = {}) {
  const { tradeType, setTradeType } = useTradeType();
  const [payment, setPayment] = useState<IMarketTradeAmount>(() => ({
    amount: new BigNumber(0),
  }));
  const [sale, setSale] = useState<IMarketTradeAmount>(() => ({
    amount: new BigNumber(0),
  }));
  const setPaymentAmount = useCallback(
    (amount: BigNumber, maxAmountSnapshot?: ISwapMaxAmountSnapshot) =>
      setPayment({ amount, maxAmountSnapshot }),
    [],
  );
  const setSellAmount = useCallback(
    (amount: BigNumber, maxAmountSnapshot?: ISwapMaxAmountSnapshot) =>
      setSale({ amount, maxAmountSnapshot }),
    [],
  );
  const [paymentToken, setPaymentToken] = useState<IToken>();
  const [networkId, setNetworkId] = useState(initialNetworkId);
  const [slippage, setSlippage] = useState<number>(0.5);
  const resetAmounts = useCallback(() => {
    setPayment({ amount: new BigNumber(0) });
    setSale({ amount: new BigNumber(0) });
  }, []);

  useEffect(() => {
    if (initialNetworkId) {
      setNetworkId(initialNetworkId);
    }
  }, [initialNetworkId, setNetworkId]);

  return {
    paymentAmount: payment.amount,
    paymentMaxAmountSnapshot: payment.maxAmountSnapshot,
    setPaymentAmount,
    resetAmounts,

    sellAmount: sale.amount,
    sellMaxAmountSnapshot: sale.maxAmountSnapshot,
    setSellAmount,

    // For NetworkSelector
    networkId,
    setNetworkId,

    // For TokenInputSection
    paymentToken,
    setPaymentToken,

    // For TradeTypeSelector
    tradeType,
    setTradeType,

    // For SlippageSetting
    slippage,
    setSlippage,
  };
}
