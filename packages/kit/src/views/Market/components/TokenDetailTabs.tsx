import type { ReactElement } from 'react';
import { memo, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import type { ITabPageProps } from '@onekeyhq/components';
import {
  RefreshControl,
  Skeleton,
  Stack,
  Tab,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IMarketDetailPool,
  IMarketTokenDetail,
} from '@onekeyhq/shared/types/market';

import { MarketDetailLinks } from './MarketDetailLinks';
import { MarketDetailOverview } from './MarketDetailOverview';
import { MarketDetailPools } from './MarketDetailPools';

function SkeletonRow() {
  return (
    <XStack>
      <XStack flex={1}>
        <Skeleton w="$24" h="$3" />
      </XStack>
      <XStack flex={1} jc="flex-end">
        <Skeleton w="$16" h="$3" />
      </XStack>
      <XStack flex={1} jc="flex-end">
        <Skeleton w="$16" h="$3" />
      </XStack>
      <XStack flex={1} jc="flex-end">
        <Skeleton w="$16" h="$3" />
      </XStack>
      <XStack flex={1} jc="flex-end">
        <Skeleton w="$16" h="$3" />
      </XStack>
    </XStack>
  );
}

function MdSkeletonRow() {
  return (
    <XStack>
      <XStack flex={1}>
        <Skeleton w="$24" h="$3" />
      </XStack>
      <XStack flex={1} jc="flex-end">
        <Skeleton w="$16" h="$3" />
      </XStack>
      <XStack flex={1} jc="flex-end">
        <Skeleton w="$16" h="$3" />
      </XStack>
    </XStack>
  );
}

function BasicTokenDetailTabs({
  token,
  listHeaderComponent,
  isRefreshing,
  onRefresh,
  onDataLoaded,
}: {
  token?: IMarketTokenDetail;
  listHeaderComponent?: ReactElement;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onDataLoaded?: () => void;
}) {
  const intl = useIntl();
  const { md } = useMedia();

  const [pools, setPools] = useState<
    | {
        data: IMarketDetailPool[];
        contract_address: string;
        onekeyNetworkId?: string | undefined;
        coingeckoNetworkId?: string | undefined;
      }[]
    | undefined
  >(undefined);
  useEffect(() => {
    if (token?.detailPlatforms) {
      void backgroundApiProxy.serviceMarket
        .fetchPools(token.detailPlatforms)
        .then((response) => {
          setPools(response);
          setTimeout(() => {
            onDataLoaded?.();
          }, 100);
        });
    }
  }, [onDataLoaded, token?.detailPlatforms]);

  const renderPoolSkeleton = useMemo(
    () =>
      md ? (
        <YStack space="$10" px="$5" pt="$11">
          <MdSkeletonRow />
          <MdSkeletonRow />
          <MdSkeletonRow />
          <MdSkeletonRow />
        </YStack>
      ) : (
        <YStack space="$6" px="$5" pt="$11">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </YStack>
      ),
    [md],
  );

  const tabConfig = useMemo(
    () =>
      pools
        ? [
            pools.length && token
              ? {
                  title: intl.formatMessage({ id: ETranslations.global_all }),
                  // eslint-disable-next-line react/no-unstable-nested-components
                  page: (props: ITabPageProps) => (
                    <MarketDetailPools {...props} pools={pools} />
                  ),
                }
              : undefined,
            md && token
              ? {
                  title: intl.formatMessage({
                    id: ETranslations.global_overview,
                  }),
                  // eslint-disable-next-line react/no-unstable-nested-components
                  page: (props: ITabPageProps) => (
                    <Stack px="$5">
                      <MarketDetailOverview {...props} token={token} />
                    </Stack>
                  ),
                }
              : undefined,
            token && {
              title: intl.formatMessage({
                id: ETranslations.global_links,
              }),
              // eslint-disable-next-line react/no-unstable-nested-components
              page: (props: ITabPageProps) => (
                <MarketDetailLinks {...props} token={token} />
              ),
            },
          ].filter(Boolean)
        : [],
    [intl, md, pools, token],
  );
  return (
    <Tab
      refreshControl={
        <RefreshControl refreshing={!!isRefreshing} onRefresh={onRefresh} />
      }
      $gtMd={{ px: '$5' }}
      $md={{ mt: '$5' }}
      data={tabConfig}
      ListHeaderComponent={
        <Stack mb="$5">
          {listHeaderComponent}
          {pools ? null : (
            <YStack $gtMd={{ px: '$5' }}>{renderPoolSkeleton}</YStack>
          )}
        </Stack>
      }
      onSelectedPageIndex={(index: number) => {
        console.log('选中', index);
      }}
    />
  );
}

export const TokenDetailTabs = memo(BasicTokenDetailTabs);
