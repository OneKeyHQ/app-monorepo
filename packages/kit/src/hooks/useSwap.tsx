/* eslint-disable @typescript-eslint/no-unsafe-member-access,@typescript-eslint/restrict-template-expressions */
import { useCallback, useEffect, useState } from 'react';

import axios from 'axios';
import BigNumber from 'bignumber.js';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import {
  setIndependentField as _setIndependentField,
  switchInputOutput as _switchInputOutput,
  setInput,
  setInputAmount,
  setOutput,
  setOutputAmount,
  update,
} from '../store/reducers/swap';
import { ValuedToken } from '../store/typings';

import { useActiveWalletAccount, useAppSelector } from './redux';
import { useDebounce } from './useDebounce';

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

const swapClient = axios.create();

const NETWORKS: Record<string, string> = {
  '1': 'https://defi.onekey.so/onestep/api/v1/trade_order/quote?chainID=ethereum',
  '42': 'https://kovan.api.0x.org/swap/v1/quote',
  '56': 'https://defi.onekey.so/onestep/api/v1/trade_order/quote?chainID=bsc',
  '3': 'https://defi.onekey.so/onestep/api/v1/trade_order/quote?chainID=ropsten',
  // '128': 'https://0x.onekey.so/swap/v1/quote', // heco
  '137':
    'https://defi.onekey.so/onestep/api/v1/trade_order/quote?chainID=polygon',
  '250':
    'https://defi.onekey.so/onestep/api/v1/trade_order/quote?chainID=fantom',
  '43114':
    'https://defi.onekey.so/onestep/api/v1/trade_order/quote?chainID=avalanche',
};

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

enum SwapError {
  QuoteFailed = 'QuoteFailed',
  InsufficientBalance = 'InsufficientBalance',
}

export function useSwapQuote() {
  const { dispatch } = backgroundApiProxy;
  const { network, account } = useActiveWalletAccount();
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const baseUrl = useSwapQuoteBaseUrl();
  const { input, output, independentField, inputAmount, outputAmount, value } =
    useAppSelector((s) => s.swap);
  const [data, setData] = useState<SwapQuote>();
  const v = useDebounce(value, 1000);
  useEffect(() => {
    async function main() {
      if (!(input && output && (inputAmount || outputAmount))) {
        return;
      }
      if (input && inputAmount) {
        // is Native Token
        if (account && network) {
          if (!input.tokenIdOnNetwork) {
            const balance = await backgroundApiProxy.engine.getAccountBalance(
              account.id,
              network.id,
              [],
              true,
            );
            const bnBalance = new BigNumber(balance.main || '0');
            const bnInput = new BigNumber(inputAmount);
            if (bnBalance.lte(bnInput)) {
              setError(SwapError.InsufficientBalance);
              return;
            }
            // is ERC20 Token
          } else {
            const balance = await backgroundApiProxy.engine.getAccountBalance(
              account.id,
              network.id,
              [input.tokenIdOnNetwork],
              false,
            );
            const bnBalance = new BigNumber(
              balance[input.tokenIdOnNetwork] || '0',
            );
            const bnInput = new BigNumber(inputAmount);
            if (bnBalance.lte(bnInput)) {
              setError(SwapError.InsufficientBalance);
              return;
            }
          }
        }
      }
      setLoading(true);
      setData(undefined);
      try {
        let total = new BigNumber(1);
        let amount = new BigNumber(0);
        const base = new BigNumber(10);
        let decimals = 1;
        if (independentField === 'INPUT') {
          amount = new BigNumber(inputAmount);
          decimals = input.decimals ?? 1;
        } else {
          amount = new BigNumber(outputAmount);
          decimals = output.decimals ?? 1;
        }
        total = base.exponentiatedBy(decimals).multipliedBy(amount);

        const params = {
          sellToken:
            input?.tokenIdOnNetwork ||
            '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
          buyToken:
            output?.tokenIdOnNetwork ||
            '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
          sellAmount:
            independentField === 'INPUT'
              ? total.toFormat({ groupSeparator: '' })
              : undefined,
          buyAmount:
            independentField === 'INPUT'
              ? undefined
              : total.toFormat({ groupSeparator: '' }),
          slippagePercentage: 0.03,
          feeRecipient: '0xc1e92BD5d1aa6e5f5F299D0490BefD9D8E5a887a',
          affiliateAddress: '0x4F5FC02bE49Bea15229041b87908148b04c14717',
        };

        let result: any;
        try {
          result = await swapClient.get(baseUrl, { params });
        } catch (e: any) {
          setError(e.message);
          return;
        }
        const resultData = result.data.data as SwapQuote;
        if (!resultData) {
          return;
        }
        if (independentField === 'INPUT') {
          const totalIn = new BigNumber(resultData.buyAmount);
          const baseIn = new BigNumber(10);
          const decimalsIn = new BigNumber(output.decimals);
          dispatch(
            setOutputAmount(
              totalIn.div(baseIn.exponentiatedBy(decimalsIn)).toFixed(2),
            ),
          );
        } else {
          const totalOut = new BigNumber(resultData.sellAmount);
          const baseOut = new BigNumber(10);
          const decimalsOUt = new BigNumber(input.decimals);
          const inAmount = totalOut.div(baseOut.exponentiatedBy(decimalsOUt));
          dispatch(setInputAmount(inAmount.toFixed(2)));
        }
        if (
          account &&
          network &&
          resultData.sellTokenAddress !==
            '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
        ) {
          const allowance = await backgroundApiProxy.engine.getTokenAllowance({
            networkId: network?.id,
            accountId: account.id,
            tokenIdOnNetwork: resultData.sellTokenAddress,
            spender: resultData.allowanceTarget,
          });
          // console.log('allowance', allowance, 'resultData.sellAmount', resultData.sellAmount)
          const bnAllowance = new BigNumber(allowance || '0');
          const bnInput = new BigNumber(resultData.sellAmount || '0');
          resultData.needApprove = bnAllowance.lt(bnInput);
        }
        setData(resultData);
      } finally {
        setLoading(false);
      }
    }
    main();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v]);

  const refresh = useCallback(() => {
    dispatch(update());
  }, [dispatch]);
  return { refresh, data, error, isLoading };
}

export const useSwap = () => {
  const { dispatch } = backgroundApiProxy;
  const { input, output, independentField, inputAmount, outputAmount } =
    useAppSelector((s) => s.swap);

  const setIn = useCallback(
    (token: ValuedToken) => {
      dispatch(setInput(token));
    },
    [dispatch],
  );
  const setInAmount = useCallback(
    (value: string) => {
      dispatch(setInputAmount(value));
    },
    [dispatch],
  );
  const setOut = useCallback(
    (token: ValuedToken) => {
      dispatch(setOutput(token));
    },
    [dispatch],
  );
  const setOutAmount = useCallback(
    (value: string) => {
      dispatch(setOutputAmount(value));
    },
    [dispatch],
  );
  const setIndependentField = useCallback(
    (value: 'INPUT' | 'OUTPUT') => {
      dispatch(_setIndependentField(value));
    },
    [dispatch],
  );
  const switchInputOutput = useCallback(() => {
    dispatch(_switchInputOutput());
  }, [dispatch]);

  return {
    input,
    output,
    inputAmount,
    outputAmount,
    independentField,
    setIn,
    setOut,
    setInAmount,
    setOutAmount,
    setIndependentField,
    switchInputOutput,
  };
};
