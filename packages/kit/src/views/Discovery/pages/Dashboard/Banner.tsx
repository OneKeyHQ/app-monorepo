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
    <Stack
      m="$5"
      h={120}
      w="100%"
      $gtSm={{
        w: 360,
      }}
      justifyContent="center"
      alignItems="center"
    >
      <Banner
        showCloseButton
        w={360}
        height={120}
        // height="$36"
        // $md={{
        //   height: '$28',
        // }}
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
