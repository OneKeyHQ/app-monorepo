import type { ReactElement } from 'react';
import { memo, useMemo } from 'react';

import type { ITabPageProps } from '@onekeyhq/components';
import {
  Skeleton,
  Stack,
  Tab,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/market';

import { usePromiseResult } from '../../../hooks/usePromiseResult';

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
}: {
  token?: IMarketTokenDetail;
  listHeaderComponent?: ReactElement;
}) {
  const { md } = useMedia();

  const { result: pools } = usePromiseResult(
    () =>
      token?.symbol
        ? backgroundApiProxy.serviceMarket.fetchPools(token?.symbol)
        : Promise.resolve(undefined),
    [token?.symbol],
  );

  const renderPoolSkeleton = useMemo(
    () =>
      md ? (
        <YStack>
          {listHeaderComponent}
          <YStack space="$10" px="$5" pt="$11">
            <MdSkeletonRow />
            <MdSkeletonRow />
            <MdSkeletonRow />
            <MdSkeletonRow />
          </YStack>
        </YStack>
      ) : (
        <YStack space="$6" px="$5" pt="$11">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </YStack>
      ),
    [listHeaderComponent, md],
  );

  const tabConfig = useMemo(
    () =>
      [
        pools?.length && token
          ? {
              title: 'Pools',
              // eslint-disable-next-line react/no-unstable-nested-components
              page: (props: ITabPageProps) => (
                <MarketDetailPools {...props} pools={pools} />
              ),
            }
          : undefined,
        md && token
          ? {
              title: 'Overview',
              // eslint-disable-next-line react/no-unstable-nested-components
              page: (props: ITabPageProps) => (
                <Stack px="$5">
                  <MarketDetailOverview {...props} token={token} />
                </Stack>
              ),
            }
          : undefined,
        token && {
          title: 'Links',
          // eslint-disable-next-line react/no-unstable-nested-components
          page: (props: ITabPageProps) => (
            <MarketDetailLinks {...props} token={token} />
          ),
        },
      ].filter(Boolean),
    [md, pools, token],
  );
  return pools ? (
    <Tab
      $gtMd={{ mt: '$8', mx: '$5' }}
      mt="$5"
      data={tabConfig}
      ListHeaderComponent={<Stack mb="$5">{listHeaderComponent}</Stack>}
      onSelectedPageIndex={(index: number) => {
        console.log('选中', index);
      }}
    />
  ) : (
    <>
      {md ? null : listHeaderComponent}
      {renderPoolSkeleton}
    </>
  );
}

export const TokenDetailTabs = memo(BasicTokenDetailTabs);
