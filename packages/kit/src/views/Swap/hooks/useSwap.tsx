import { useCallback, useEffect, useMemo, useState } from 'react';

import axios from 'axios';
import BigNumber from 'bignumber.js';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  useActiveWalletAccount,
  useAppSelector,
  useSettings,
} from '../../../hooks/redux';
import { useDebounce } from '../../../hooks/useDebounce';
import { useManageTokens } from '../../../hooks/useManageTokens';
import {
  refresh,
  reset,
  setInputToken,
  setOutputToken,
  setTypedValue,
  switchTokens,
} from '../../../store/reducers/swap';
import { Token } from '../../../store/typings';

import { useHasPendingApproval } from './useTransactions';

export type SwapQuote = {
  price: string;
  guaranteedPrice: string;
  to: string;
  data?: string;
  value?: string;
  gasPrice?: string;
  gas?: string;
  estimatedGas?: string;
  protocolFee?: string;
  minimumProtocolFee?: string;
  buyAmount: string;
  sellAmount: string;
  sources?: string;
  buyTokenAddress: string;
  sellTokenAddress: string;
  estimatedGasTokenRefund?: string;
  allowanceTarget: string;
  needApprove?: boolean;
};

type QuoteRequestParams = {
  sellToken?: string;
  sellAmount?: string;
  buyToken?: string;
  buyAmount?: string;
  buyTokenPercentageFee?: string;
  takerAddress?: string;
  slippagePercentage?: number;
  feeRecipient?: string;
  affiliateAddress?: string;
};

const client = axios.create();
const defaultAddress = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const feeRecipient = '0xc1e92BD5d1aa6e5f5F299D0490BefD9D8E5a887a';
const affiliateAddress = '0x4F5FC02bE49Bea15229041b87908148b04c14717';

enum Chains {
  MAINNET = '1',
  ROPSTEN = '3',
  KOVAN = '42',
  BSC = '56',
  POLYGON = '137',
  FANTOM = '250',
  AVALANCHE = '43114',
}

const NETWORKS: Record<string, string> = {
  [Chains.MAINNET]:
    'https://defi.onekey.so/onestep/api/v1/trade_order/quote?chainID=ethereum',
  [Chains.ROPSTEN]:
    'https://defi.onekey.so/onestep/api/v1/trade_order/quote?chainID=ropsten',
  [Chains.KOVAN]: 'https://kovan.api.0x.org/swap/v1/quote',
  [Chains.BSC]:
    'https://defi.onekey.so/onestep/api/v1/trade_order/quote?chainID=bsc',

  [Chains.POLYGON]:
    'https://defi.onekey.so/onestep/api/v1/trade_order/quote?chainID=polygon',
  [Chains.FANTOM]:
    'https://defi.onekey.so/onestep/api/v1/trade_order/quote?chainID=fantom',
  [Chains.AVALANCHE]:
    'https://defi.onekey.so/onestep/api/v1/trade_order/quote?chainID=avalanche',
};

export enum SwapError {
  QuoteFailed = 'QuoteFailed',
  InsufficientBalance = 'InsufficientBalance',
}
class TokenAmount {
  amount: BigNumber;

  decimals: BigNumber;

  value: BigNumber;

  base = new BigNumber(10);

  constructor(public token: Token, public typedValue: string) {
    this.value = new BigNumber(typedValue);
    this.decimals = new BigNumber(token.decimals);
    this.amount = this.base
      .exponentiatedBy(this.decimals)
      .multipliedBy(this.value);
  }

  toNumber() {
    return this.amount;
  }

  toFormat() {
    return this.toNumber().toFormat({ groupSeparator: '' });
  }
}

export function useTokenAmount(token?: Token, amount?: string) {
  if (!token || !amount) return;
  const bn = new BigNumber(amount);
  const decimals = new BigNumber(token.decimals);
  const base = new BigNumber(10);
  const value = bn.dividedBy(base.exponentiatedBy(decimals));
  return new TokenAmount(token, value.toString());
}

export function isStableCurrency(currency?: Token) {
  const stable = ['USDT', 'DAI', 'BUSD', 'USDC'];
  return currency && currency.symbol && stable.includes(currency.symbol);
}

export function useSwapEnabled() {
  const { network } = useActiveWalletAccount();
  const chainId = network?.extraInfo?.chainId;
  const index = String(+chainId);
  return !!NETWORKS[index];
}

export function useSwapQuoteBaseUrl(): string {
  const { network } = useActiveWalletAccount();
  const chainId = network?.extraInfo?.chainId;
  const index = chainId ? String(+chainId) : '1';
  // Since we have mainnet as fallback,
  // there should be alwasys an url to return
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return NETWORKS[index];
}

export function useSwapState() {
  return useAppSelector((s) => s.swap);
}

export function useSwapActionHandlers() {
  const onRefresh = useCallback(() => {
    backgroundApiProxy.dispatch(refresh());
  }, []);
  const onSwitchTokens = useCallback(() => {
    backgroundApiProxy.dispatch(switchTokens());
  }, []);
  const onUserInput = useCallback(
    (independentField: 'INPUT' | 'OUTPUT', typedValue: string) => {
      backgroundApiProxy.dispatch(
        setTypedValue({ independentField, typedValue }),
      );
    },
    [],
  );
  const onSelectToken = useCallback(
    (token: Token, typedField: 'INPUT' | 'OUTPUT') => {
      if (typedField === 'INPUT') {
        backgroundApiProxy.dispatch(setInputToken(token));
      } else {
        backgroundApiProxy.dispatch(setOutputToken(token));
      }
    },
    [],
  );
  const onReset = useCallback(() => {
    backgroundApiProxy.dispatch(reset());
  }, []);
  return { onUserInput, onSelectToken, onSwitchTokens, onRefresh, onReset };
}

