import { useEffect, useMemo, useState } from 'react';

import { isNil } from 'lodash';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IXStackProps } from '@onekeyhq/components';
import {
  Icon,
  Image,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

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
    const calculateNumberOfItems = () => {
      if (media.gtXl) return 8;
      if (media.gtLg) return 6;
      if (media.gtSm) return 5;
      return 4;
    };
    setNumberOfItems(calculateNumberOfItems());
  }, [media.gtXl, media.gtLg, media.gtSm, media.gtMd]);

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
          gap="$2"
          py="$2"
          $gtSm={{
            flexBasis: '20%',
          }}
          $gtLg={{
            p: '$3',
            flexBasis: '33.3333%',
            flexDirection: 'row',
            gap: '$5',
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
            size="$14"
            borderRadius="$3"
            $gtLg={{
              w: '$12',
              h: '$12',
            }}
            borderCurve="continuous"
            borderWidth={StyleSheet.hairlineWidth}
            borderColor="$borderSubdued"
          >
            <Image.Source
              source={{
                uri: logo,
              }}
            />
            <Image.Fallback>
              <Icon
                size="$14"
                $gtLg={{
                  size: '$12',
                }}
                name="GlobusOutline"
              />
            </Image.Fallback>
            <Image.Loading>
              <Skeleton width="100%" height="100%" />
            </Image.Loading>
          </Image>
          <SizableText
            size="$bodyLgMedium"
            px="$2"
            $gtMd={{
              size: '$bodyMdMedium',
              px: '$0',
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
  const intl = useIntl();
  const [isHistoriesView, setIsHistoriesView] = useState(false);

  const dataSource = useMemo<IBrowserBookmark[] | IBrowserHistory[]>(
    () => (isHistoriesView ? historiesData ?? [] : bookmarksData ?? []),
    [historiesData, bookmarksData, isHistoriesView],
  );

  const isNilDataSource = isHistoriesView
    ? isNil(historiesData)
    : isNil(bookmarksData);

  return (
    <Stack px="$5" minHeight="$40">
      <DashboardSectionHeader>
        <DashboardSectionHeader.Heading
          selected={!isHistoriesView}
          onPress={() => setIsHistoriesView(false)}
        >
          {intl.formatMessage({ id: ETranslations.explore_bookmarks })}
        </DashboardSectionHeader.Heading>
        <DashboardSectionHeader.Heading
          selected={isHistoriesView}
          onPress={() => setIsHistoriesView(true)}
        >
          {intl.formatMessage({ id: ETranslations.explore_history })}
        </DashboardSectionHeader.Heading>
        {dataSource.length > 0 ? (
          <DashboardSectionHeader.Button
            onPress={() => {
              onPressMore(isHistoriesView);
            }}
          >
            {intl.formatMessage({ id: ETranslations.explore_see_all })}
          </DashboardSectionHeader.Button>
        ) : null}
      </DashboardSectionHeader>
      {dataSource.length > 0 ? (
        <Items dataSource={dataSource} handleOpenWebSite={handleOpenWebSite} />
      ) : (
        <Stack
          bg="$bgSubdued"
          py="$6"
          flex={1}
          borderRadius="$3"
          borderCurve="continuous"
          justifyContent="center"
        >
          {isNilDataSource ? (
            <Skeleton w="100%" />
          ) : (
            <SizableText
              size="$bodyLg"
              color="$textDisabled"
              textAlign="center"
            >
              {intl.formatMessage({
                id: isHistoriesView
                  ? ETranslations.explore_no_history
                  : ETranslations.explore_no_boomark,
              })}
            </SizableText>
          )}
        </Stack>
      )}
    </Stack>
  );
}
