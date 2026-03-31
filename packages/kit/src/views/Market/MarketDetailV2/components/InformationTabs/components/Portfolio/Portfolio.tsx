import { memo, useCallback } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, Stack, Tabs, useMedia } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketAccountPortfolioItem } from '@onekeyhq/shared/types/marketV2';

import { PortfolioSkeleton } from './components/PortfolioSkeleton';
import { PortfolioItemNormal } from './layout/PortfolioItemNormal';
import { PortfolioItemSmall } from './layout/PortfolioItemSmall';

import type { FlatListProps } from 'react-native';

const CONTENT_CONTAINER_STYLE = {
  flexGrow: 1,
  paddingBottom: platformEnv.isNativeAndroid ? 84 : 32,
};

interface IPortfolioProps {
  accountAddress?: string;
  portfolioData: IMarketAccountPortfolioItem[];
  isRefreshing?: boolean;
  tokenLogoUrl?: string;
}

function PortfolioBase({
  accountAddress,
  portfolioData,
  isRefreshing,
  tokenLogoUrl,
}: IPortfolioProps) {
  const intl = useIntl();
  const { gtLg, gtXl } = useMedia();
  const columnWidth = gtXl ? 240 : 130;

  const renderItem: FlatListProps<IMarketAccountPortfolioItem>['renderItem'] =
    useCallback(
      ({ item }: { item: IMarketAccountPortfolioItem }) => {
        return gtLg ? (
          <PortfolioItemNormal
            item={item}
            tokenLogoUrl={tokenLogoUrl}
            columnWidth={columnWidth}
          />
        ) : (
          <PortfolioItemSmall item={item} />
        );
      },
      [gtLg, tokenLogoUrl, columnWidth],
    );

  return (
    <Tabs.FlatList<IMarketAccountPortfolioItem>
      showsVerticalScrollIndicator={false}
      data={accountAddress ? portfolioData : []}
      windowSize={platformEnv.isNativeAndroid ? 3 : undefined}
      contentContainerStyle={CONTENT_CONTAINER_STYLE}
      renderItem={renderItem}
      keyExtractor={(item: IMarketAccountPortfolioItem) =>
        `${item.accountAddress}-${item.tokenAddress}`
      }
      ListEmptyComponent={
        accountAddress && isRefreshing ? (
          <PortfolioSkeleton />
        ) : (
          <Stack flex={1} alignItems="center" justifyContent="center" p="$8">
            <SizableText size="$bodyLg" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.dexmarket_details_nodata,
              })}
            </SizableText>
          </Stack>
        )
      }
    />
  );
}

const Portfolio = memo(PortfolioBase);

export { Portfolio };
