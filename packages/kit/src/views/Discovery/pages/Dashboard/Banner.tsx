import { useMemo } from 'react';

import { Banner } from '@onekeyhq/components';
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
      data={data}
      isLoading={isLoading}
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
