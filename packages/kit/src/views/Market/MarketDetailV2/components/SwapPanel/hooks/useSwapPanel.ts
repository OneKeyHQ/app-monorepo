import { useEffect, useState } from 'react';

import BigNumber from 'bignumber.js';

import { useTradeType } from './useTradeType';

import type { IToken } from '../types';

export function useSwapPanel({
  networkId: initialNetworkId,
}: { networkId?: string } = {}) {
  const { tradeType, setTradeType } = useTradeType();
  const [paymentAmount, setPaymentAmount] = useState<BigNumber>(
    new BigNumber(0),
  );
  const [paymentToken, setPaymentToken] = useState<IToken>();
  const [networkId, setNetworkId] = useState(initialNetworkId);
  const [slippage, setSlippage] = useState<number>(0.5);

  useEffect(() => {
    if (initialNetworkId) {
      setNetworkId(initialNetworkId);
    }
  }, [initialNetworkId, setNetworkId]);

  return {
    paymentAmount,
    setPaymentAmount,

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
