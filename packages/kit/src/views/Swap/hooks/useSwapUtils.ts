import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { useIsVerticalLayout } from '@onekeyhq/components';

import { useAppSelector, useDebounce } from '../../../hooks';
import { div, formatAmount, lte, minus, multiply } from '../utils';

import { useTokenPrice } from './useSwapTokenUtils';

import type {
  ISlippage,
  ISlippageAuto,
  TokenCoingeckoType,
  TransactionDetails,
} from '../typings';

export function useSummaryTx() {
  const intl = useIntl();
  return useCallback(
    (tx: TransactionDetails) => {
      if (tx.type === 'approve') {
        if (tx.approval) {
          return `${intl.formatMessage({ id: 'title__approve' })} ${
            tx.approval?.token.symbol
          }`;
        }
        return `${intl.formatMessage({ id: 'title__approve' })}`;
      }
      if (tx.type === 'swap') {
        if (tx.tokens) {
          const { from, to } = tx.tokens;
          const a = `${formatAmount(from.amount, 4)} ${from.token.symbol}`;
          const b = `${formatAmount(to.amount, 4)} ${to.token.symbol}`;
          return `${a} → ${b}`;
        }
      }
      return '';
    },
    [intl],
  );
}

export function usePriceImpact() {
  const inputToken = useAppSelector((s) => s.swap.inputToken);
  const outputToken = useAppSelector((s) => s.swap.outputToken);
  const inputPrice = useTokenPrice(inputToken);
  const outputPrice = useTokenPrice(outputToken);
  const instantRate = useAppSelector((s) => s.swap.quote?.instantRate);
  if (outputPrice && inputPrice && instantRate) {
    const rate = div(inputPrice, outputPrice);
    if (lte(instantRate, rate)) {
      const percent = multiply(div(minus(rate, instantRate), rate), 100);
      return Number(percent);
    }
  }
  return undefined;
}

export function useSlippageLevels() {
  const recommendedSlippage = useAppSelector(
    (s) => s.swapTransactions.recommendedSlippage,
  );
  return useMemo(
    () =>
      ({
        stable: recommendedSlippage?.stable ?? '0.1',
        popular: recommendedSlippage?.popular ?? '0.5',
        others: recommendedSlippage?.others ?? '1',
      } as Record<TokenCoingeckoType, string>),
    [recommendedSlippage],
  );
}

export function useSwapSlippageAuto(): ISlippageAuto {
  const inputToken = useAppSelector((s) => s.swap.inputToken);
  const outputToken = useAppSelector((s) => s.swap.outputToken);
  const slippage = useAppSelector((s) => s.swapTransactions.slippage);
  const coingeckoIds = useAppSelector((s) => s.swapTransactions.coingeckoIds);
  const levels = useSlippageLevels();

  const getSlippageByCoingeckoId = useCallback(
    (coingeckoId?: string) => {
      if (!coingeckoIds || !coingeckoId) {
        return;
      }
      const { popular: popularCoingeckoIds, stable: stableCoingeckoIds } =
        coingeckoIds;
      if (stableCoingeckoIds && stableCoingeckoIds.includes(coingeckoId)) {
        return { type: 'stable' as TokenCoingeckoType, value: levels.stable };
      }
      if (popularCoingeckoIds && popularCoingeckoIds.includes(coingeckoId)) {
        return { type: 'popular' as TokenCoingeckoType, value: levels.popular };
      }
      return { type: 'others' as TokenCoingeckoType, value: levels.others };
    },
    [coingeckoIds, levels],
  );

  return useMemo(() => {
    const auto = !slippage || slippage.mode === 'auto';
    if (auto) {
      if (inputToken && outputToken) {
        const inputSlippage = getSlippageByCoingeckoId(inputToken.coingeckoId);
        const outputSlippage = getSlippageByCoingeckoId(
          outputToken.coingeckoId,
        );
        return Number(inputSlippage?.value) > Number(outputSlippage?.value)
          ? inputSlippage
          : outputSlippage;
      }
    }
  }, [slippage, inputToken, outputToken, getSlippageByCoingeckoId]);
}

export function useSwapSlippage(): ISlippage {
  const slippage = useAppSelector((s) => s.swapTransactions.slippage);
  const slippageAutoMode = useSwapSlippageAuto();
  const value = useMemo<ISlippage>(() => {
    if (slippageAutoMode) {
      return { mode: 'auto', value: slippageAutoMode.value ?? '1' };
    }
    return { mode: slippage?.mode, value: slippage?.value ?? '1' };
  }, [slippageAutoMode, slippage]);
  return useDebounce(value, 500);
}

export const useSwapMinimumReceivedAmount = () => {
  const quote = useAppSelector((s) => s.swap.quote);
  const { value: swapSlippagePercent } = useSwapSlippage();
  return useMemo(() => {
    if (!quote) {
      return;
    }
    const { minAmountOut, estimatedBuyAmount, buyAmount } = quote;
    if (minAmountOut) {
      return Number(minAmountOut);
    }
    const amount = estimatedBuyAmount || buyAmount;
    if (amount) {
      const bn = new BigNumber(amount);
      if (!bn.isNaN()) {
        return bn
          .minus(bn.multipliedBy(Number(swapSlippagePercent) / 100))
          .toFixed();
      }
    }
  }, [quote, swapSlippagePercent]);
};

export const useSwapChartMode = () => {
  const swapChartMode = useAppSelector((s) => s.swapTransactions.swapChartMode);
  const isSmall = useIsVerticalLayout();
  if (isSmall) {
    return 'simple';
  }
  return swapChartMode ?? 'chart';
};
