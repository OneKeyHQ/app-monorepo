import type { ReactElement } from 'react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';

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
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IMarketDetailPool,
  IMarketTokenDetail,
} from '@onekeyhq/shared/types/market';

import { MarketDetailLinks } from './MarketDetailLinks';
import { MarketDetailOverview } from './MarketDetailOverview';
import { MarketDetailPools } from './MarketDetailPools';

import type { IDeferredPromise } from '../../../hooks/useDeferredPromise';

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
  defer,
}: {
  token?: IMarketTokenDetail;
  listHeaderComponent?: ReactElement;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  defer: IDeferredPromise<unknown>;
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

  const init = useCallback(async () => {
    if (token?.detailPlatforms) {
      const response = await backgroundApiProxy.serviceMarket.fetchPools(
        token.detailPlatforms,
      );
      if (platformEnv.isNativeAndroid) {
        await defer.promise;
      } else {
        setTimeout(() => {
          defer.resolve(null);
        }, 100);
      }
      setPools(response);
    }
  }, [defer, token?.detailPlatforms]);
  useEffect(() => {
    void init();
  }, [init]);

  const renderPoolSkeleton = useMemo(
    () =>
      md ? (
        <YStack gap="$10" px="$5" pt="$11">
          <MdSkeletonRow />
          <MdSkeletonRow />
          <MdSkeletonRow />
          <MdSkeletonRow />
        </YStack>
      ) : (
        <YStack gap="$6" px="$5" pt="$11">
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
                  title: intl.formatMessage({ id: ETranslations.global_pools }),
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
                    <MarketDetailOverview {...props} token={token} />
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
      $gtMd={{ pr: '$5' }}
      $md={{ mt: '$5' }}
      data={tabConfig}
      disableRefresh
      ListHeaderComponent={
        <Stack mb="$5">
          {listHeaderComponent}
          {/* {pools ? null : (
            <YStack $gtMd={{ px: '$5' }}>{renderPoolSkeleton}</YStack>
          )} */}
        </Stack>
      }
      onSelectedPageIndex={(index: number) => {
        console.log('选中', index);
      }}
    />
  );
}

export const TokenDetailTabs = memo(BasicTokenDetailTabs);
