import { memo, useCallback } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, Stack, Tabs, useMedia } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketAccountPortfolioItem } from '@onekeyhq/shared/types/marketV2';

import { PortfolioSkeleton } from './components/PortfolioSkeleton';
import { usePortfolioData } from './hooks/usePortfolioData';
import { PortfolioItemNormal } from './layout/PortfolioItemNormal';
import { PortfolioItemSmall } from './layout/PortfolioItemSmall';

import type { FlatListProps } from 'react-native';

interface IPortfolioProps {
  tokenAddress: string;
  networkId: string;
}

function PortfolioBase({ tokenAddress, networkId }: IPortfolioProps) {
  const intl = useIntl();
  const { gtLg } = useMedia();
  const { activeAccount } = useActiveAccount({ num: 0 });

  // Get network-specific account
  const { result: networkAccount } = usePromiseResult(
    async () => {
      if (
        (!activeAccount?.indexedAccount?.id && !activeAccount?.account?.id) ||
        !networkId
      ) {
        return null;
      }

      return backgroundApiProxy.serviceAccount.getNetworkAccount({
        accountId: activeAccount?.indexedAccount?.id
          ? undefined
          : activeAccount?.account?.id,
        indexedAccountId: activeAccount?.indexedAccount?.id ?? '',
        networkId,
        deriveType: activeAccount.deriveType ?? 'default',
      });
    },
    [
      activeAccount?.indexedAccount?.id,
      activeAccount?.account?.id,
      activeAccount?.deriveType,
      networkId,
    ],
  );

  const accountAddress = networkAccount?.address;

  const { portfolioData, isRefreshing } = usePortfolioData({
    tokenAddress,
    networkId,
    accountAddress,
  });

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