export function useTokenBalance(token?: Token): BigNumber | undefined {
  const { balances } = useManageTokens();
  useEffect(() => {
    if (token && balances[token.tokenIdOnNetwork || 'main'] === undefined) {
      backgroundApiProxy.serviceToken.fetchTokenBalance([
        token.tokenIdOnNetwork,
      ]);
    }
  }, [token, balances]);
  const balance = balances[token?.tokenIdOnNetwork || 'main'];
  if (!token || !balance) {
    return;
  }
  return new TokenAmount(token, balance).toNumber();
}

export function useQuoteRequestParams(): QuoteRequestParams | undefined {
  const { inputToken, outputToken, independentField, typedValue } =
    useSwapState();
  const { swapSlippagePercent } = useSettings();
  return useMemo(() => {
    if (!inputToken || !outputToken || !typedValue) {
      return;
    }
    const params: QuoteRequestParams = {
      sellToken: inputToken.tokenIdOnNetwork || defaultAddress,
      buyToken: outputToken.tokenIdOnNetwork || defaultAddress,
      slippagePercentage: +swapSlippagePercent / 100,
      feeRecipient,
      affiliateAddress,
    };
    if (independentField === 'INPUT') {
      params.sellAmount = new TokenAmount(inputToken, typedValue).toFormat();
    } else {
      params.buyAmount = new TokenAmount(outputToken, typedValue).toFormat();
    }
    return params;
  }, [
    inputToken,
    outputToken,
    typedValue,
    swapSlippagePercent,
    independentField,
  ]);
}

export function useSwapQuote(params?: QuoteRequestParams) {
  const [swapQuote, setSwapQuote] = useState<SwapQuote>();
  const [isSwapLoading, setSwapLoading] = useState(false);
  const [swapError, setSwapErr] = useState<SwapError>();
  const baseUrl = useSwapQuoteBaseUrl();
  const { refreshRef } = useSwapState();

  useEffect(() => {
    async function main() {
      if (!params) {
        setSwapQuote(undefined);
        return;
      }
      setSwapLoading(true);
      setSwapErr(undefined);
      try {
        const result = await client.get(baseUrl, { params });
        // eslint-disable-next-line
        const quoteData = result.data.data as SwapQuote;
        setSwapQuote(quoteData);
      } catch (_) {
        setSwapErr(SwapError.QuoteFailed);
      } finally {
        setSwapLoading(false);
      }
    }
    main();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, baseUrl, refreshRef]);

  return { swapQuote, isSwapLoading, swapError };
}

export function useTokenAllowance(token?: Token, spender?: string) {
  const { accountId, networkId } = useActiveWalletAccount();
  const [allowance, setAllowance] = useState<BigNumber>();
  const onQuery = useCallback(async () => {
    if (accountId && networkId && token && token.tokenIdOnNetwork && spender) {
      const allowanceData = await backgroundApiProxy.engine.getTokenAllowance({
        spender,
        networkId,
        accountId,
        tokenIdOnNetwork: token?.tokenIdOnNetwork,
      });
      if (allowanceData !== undefined) {
        const number = new TokenAmount(token, allowanceData).toNumber();
        setAllowance(number);
      } else {
        setAllowance(undefined);
      }
    }
  }, [accountId, networkId, token, spender]);
  useEffect(() => {
    onQuery();
    const timer = setInterval(onQuery, 1000 * 10);
    return () => {
      setAllowance(undefined);
      clearInterval(timer);
    };
  }, [onQuery]);
  return allowance;
}

export enum ApprovalState {
  UNKNOWN = 'UNKNOWN',
  NOT_APPROVED = 'NOT_APPROVED',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
}

export function useApproveState(token?: Token, spender?: string) {
  const allowance = useTokenAllowance(token, spender);
  const pendingApproval = useHasPendingApproval(
    token?.tokenIdOnNetwork,
    spender,
  );
  const balance = useTokenBalance(token);
  return useMemo(() => {
    if (!allowance || !balance) {
      return ApprovalState.UNKNOWN;
    }
    if (allowance.gte(balance)) {
      return ApprovalState.APPROVED;
    }
    if (pendingApproval) {
      return ApprovalState.PENDING;
    }
    return ApprovalState.NOT_APPROVED;
  }, [allowance, balance, pendingApproval]);
}

export function useSwap() {
  const { independentField, typedValue, inputToken, outputToken } =
    useSwapState();
  const inputBalance = useTokenBalance(inputToken);
  const outputBalance = useTokenBalance(outputToken);
  const params = useQuoteRequestParams();
  const debounceParams = useDebounce(params, 1000);
  const { isSwapLoading, swapQuote, swapError } = useSwapQuote(debounceParams);
  const inputAmount = useTokenAmount(inputToken, swapQuote?.sellAmount);
  const outputAmount = useTokenAmount(outputToken, swapQuote?.buyAmount);
  const approveState = useApproveState(inputToken, swapQuote?.allowanceTarget);
  const balanceError =
    inputAmount && inputBalance && inputBalance.lt(inputAmount.toNumber())
      ? SwapError.InsufficientBalance
      : undefined;
  const error = swapError || balanceError;
  const dependentField = independentField === 'INPUT' ? 'OUTPUT' : 'INPUT';
  const formattedAmounts = {
    [independentField]: typedValue,
    [dependentField]:
      dependentField === 'INPUT'
        ? inputAmount?.value.toFixed(4) || ''
        : outputAmount?.value.toFixed(4) || '',
  } as { 'INPUT'?: string; 'OUTPUT'?: string };

  return {
    error,
    isSwapLoading,
    inputAmount,
    outputAmount,
    inputBalance,
    outputBalance,
    swapQuote,
    formattedAmounts,
    approveState,
  };
}
