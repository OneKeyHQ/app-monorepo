import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useAtom } from 'jotai';

import { validateAmountInput } from '@onekeyhq/kit/src/utils/validateAmountInput';

import { networkIdAtom } from '../atoms/swapPanelAtoms';

import { type ITradeType, useTradeType } from './useTradeType';

// Mock data - replace with actual data fetching and state management
const MOCK_TOKENS = [
  { label: 'SOL', value: 'sol', price: 50.49, decimals: 9 },
  { label: 'USDC', value: 'usdc', price: 1.0, decimals: 6 },
];

export function useSwapPanel() {
  const { tradeType, setTradeType } = useTradeType();
  const [amount, setAmount] = useState('1');
  const [antiMEV, setAntiMEV] = useState(false);
  const [inputTokenSymbol, setInputTokenSymbol] = useState(
    MOCK_TOKENS[0].value,
  );
  const [outputTokenSymbol, setOutputTokenSymbol] = useState(
    MOCK_TOKENS[1].value,
  );
  const [networkId, setNetworkId] = useAtom(networkIdAtom);

  const currentExecutingToken = useMemo(() => {
    // If buying, the input token is what we pay with (e.g. USDC), output is what we get (e.g. SOL)
    // If selling, the input token is what we sell (e.g. SOL), output is what we get (e.g. USDC)
    // The AmountInputSection shows the token being bought or sold.
    return tradeType === 'buy'
      ? MOCK_TOKENS.find((t) => t.value === inputTokenSymbol)
      : MOCK_TOKENS.find((t) => t.value === inputTokenSymbol);
  }, [tradeType, inputTokenSymbol]);

  const handleAmountChange = useCallback(
    (newAmount: string) => {
      const tokenDecimals = currentExecutingToken?.decimals;
      if (validateAmountInput(newAmount, tokenDecimals)) {
        setAmount(newAmount);
      }
    },
    [currentExecutingToken?.decimals],
  );

  const handleTradeTypeChange = useCallback(
    (newTradeType: ITradeType) => {
      setTradeType(newTradeType);
      // When trade type changes, swap input and output tokens
      setInputTokenSymbol(outputTokenSymbol);
      setOutputTokenSymbol(inputTokenSymbol);
    },
    [inputTokenSymbol, outputTokenSymbol, setTradeType],
  );

  const handleAntiMEVToggle = useCallback(() => {
    setAntiMEV((prev) => !prev);
  }, []);

  const handleQuickAmountSelect = useCallback(
    (selectedAmount: string) => {
      const tokenDecimals = currentExecutingToken?.decimals;
      if (validateAmountInput(selectedAmount, tokenDecimals)) {
        setAmount(selectedAmount);
      }
    },
    [currentExecutingToken?.decimals],
  );

  const currentPaymentToken = useMemo(() => {
    return tradeType === 'buy'
      ? MOCK_TOKENS.find((t) => t.value === outputTokenSymbol) // Paying with USDC
      : MOCK_TOKENS.find((t) => t.value === inputTokenSymbol); // Selling SOL
  }, [tradeType, outputTokenSymbol, inputTokenSymbol]);

  const selectedTokenForAmountInput = useMemo(() => {
    // The token displayed in the AmountInputSection should be what the user wants to buy or sell.
    return tradeType === 'buy'
      ? MOCK_TOKENS.find((t) => t.value === inputTokenSymbol) // User wants to buy SOL
      : MOCK_TOKENS.find((t) => t.value === inputTokenSymbol); // User wants to sell SOL
  }, [inputTokenSymbol, tradeType]);

  const selectableTokensForAmountInput = useMemo(() => {
    // For "Buy", user inputs the amount of token they want to receive (e.g. SOL)
    // For "Sell", user inputs the amount of token they want to give (e.g. SOL)
    // The other token is inferred.
    // This means the selectable token in AmountInput is always the primary token of interest (e.g. SOL in SOL/USDC pair)
    // We can simplify this for now as the market detail page is usually for one main asset.
    return MOCK_TOKENS;
  }, []);

  const handleInputTokenChange = useCallback(
    (tokenSymbol: string) => {
      if (tradeType === 'buy') {
        setInputTokenSymbol(tokenSymbol); // Token to buy
        // Potentially update outputTokenSymbol if they can't be the same
        if (tokenSymbol === outputTokenSymbol) {
          const otherToken = MOCK_TOKENS.find((t) => t.value !== tokenSymbol);
          if (otherToken) setOutputTokenSymbol(otherToken.value);
        }
      } else {
        // Selling
        setInputTokenSymbol(tokenSymbol); // Token to sell
        if (tokenSymbol === outputTokenSymbol) {
          const otherToken = MOCK_TOKENS.find((t) => t.value !== tokenSymbol);
          if (otherToken) setOutputTokenSymbol(otherToken.value);
        }
      }
    },
    [tradeType, outputTokenSymbol],
  );

  const totalValue = useMemo(() => {
    const amountBN = new BigNumber(amount);
    if (amountBN.isNaN() || !currentExecutingToken?.price)
      return new BigNumber(0);
    const priceBN = new BigNumber(currentExecutingToken.price);
    return amountBN.multipliedBy(priceBN);
  }, [amount, currentExecutingToken]);

  // Mock balance
  const balance = '2'; // Replace with actual balance fetching logic
  const balanceToken = useMemo(() => {
    // Balance should be for the token the user is spending or selling
    return tradeType === 'buy' ? currentPaymentToken : currentExecutingToken;
  }, [tradeType, currentPaymentToken, currentExecutingToken]);

  return {
    amount,
    tradeType,
    antiMEV,
    networkId,
    setNetworkId,
    handleAmountChange,
    handleTradeTypeChange,
    handleAntiMEVToggle,
    handleQuickAmountSelect,

    // For AmountInputSection
    selectedTokenForAmountInput,
    selectableTokensForAmountInput,
    handleInputTokenChange,

    // For ActionButton
    currentExecutingToken,
    totalValue, // This is now a BigNumber object

    // For BalanceDisplay
    balance,
    balanceToken,

    // For general context if needed elsewhere
    inputTokenSymbol,
    outputTokenSymbol,
    mockTokens: MOCK_TOKENS, // exposing for now
  };
}
