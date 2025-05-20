import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useAtom } from 'jotai';

import { validateAmountInput } from '@onekeyhq/kit/src/utils/validateAmountInput';
import type { ISwapTokenBase } from '@onekeyhq/shared/types/swap/types';

import { networkIdAtom } from '../atoms/swapPanelAtoms';

import { type ITradeType, useTradeType } from './useTradeType';

// Mock data - replace with actual data fetching and state management
const MOCK_TOKENS = [
  {
    'networkId': 'evm--1',
    'contractAddress': '',
    'isNative': true,
    'decimals': 18,
    'name': 'Ethereum',
    'symbol': 'ETH',
    'logoURI':
      'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address--1721282106924.png',
    '_id': '6826eb9fc94e588df52502e0',
    'deleted': false,
    'price': 2000,
  },
  {
    'networkId': 'evm--1',
    'contractAddress': '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    'isNative': false,
    'decimals': 6,
    'name': 'USD Coin',
    'symbol': 'USDC',
    'logoURI':
      'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48-1720669108656.png',
    '_id': '6826eb9fc94e588df52502e1',
    'deleted': false,
    'price': 1,
  },
  {
    'networkId': 'evm--1',
    'contractAddress': '0xdac17f958d2ee523a2206206994597c13d831ec7',
    'isNative': false,
    'decimals': 6,
    'name': 'Tether USD',
    'symbol': 'USDT',
    'logoURI':
      'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address-0xdac17f958d2ee523a2206206994597c13d831ec7-1722246302921.png',
    '_id': '6826eb9fc94e588df52502e2',
    'deleted': false,
    'price': 1,
  },
];

interface ITokenInfo {
  label: string;
  value: string;
  price?: number;
  decimals?: number;
  logoURI?: string;
}

export function useSwapPanel() {
  const { tradeType, setTradeType } = useTradeType();
  const [isApproved, setIsApproved] = useState(false);
  const [amount, setAmount] = useState('1');
  const [antiMEV, setAntiMEV] = useState(false);
  const [inputTokenSymbol, setInputTokenSymbol] = useState(
    MOCK_TOKENS[0].symbol,
  );
  const [outputTokenSymbol, setOutputTokenSymbol] = useState(
    MOCK_TOKENS[1].symbol,
  );
  const [networkId, setNetworkId] = useAtom(networkIdAtom);

  const currentExecutingTokenInternal = useMemo(() => {
    // This token is the one whose amount is being input, either buying this or selling this.
    return MOCK_TOKENS.find((t) => t.symbol === inputTokenSymbol);
  }, [inputTokenSymbol]);

  const currentExecutingToken: ITokenInfo | undefined = useMemo(() => {
    const token = currentExecutingTokenInternal;
    if (!token) return undefined;
    return {
      label: token.name,
      value: token.symbol,
      price: token.price,
      decimals: token.decimals,
      logoURI: token.logoURI,
    };
  }, [currentExecutingTokenInternal]);

  const handleAmountChange = useCallback(
    (newAmount: string) => {
      const tokenDecimals = currentExecutingTokenInternal?.decimals;
      if (validateAmountInput(newAmount, tokenDecimals)) {
        setAmount(newAmount);
      }
    },
    [currentExecutingTokenInternal?.decimals],
  );

  const handleTradeTypeChange = useCallback(
    (newTradeType: ITradeType) => {
      setTradeType(newTradeType);
      // When trade type changes, swap input and output tokens
      const currentInput = inputTokenSymbol;
      const currentOutput = outputTokenSymbol;
      setInputTokenSymbol(currentOutput);
      setOutputTokenSymbol(currentInput);
    },
    [inputTokenSymbol, outputTokenSymbol, setTradeType],
  );

  const handleAntiMEVToggle = useCallback(() => {
    setAntiMEV((prev) => !prev);
  }, []);

  const handleQuickAmountSelect = useCallback(
    (selectedAmount: string) => {
      const tokenDecimals = currentExecutingTokenInternal?.decimals;
      if (validateAmountInput(selectedAmount, tokenDecimals)) {
        setAmount(selectedAmount);
      }
    },
    [currentExecutingTokenInternal?.decimals],
  );

  const currentPaymentTokenInternal = useMemo(() => {
    // If buying, payment token is the outputTokenSymbol (e.g. USDC)
    // If selling, payment token is the inputTokenSymbol (e.g. SOL, which is also currentExecutingTokenInternal)
    return tradeType === 'buy'
      ? MOCK_TOKENS.find((t) => t.symbol === outputTokenSymbol)
      : currentExecutingTokenInternal;
  }, [tradeType, outputTokenSymbol, currentExecutingTokenInternal]);

  const selectedTokenForAmountInput: ITokenInfo | undefined = useMemo(() => {
    // The token displayed in the AmountInputSection should be what the user wants to buy or sell.
    // This is always the currentExecutingToken.
    return currentExecutingToken;
  }, [currentExecutingToken]);

  const selectableTokensForAmountInput: ITokenInfo[] = useMemo(() => {
    return MOCK_TOKENS.map((t) => ({
      label: t.name,
      value: t.symbol, // value here means symbol for selection
      price: t.price,
      decimals: t.decimals,
      logoURI: t.logoURI,
    }));
  }, []);

  const handleInputTokenChange = useCallback(
    (tokenSymbol: string) => {
      setInputTokenSymbol(tokenSymbol);
      if (tokenSymbol === outputTokenSymbol) {
        const otherToken = MOCK_TOKENS.find((t) => t.symbol !== tokenSymbol);
        if (otherToken) {
          setOutputTokenSymbol(otherToken.symbol);
        } else if (MOCK_TOKENS.length > 0) {
          const fallbackSymbol =
            MOCK_TOKENS.find((t) => t.symbol !== tokenSymbol)?.symbol ??
            MOCK_TOKENS[0]?.symbol;
          if (fallbackSymbol) {
            setOutputTokenSymbol(fallbackSymbol);
          }
        }
      }
    },
    [outputTokenSymbol],
  );

  const totalValue = useMemo(() => {
    const amountBN = new BigNumber(amount);
    if (amountBN.isNaN() || !currentExecutingTokenInternal?.price) {
      return new BigNumber(0);
    }
    const priceBN = new BigNumber(currentExecutingTokenInternal.price);
    return amountBN.multipliedBy(priceBN);
  }, [amount, currentExecutingTokenInternal]);

  const balance = '2';
  const balanceToken: ITokenInfo | undefined = useMemo(() => {
    const token =
      tradeType === 'buy'
        ? currentPaymentTokenInternal
        : currentExecutingTokenInternal;
    if (!token) return undefined;
    return {
      label: token.name,
      value: token.symbol,
      price: token.price,
      decimals: token.decimals,
      logoURI: token.logoURI,
    };
  }, [tradeType, currentPaymentTokenInternal, currentExecutingTokenInternal]);

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

    // For ApproveButton
    isApproved,
    setIsApproved,

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
    mockTokens: MOCK_TOKENS.map((t) => ({
      label: t.name,
      value: t.symbol,
      price: t.price,
      decimals: t.decimals,
      logoURI: t.logoURI,
      networkId: t.networkId,
      contractAddress: t.contractAddress,
      isNative: t.isNative,
      _id: t._id,
    })),
  };
}
