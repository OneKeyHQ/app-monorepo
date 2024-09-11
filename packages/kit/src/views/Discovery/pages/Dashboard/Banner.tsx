import { useMemo } from 'react';

import { Banner, Skeleton, Stack } from '@onekeyhq/components';
import type { IDiscoveryBanner } from '@onekeyhq/shared/types/discovery';

import type { IMatchDAppItemType } from '../../types';

export function DashboardBanner({
  banners,
  handleOpenWebSite,
  isLoading,
}: {
  banners: IDiscoveryBanner[];
  handleOpenWebSite: ({
    dApp,
    webSite,
    useSystemBrowser,
  }: IMatchDAppItemType & { useSystemBrowser: boolean }) => void;
  isLoading: boolean | undefined;
}) {
  const data = useMemo(
    () => banners.map((i) => ({ ...i, imgUrl: i.src, title: i.title || '' })),
    [banners],
  );
  return (
    <Banner
      itemContainerStyle={{ p: '$5' }}
      data={data}
      isLoading={isLoading}
      height={228}
      $gtMd={{
        height: 308,
      }}
      $gtLg={{
        height: 404,
      }}
      emptyComponent={
        <Stack p="$5">
          <Skeleton
            h={188}
            w="100%"
            $gtMd={{
              height: 268,
            }}
            $gtLg={{
              height: 364,
            }}
          />
        </Stack>
      }
      onItemPress={(item) => {
        handleOpenWebSite({
          webSite: {
            url: item.href,
            title: item.href,
          },
          useSystemBrowser: item.useSystemBrowser,
        });
      }}
    />
  );
}
