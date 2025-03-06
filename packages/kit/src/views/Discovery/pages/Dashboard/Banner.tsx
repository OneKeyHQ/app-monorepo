import { useMemo } from 'react';

import { Banner, Skeleton, Stack } from '@onekeyhq/components';
import type { IDiscoveryBanner } from '@onekeyhq/shared/types/discovery';

import { useBannerData } from '../../hooks/useBannerData';

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
  const { data, closeAllBanners } = useBannerData(banners);

  const emptyComponent = useMemo(
    () =>
      isLoading ? (
        <Skeleton
          h={120}
          w="100%"
          $gtMd={{
            w: 360,
          }}
        />
      ) : undefined,
    [isLoading],
  );

  return (
    <Stack
      h={120}
      w="100%"
      $gtSm={{
        w: 360,
      }}
      justifyContent="center"
      alignItems="center"
    >
      <Banner
        onBannerClose={() => {
          closeAllBanners();
        }}
        showCloseButton
        showPaginationButton={false}
        height={120}
        w="100%"
        $gtSm={{
          w: 360,
        }}
        data={data}
        isLoading={isLoading}
        itemTitleContainerStyle={{ display: 'none' }}
        emptyComponent={emptyComponent}
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
    </Stack>
  );
}
