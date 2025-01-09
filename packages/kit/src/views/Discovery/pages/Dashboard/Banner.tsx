import { useMemo } from 'react';

import type { ISizableTextProps } from '@onekeyhq/components';
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
    () =>
      banners.map((i) => ({
        ...i,
        imgUrl: i.src,
        title: i.title || '',
        titleTextProps: {
          maxWidth: '$96',
          size: '$headingLg',
          $gtMd: {
            size: '$heading2xl',
          },
        } as ISizableTextProps,
      })),
    [banners],
  );

  const emptyComponent = useMemo(
    () =>
      isLoading ? (
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
      ) : undefined,
    [isLoading],
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
      itemTitleContainerStyle={{
        bottom: 0,
        right: 0,
        left: 0,
        px: '$10',
        py: '$8',
        $gtMd: {
          px: '$14',
          py: '$10',
        },
      }}
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
  );
}
