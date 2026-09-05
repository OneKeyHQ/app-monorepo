import { Fragment, memo, useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Empty, Tabs, YStack, useMedia } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketAccountPortfolioDisplayItem } from '@onekeyhq/shared/types/marketV2';

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
  tokenLogoUrl?: string;
  scrollEnabled?: boolean;
  standalone?: boolean;
}

function PortfolioBase({
  accountAddress,
  hasAccount,
  portfolioData,
  isRefreshing,
  tokenLogoUrl,
  scrollEnabled = true,
  standalone = false,
}: IPortfolioProps) {
  const intl = useIntl();
  const { gtLg } = useMedia();
  const canShowPortfolio = hasAccount ?? Boolean(accountAddress);

  const renderPortfolioItem = useCallback(
    (item: IMarketAccountPortfolioDisplayItem) => {
      return gtLg ? (
        <PortfolioItemNormal item={item} tokenLogoUrl={tokenLogoUrl} />
      ) : (
        <PortfolioItemSmall item={item} />
      );
    },
    [gtLg, tokenLogoUrl],
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
    canShowPortfolio && isRefreshing ? (
      <PortfolioSkeleton />
    ) : (
      <Empty
        description={intl.formatMessage({
          id: ETranslations.dexmarket_details_nodata,
        })}
        pt="$16"
      />
    );

  const data = canShowPortfolio ? portfolioData : [];

  if (standalone) {
    return (
      <YStack>
        {gtLg ? <PortfolioHeaderNormal /> : <PortfolioHeaderSmall />}
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
    <Tabs.FlatList<IMarketAccountPortfolioDisplayItem>
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
