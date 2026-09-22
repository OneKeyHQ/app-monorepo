import type { PropsWithChildren } from 'react';
import { createContext, useContext } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, Stack, YStack } from '@onekeyhq/components';
import { Portfolio } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/InformationTabs/components/Portfolio';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useSwapStockPortfolioData } from '../../hooks/useSwapStockPortfolioData';

import { SwapSmoothReveal } from './SwapSmoothReveal';

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
  const portfolioData = portfolio?.positionListData ?? [];
  return (
    <SwapSmoothReveal
      visible={portfolioData.length > 0}
      parentGap={28}
      keepMounted
    >
      <YStack testID="swap-stock-my-position" gap="$3">
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
          />
        </Stack>
      </YStack>
    </SwapSmoothReveal>
  );
}
