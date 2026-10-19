import type { PropsWithChildren } from 'react';
import { createContext, useCallback, useContext } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, Stack, YStack } from '@onekeyhq/components';
import { Portfolio } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/InformationTabs/components/Portfolio';
import { useStockDetail } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/StockDetailContext';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IMarketAccountPortfolioDisplayItem } from '@onekeyhq/shared/types/marketV2';

import { useSwapStockPortfolioData } from '../../hooks/useSwapStockPortfolioData';

import { SwapSmoothReveal } from './SwapSmoothReveal';
import { useSwapStockSelection } from './SwapStockMarketProvider';
import { useSwapStockPositions } from './SwapStockPositions';

type ISwapStockPortfolio = ReturnType<typeof useSwapStockPortfolioData>;

const SwapStockPortfolioContext = createContext<
  ISwapStockPortfolio | undefined
>(undefined);

export function SwapStockPortfolioProvider({ children }: PropsWithChildren) {
  const portfolio = useSwapStockPortfolioData();
  return (
    <SwapStockPortfolioContext.Provider value={portfolio}>
      {children}
    </SwapStockPortfolioContext.Provider>
  );
}

export function useSwapStockPortfolio() {
  return useContext(SwapStockPortfolioContext);
}

// The Market stock page's "My position" table, listing every token of the
// current stock the account holds. Hidden until there is something to list.
export function SwapStockMyPosition() {
  const intl = useIntl();
  const portfolio = useSwapStockPortfolio();
  const positions = useSwapStockPositions();
  const selection = useSwapStockSelection();
  const { stockId, tokenVariants } = useStockDetail();
  const selectPosition = useCallback(
    (item: IMarketAccountPortfolioDisplayItem) => {
      const identity = {
        networkId: item.networkId,
        contractAddress: item.tokenAddress,
      };
      const variant = tokenVariants.find((candidate) =>
        equalTokenNoCaseSensitive({ token1: candidate, token2: identity }),
      );
      const token = positions?.positionTokenList.find((candidate) =>
        equalTokenNoCaseSensitive({ token1: candidate, token2: identity }),
      );
      if (token) {
        void selection?.selectToken(
          variant && token.stock
            ? {
                ...token,
                stock: {
                  ...token.stock,
                  stockId: token.stock.stockId ?? stockId,
                },
              }
            : token,
        );
      } else if (variant) {
        void selection?.selectVariant(variant);
      }
    },
    [positions?.positionTokenList, selection, stockId, tokenVariants],
  );
  const portfolioData = portfolio?.positionListData ?? [];
  return (
    // Include the table gutters inside the reveal's clipping boundary while
    // keeping the parent gap collapsed when there are no positions.
    <Stack mx="$-5" mt={-28}>
      <SwapSmoothReveal visible={portfolioData.length > 0} keepMounted>
        <YStack testID="swap-stock-my-position" gap="$3" px="$5" pt="$7">
          <SizableText size="$bodyLgMedium">
            {intl.formatMessage({
              id: ETranslations.dexmarket_details_myposition,
            })}
          </SizableText>
          {/* The table carries the Market page's 20px gutter in its header and
            rows; pulling it back by the card padding lines the Token column
            up with the title. */}
          <Stack mx="$-5">
            <Portfolio
              standalone
              hasAccount={portfolio?.hasAccount}
              portfolioData={portfolioData}
              isRefreshing={portfolio?.isRefreshing}
              onItemPress={selectPosition}
            />
          </Stack>
        </YStack>
      </SwapSmoothReveal>
    </Stack>
  );
}
