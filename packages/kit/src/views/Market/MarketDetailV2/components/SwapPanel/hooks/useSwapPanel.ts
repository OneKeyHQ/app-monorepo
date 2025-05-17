import { useCallback, useMemo, useState } from 'react';

export type ITradeType = 'buy' | 'sell';

// Mock data - replace with actual data fetching and state management
const MOCK_TOKENS = [
  { label: 'SOL', value: 'sol', price: 50.49 },
  { label: 'USDC', value: 'usdc', price: 1.0 },
];

export function useSwapPanel() {
  const [amount, setAmount] = useState('1');
  const [tradeType, setTradeType] = useState<ITradeType>('buy');
  const [antiMEV, setAntiMEV] = useState(false);
  const [inputTokenSymbol, setInputTokenSymbol] = useState(
    MOCK_TOKENS[0].value,
  ); // Default to SOL for buying
  const [outputTokenSymbol, setOutputTokenSymbol] = useState(
    MOCK_TOKENS[1].value,
  ); // Default to USDC for buying
  const [showUnsupportedSwapWarning] = useState(true);

  const handleAmountChange = useCallback((newAmount: string) => {
    setAmount(newAmount);
  }, []);

  const handleTradeTypeChange = useCallback(
    (newTradeType: ITradeType) => {
      setTradeType(newTradeType);
      // When trade type changes, swap input and output tokens
      setInputTokenSymbol(outputTokenSymbol);
      setOutputTokenSymbol(inputTokenSymbol);
    },
    [inputTokenSymbol, outputTokenSymbol],
  );

  const handleAntiMEVToggle = useCallback(() => {
    setAntiMEV((prev) => !prev);
  }, []);

  const handleQuickAmountSelect = useCallback((selectedAmount: string) => {
    setAmount(selectedAmount);
  }, []);

  const currentExecutingToken = useMemo(() => {
    // If buying, the input token is what we pay with (e.g. USDC), output is what we get (e.g. SOL)
    // If selling, the input token is what we sell (e.g. SOL), output is what we get (e.g. USDC)
    // The AmountInputSection shows the token being bought or sold.
    return tradeType === 'buy'
      ? MOCK_TOKENS.find((t) => t.value === inputTokenSymbol)
      : MOCK_TOKENS.find((t) => t.value === inputTokenSymbol);
  }, [tradeType, inputTokenSymbol]);

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
    const numericAmount = parseFloat(amount);
    if (Number.isNaN(numericAmount) || !currentExecutingToken) return 0;
    return numericAmount * currentExecutingToken.price;
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
    totalValue,

    // For BalanceDisplay
    balance,
    balanceToken,

    // For general context if needed elsewhere
    inputTokenSymbol,
    outputTokenSymbol,
    mockTokens: MOCK_TOKENS, // exposing for now
    showUnsupportedSwapWarning,
  };
}
