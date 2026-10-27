import { useMemo } from 'react';

import { useStockDetail } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/StockDetailContext';
import { resolveMarketStockId } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/resolveIsStockToken';
import { getStockPortfolioVariantKey } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/stockTokenVariant';
import { useCurrencyPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IMarketAccountPortfolioDisplayItem,
  IMarketAccountPortfolioPnl,
  IMarketStockTokenVariant,
} from '@onekeyhq/shared/types/marketV2';

import { useCurrency } from '../../../components/Currency';
import { isTradePositionVisible } from '../utils/tradePositionUtils';

import type { useSwapProSupportNetworksTokenList } from './useSwapPro';

type IStockPositions = Pick<
  ReturnType<typeof useSwapProSupportNetworksTokenList>,
  'hasAccount' | 'positionTokenList' | 'positionLoading' | 'resolvedNetworkIds'
> & { pnlMap: Map<string, IMarketAccountPortfolioPnl> };

export function useSwapStockPortfolioData(
  positions?: IStockPositions,
  displayScope?: {
    stockId?: string;
    tokenVariants: IMarketStockTokenVariant[];
  },
) {
  const { stockId: committedStockId, tokenVariants: committedVariants } =
    useStockDetail();
  const stockId = displayScope ? displayScope.stockId : committedStockId;
  const tokenVariants = displayScope
    ? displayScope.tokenVariants
    : committedVariants;
  const currencyInfo = useCurrency();
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const hasAccount = Boolean(positions?.hasAccount);
  const portfolioData = useMemo<IMarketAccountPortfolioDisplayItem[]>(() => {
    if (!hasAccount || !stockId) return [];
    return (positions?.positionTokenList ?? []).flatMap((token) => {
      const variant = tokenVariants.find((candidate) =>
        equalTokenNoCaseSensitive({ token1: candidate, token2: token }),
      );
      if (
        !variant &&
        resolveMarketStockId(token) !== stockId &&
        token.stock?.underlyingAssetTicker?.trim().toUpperCase() !== stockId
      ) {
        return [];
      }
      return [
        {
          accountAddress: token.accountAddress ?? '',
          networkId: token.networkId,
          tokenAddress: token.contractAddress,
          tokenId: variant?.tokenId,
          symbol: token.symbol,
          amount: token.balanceParsed ?? '',
          tokenPrice: token.price ?? '',
          totalPrice: token.fiatValue ?? '',
          currency: token.currency ?? currencyInfo.id,
          issuer: variant?.issuer,
          tokenLogoUrl: token.logoURI ?? variant?.logoUrl,
          networkLogoUrl: token.networkLogoURI ?? variant?.networkLogoUrl,
          pnl: positions?.pnlMap.get(
            `${token.networkId}-${token.contractAddress}`,
          ),
        },
      ];
    });
  }, [
    currencyInfo.id,
    hasAccount,
    positions?.pnlMap,
    positions?.positionTokenList,
    stockId,
    tokenVariants,
  ]);
  const positionListData = useMemo(
    () =>
      portfolioData.filter((item) =>
        isTradePositionVisible({
          balance: item.amount,
          fiatValue: item.totalPrice,
          currency: item.currency,
          currencyMap,
          isStock: true,
        }),
      ),
    [currencyMap, portfolioData],
  );
  const resolvedVariantKeys = useMemo(
    () =>
      hasAccount
        ? tokenVariants
            .filter((variant) =>
              positions?.resolvedNetworkIds.includes(variant.networkId),
            )
            .map(getStockPortfolioVariantKey)
        : [],
    [hasAccount, positions?.resolvedNetworkIds, tokenVariants],
  );

  return {
    portfolioData,
    positionListData,
    resolvedVariantKeys,
    hasAccount,
    isRefreshing: Boolean(positions?.positionLoading),
  };
}
