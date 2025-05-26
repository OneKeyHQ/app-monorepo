import { useCallback, useEffect, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useAtom } from 'jotai';

import { networkIdAtom } from '../atoms/swapPanelAtoms';

import { useBalance } from './useBalance';
import { useTradeType } from './useTradeType';

import type { IToken } from '../types';

export function useSwapPanel({
  networkId: networkIdProp,
}: { networkId?: string } = {}) {
  const { tradeType, setTradeType } = useTradeType();
  const [paymentAmount, setPaymentAmount] = useState<BigNumber>(
    new BigNumber(0),
  );
  const [antiMEV, setAntiMEV] = useState(false);
  const [paymentToken, setPaymentToken] = useState<IToken>();
  const [networkId, setNetworkId] = useAtom(networkIdAtom);
  const [slippage, setSlippage] = useState<number>(0.5);
  const { balance, setBalance, balanceToken } = useBalance({
    token: paymentToken,
  });

  useEffect(() => {
    if (networkIdProp) {
      setNetworkId(networkIdProp);
    }
  }, [networkIdProp, setNetworkId]);

  const handleAntiMEVToggle = useCallback(() => {
    setAntiMEV((prev) => !prev);
  }, []);

  return {
    paymentAmount,
    setPaymentAmount,

    // For NetworkSelector
    networkId,
    setNetworkId,

    // For BalanceDisplay
    balance,
    setBalance,
    balanceToken,

    // For AntiMEVToggle
    handleAntiMEVToggle,
    antiMEV,

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
