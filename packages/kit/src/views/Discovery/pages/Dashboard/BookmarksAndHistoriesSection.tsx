import { useEffect, useMemo, useState } from 'react';

import type { IXStackProps } from '@onekeyhq/components';
import {
  Image,
  SizableText,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';

import { DashboardSectionHeader } from './DashboardSectionHeader';

import type {
  IBrowserBookmark,
  IBrowserHistory,
  IMatchDAppItemType,
} from '../../types';

function Items({
  dataSource,
  handleOpenWebSite,
  ...restProps
}: IXStackProps & {
  dataSource: IBrowserBookmark[] | IBrowserHistory[];
  handleOpenWebSite: ({ dApp, webSite }: IMatchDAppItemType) => void;
}) {
  const [numberOfItems, setNumberOfItems] = useState(0);
  const media = useMedia();

  useEffect(() => {
    if (media.gtXl) {
      setNumberOfItems(8);
    } else if (media.gtLg) {
      setNumberOfItems(6);
    } else if (media.gtSm) {
      setNumberOfItems(5);
    } else {
      setNumberOfItems(4);
    }
  }, [media.gtLg, media.gtMd, media.gtSm, media.gtXl]);

  return (
    <XStack
      flexWrap="wrap"
      mx="$-5"
      $gtLg={{
        mx: '$-3',
      }}
      {...restProps}
    >
      {dataSource.slice(0, numberOfItems).map(({ logo, title, url }, index) => (
        <Stack
          key={index}
          flexBasis="25%"
          alignItems="center"
          space="$2"
          py="$2"
          $gtSm={{
            flexBasis: '20%',
          }}
          $gtLg={{
            p: '$3',
            flexBasis: '33.3333%',
            flexDirection: 'row',
            space: '$5',
          }}
          $gtXl={{
            flexBasis: '25%',
          }}
          userSelect="none"
          onPress={() =>
            handleOpenWebSite({
              webSite: {
                url,
                title,
              },
            })
          }
        >
          <Image
            w="$14"
            h="$14"
            borderRadius="$3"
            $gtLg={{
              w: '$12',
              h: '$12',
            }}
          >
            <Image.Source
              source={{
                uri: logo,
              }}
            />
          </Image>
          <SizableText
            size="$bodyLgMedium"
            $gtMd={{
              size: '$bodyMdMedium',
            }}
            textAlign="center"
            numberOfLines={1}
          >
            {title}
          </SizableText>
        </Stack>
      ))}
    </XStack>
  );
}

export function BookmarksAndHistoriesSection({
  bookmarksData,
  historiesData,
  onPressMore,
  handleOpenWebSite,
}: {
  bookmarksData: IBrowserBookmark[] | undefined;
  historiesData: IBrowserHistory[] | undefined;
  onPressMore: (isHistoriesView: boolean) => void;
  handleOpenWebSite: ({ dApp, webSite }: IMatchDAppItemType) => void;
}) {
  const [isHistoriesView, setIsHistoriesView] = useState(false);

  const dataSource = useMemo<IBrowserBookmark[] | IBrowserHistory[]>(
    () => (isHistoriesView ? historiesData ?? [] : bookmarksData ?? []),
    [historiesData, bookmarksData, isHistoriesView],
  );

  return (
    <Stack px="$5">
      <DashboardSectionHeader>
        <DashboardSectionHeader.Heading
          selected={!isHistoriesView}
          onPress={() => setIsHistoriesView(false)}
        >
          Bookmarks
        </DashboardSectionHeader.Heading>
        <DashboardSectionHeader.Heading
          selected={isHistoriesView}
          onPress={() => setIsHistoriesView(true)}
        >
          Histories
        </DashboardSectionHeader.Heading>
        {dataSource.length > 0 && (
          <DashboardSectionHeader.Button
            onPress={() => {
              onPressMore(isHistoriesView);
            }}
          >
            See All
          </DashboardSectionHeader.Button>
        )}
      </DashboardSectionHeader>
      {dataSource.length > 0 ? (
        <Items dataSource={dataSource} handleOpenWebSite={handleOpenWebSite} />
      ) : (
        <Stack
          bg="$bgSubdued"
          py="$6"
          borderRadius="$3"
          style={{
            borderCurve: 'continuous',
          }}
        >
          <SizableText size="$bodyLg" color="$textDisabled" textAlign="center">
            {isHistoriesView ? 'No History Yet' : 'No Bookmarks Yet'}
          </SizableText>
        </Stack>
      )}
    </Stack>
  );
}
