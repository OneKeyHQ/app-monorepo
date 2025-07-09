import { useCallback, useEffect } from 'react';

import { useAtom } from 'jotai';

import {
  antiMEVAtom,
  balanceAtom,
  balanceTokenAtom,
  baseTokenAtom,
  checkTokenAllowanceLoadingAtom,
  defaultTokensAtom,
  fetchBalanceLoadingAtom,
  isApprovedAtom,
  isLoadingAtom,
  networkIdAtom,
  paymentAmountAtom,
  paymentTokenAtom,
  priceRateAtom,
  providerAtom,
  shouldApproveAtom,
  shouldResetApproveAtom,
  slippageAtom,
  speedSwapBuildTxLoadingAtom,
  speedSwapInitLoadingAtom,
  spenderAddressAtom,
  supportSpeedSwapAtom,
  swapMevNetConfigAtom,
} from '../atoms/swapPanelAtoms';

import { useTradeType } from './useTradeType';

export function useSwapPanel({
  networkId: initialNetworkId,
}: { networkId?: string } = {}) {
  const { tradeType, setTradeType } = useTradeType();

  // Core state
  const [paymentAmount, setPaymentAmount] = useAtom(paymentAmountAtom);
  const [antiMEV, setAntiMEV] = useAtom(antiMEVAtom);
  const [paymentToken, setPaymentToken] = useAtom(paymentTokenAtom);
  const [networkId, setNetworkId] = useAtom(networkIdAtom);
  const [slippage, setSlippage] = useAtom(slippageAtom);

  // Balance and tokens
  const [balance, setBalance] = useAtom(balanceAtom);
  const [balanceToken, setBalanceToken] = useAtom(balanceTokenAtom);
  const [fetchBalanceLoading, setFetchBalanceLoading] = useAtom(
    fetchBalanceLoadingAtom,
  );
  const [baseToken, setBaseToken] = useAtom(baseTokenAtom);
  const [defaultTokens, setDefaultTokens] = useAtom(defaultTokensAtom);

  // Price and rate
  const [priceRate, setPriceRate] = useAtom(priceRateAtom);

  // Loading states
  const [speedSwapBuildTxLoading, setSpeedSwapBuildTxLoading] = useAtom(
    speedSwapBuildTxLoadingAtom,
  );
  const [checkTokenAllowanceLoading, setCheckTokenAllowanceLoading] = useAtom(
    checkTokenAllowanceLoadingAtom,
  );
  const [speedSwapInitLoading, setSpeedSwapInitLoading] = useAtom(
    speedSwapInitLoadingAtom,
  );

  // Approval states
  const [shouldApprove, setShouldApprove] = useAtom(shouldApproveAtom);
  const [shouldResetApprove, setShouldResetApprove] = useAtom(
    shouldResetApproveAtom,
  );

  // Config
  const [supportSpeedSwap, setSupportSpeedSwap] = useAtom(supportSpeedSwapAtom);
  const [provider, setProvider] = useAtom(providerAtom);
  const [spenderAddress, setSpenderAddress] = useAtom(spenderAddressAtom);
  const [swapMevNetConfig, setSwapMevNetConfig] = useAtom(swapMevNetConfigAtom);

  // Derived state
  const [isLoading] = useAtom(isLoadingAtom);
  const [isApproved] = useAtom(isApprovedAtom);

  useEffect(() => {
    if (initialNetworkId) {
      setNetworkId(initialNetworkId);
    }
  }, [initialNetworkId, setNetworkId]);

  const handleAntiMEVToggle = useCallback(() => {
    setAntiMEV((prev) => !prev);
  }, [setAntiMEV]);

  return {
    // Core state
    paymentAmount,
    setPaymentAmount,
    antiMEV,
    handleAntiMEVToggle,
    paymentToken,
    setPaymentToken,
    networkId,
    setNetworkId,
    slippage,
    setSlippage,

    // Trade type
    tradeType,
    setTradeType,

    // Balance and tokens
    balance,
    setBalance,
    balanceToken,
    setBalanceToken,
    fetchBalanceLoading,
    setFetchBalanceLoading,
    baseToken,
    setBaseToken,
    defaultTokens,
    setDefaultTokens,

    // Price and rate
    priceRate,
    setPriceRate,

    // Loading states
    speedSwapBuildTxLoading,
    setSpeedSwapBuildTxLoading,
    checkTokenAllowanceLoading,
    setCheckTokenAllowanceLoading,
    speedSwapInitLoading,
    setSpeedSwapInitLoading,

    // Approval states
    shouldApprove,
    setShouldApprove,
    shouldResetApprove,
    setShouldResetApprove,

    // Config
    supportSpeedSwap,
    setSupportSpeedSwap,
    provider,
    setProvider,
    spenderAddress,
    setSpenderAddress,
    swapMevNetConfig,
    setSwapMevNetConfig,

    // Derived state
    isLoading,
    isApproved,
  };
}
