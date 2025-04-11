import { useMemo } from 'react';

import { Banner, Skeleton, Stack } from '@onekeyhq/components';
import { EEnterMethod } from '@onekeyhq/shared/src/logger/scopes/discovery/scenes/dapp';
import type { IDiscoveryBanner } from '@onekeyhq/shared/types/discovery';

import { useBannerData } from '../../hooks/useBannerData';
import { useWebSiteHandler } from '../../hooks/useWebSiteHandler';

export function DashboardBanner({
  banners,
  isLoading,
}: {
  banners: IDiscoveryBanner[];
  isLoading: boolean | undefined;
}) {
  const { data, closeAllBanners } = useBannerData(banners);
  const handleWebSite = useWebSiteHandler();

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
          handleWebSite({
            webSite: {
              url: item.href,
              title: item.href,
              logo: undefined,
              sortIndex: undefined,
            },
            useSystemBrowser: item.useSystemBrowser,
            shouldPopNavigation: false,
            enterMethod: EEnterMethod.banner,
          });
        }}
      />
    </Stack>
  );
}
