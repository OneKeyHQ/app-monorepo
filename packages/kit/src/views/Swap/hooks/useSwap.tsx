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
  setError,
  setInputToken,
  setLoading,
  setOutputToken,
  setQuote,
  setTypedValue,
  switchTokens,
} from '../../../store/reducers/swap';
import { Token } from '../../../store/typings';
import { ApprovalState, SwapError, SwapQuote } from '../typings';

import { useHasPendingApproval } from './useTransactions';

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
    return this.toNumber().toFixed(0);
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
    backgroundApiProxy.dispatch(setQuote(undefined));
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

export function useSwapQuoteRequestParams(): QuoteRequestParams | undefined {
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

export const useSwapQuoteCallback = function (
  options: { silent: boolean } = { silent: true },
) {
  const requestParams = useSwapQuoteRequestParams();
  const { silent } = options;
  const params = useDebounce(requestParams, 500);
  const baseUrl = useSwapQuoteBaseUrl();
  const onSwapQuote = useCallback(async () => {
    if (!params) {
      backgroundApiProxy.dispatch(setQuote(undefined));
      return;
    }
    if (!silent) {
      backgroundApiProxy.dispatch(setLoading(true));
    }
    backgroundApiProxy.dispatch(setError(undefined));
    try {
      const result = await client.get(baseUrl, { params });
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const quoteData = result.data.data as SwapQuote;
      quoteData.payloadType = 'InternalSwap';
      backgroundApiProxy.dispatch(setQuote(quoteData));
    } catch (_) {
      backgroundApiProxy.dispatch(setError(SwapError.QuoteFailed));
    } finally {
      if (!silent) {
        backgroundApiProxy.dispatch(setLoading(false));
      }
    }
  }, [params, silent, baseUrl]);
  return onSwapQuote;
};

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

export function useApproveState(
  token?: Token,
  spender?: string,
  target?: string,
) {
  const allowance = useTokenAllowance(token, spender);
  const pendingApproval = useHasPendingApproval(
    token?.tokenIdOnNetwork,
    spender,
  );
  return useMemo(() => {
    if (!allowance || !target) {
      return ApprovalState.UNKNOWN;
    }
    if (allowance.gte(target)) {
      return ApprovalState.APPROVED;
    }
    if (pendingApproval) {
      return ApprovalState.PENDING;
    }
    return ApprovalState.NOT_APPROVED;
  }, [allowance, target, pendingApproval]);
}

export function useSwap() {
  const {
    independentField,
    typedValue,
    inputToken,
    outputToken,
    loading: isSwapLoading,
    quote: swapQuote,
    error: swapError,
  } = useSwapState();
  const inputBalance = useTokenBalance(inputToken);
  const outputBalance = useTokenBalance(outputToken);
  const inputAmount = useTokenAmount(inputToken, swapQuote?.sellAmount);
  const outputAmount = useTokenAmount(outputToken, swapQuote?.buyAmount);
  const approveState = useApproveState(
    inputToken,
    swapQuote?.allowanceTarget,
    swapQuote?.sellAmount,
  );
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
