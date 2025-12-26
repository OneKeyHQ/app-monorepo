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

interface IPortfolioProps {
  accountAddress?: string;
  portfolioData: IMarketAccountPortfolioItem[];
  isRefreshing?: boolean;
}

function PortfolioBase({
  accountAddress,
  portfolioData,
  isRefreshing,
}: IPortfolioProps) {
  const intl = useIntl();
  const { gtLg } = useMedia();

  const renderItem: FlatListProps<IMarketAccountPortfolioItem>['renderItem'] =
    useCallback(
      ({
        item,
        index,
      }: {
        item: IMarketAccountPortfolioItem;
        index: number;
      }) => {
        return gtLg ? (
          <PortfolioItemNormal item={item} index={index} />
        ) : (
          <PortfolioItemSmall item={item} index={index} />
        );
      },
      [gtLg],
    );

  // If no account address, show a message
  if (!accountAddress) {
    return (
      <Stack flex={1} alignItems="center" justifyContent="center" p="$8">
        <SizableText size="$bodyLg" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.no_account,
          })}
        </SizableText>
      </Stack>
    );
  }

  return (
    <Tabs.FlatList<IMarketAccountPortfolioItem>
      data={portfolioData}
      contentContainerStyle={{
        paddingBottom: platformEnv.isNativeAndroid ? 84 : 16,
      }}
      renderItem={renderItem}
      keyExtractor={(item: IMarketAccountPortfolioItem) =>
        `${item.accountAddress}-${item.tokenAddress}`
      }
      showsVerticalScrollIndicator
      ListEmptyComponent={
        isRefreshing ? (
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
