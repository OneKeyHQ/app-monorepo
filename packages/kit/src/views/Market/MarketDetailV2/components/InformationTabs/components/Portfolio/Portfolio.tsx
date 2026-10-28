import { Fragment, memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Empty, YStack, useMedia } from '@onekeyhq/components';
import { isTradePositionVisible } from '@onekeyhq/kit/src/views/Swap/utils/tradePositionUtils';
import { useCurrencyPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketAccountPortfolioDisplayItem } from '@onekeyhq/shared/types/marketV2';

import { MarketDetailList } from '../../layout/MarketDetailScroll';

import { PortfolioSkeleton } from './components/PortfolioSkeleton';
import { PortfolioHeaderNormal } from './layout/PortfolioHeaderNormal';
import { PortfolioHeaderSmall } from './layout/PortfolioHeaderSmall';
import { PortfolioItemNormal } from './layout/PortfolioItemNormal';
import { PortfolioItemSmall } from './layout/PortfolioItemSmall';

import type { FlatListProps } from 'react-native';

const CONTENT_CONTAINER_STYLE = {
  flexGrow: 1,
  paddingBottom: platformEnv.isNativeAndroid ? 84 : 32,
};

interface IPortfolioProps {
  accountAddress?: string;
  hasAccount?: boolean;
  portfolioData: IMarketAccountPortfolioDisplayItem[];
  isRefreshing?: boolean;
  // True until the page knows whether the asset has a position (account still
  // loading, or the first request for it not back yet).
  isPending?: boolean;
  tokenLogoUrl?: string;
  scrollEnabled?: boolean;
  standalone?: boolean;
  isStock?: boolean;
  onItemPress?: (item: IMarketAccountPortfolioDisplayItem) => void;
}

function PortfolioBase({
  accountAddress,
  hasAccount,
  portfolioData,
  isRefreshing,
  isPending = false,
  tokenLogoUrl,
  scrollEnabled = true,
  standalone = false,
  isStock = false,
  onItemPress,
}: IPortfolioProps) {
  const intl = useIntl();
  const { gtLg } = useMedia();
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const canShowPortfolio = hasAccount ?? Boolean(accountAddress);
  const isMobileStock = platformEnv.isNative && isStock;

  const renderPortfolioItem = useCallback(
    (item: IMarketAccountPortfolioDisplayItem) => {
      return gtLg && !isMobileStock ? (
        <PortfolioItemNormal
          item={item}
          tokenLogoUrl={tokenLogoUrl}
          onPress={onItemPress}
        />
      ) : (
        <PortfolioItemSmall
          item={item}
          onPress={onItemPress}
          isStock={isMobileStock}
        />
      );
    },
    [gtLg, isMobileStock, onItemPress, tokenLogoUrl],
  );

  const renderItem: FlatListProps<IMarketAccountPortfolioDisplayItem>['renderItem'] =
    useCallback(({ item }) => renderPortfolioItem(item), [renderPortfolioItem]);

  const keyExtractor = useCallback(
    (item: IMarketAccountPortfolioDisplayItem) =>
      [item.networkId, item.tokenId, item.accountAddress, item.tokenAddress]
        .filter(Boolean)
        .join('-'),
    [],
  );

  const emptyContent =
    isPending || (canShowPortfolio && isRefreshing) ? (
      <PortfolioSkeleton />
    ) : (
      <Empty
        description={intl.formatMessage({
          id: ETranslations.dexmarket_details_nodata,
        })}
        pt="$16"
      />
    );

  const data = useMemo(
    () =>
      canShowPortfolio
        ? portfolioData.filter((item) =>
            isTradePositionVisible({
              balance: item.amount,
              isStock,
              fiatValue: item.totalPrice,
              currency: item.currency ?? 'usd',
              currencyMap,
            }),
          )
        : [],
    [canShowPortfolio, currencyMap, isStock, portfolioData],
  );

  if (standalone) {
    return (
      <YStack>
        {gtLg && !isMobileStock ? (
          <PortfolioHeaderNormal />
        ) : (
          <PortfolioHeaderSmall isStock={isMobileStock} />
        )}
        {data.length > 0
          ? data.map((item) => (
              <Fragment key={keyExtractor(item)}>
                {renderPortfolioItem(item)}
              </Fragment>
            ))
          : emptyContent}
      </YStack>
    );
  }

  return (
    <MarketDetailList<IMarketAccountPortfolioDisplayItem>
      testID="market-detail-portfolio-list"
      showsVerticalScrollIndicator={false}
      scrollEnabled={scrollEnabled}
      data={data}
      windowSize={platformEnv.isNativeAndroid ? 3 : undefined}
      contentContainerStyle={CONTENT_CONTAINER_STYLE}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      ListEmptyComponent={emptyContent}
    />
  );
}

const Portfolio = memo(PortfolioBase);

export { Portfolio };
