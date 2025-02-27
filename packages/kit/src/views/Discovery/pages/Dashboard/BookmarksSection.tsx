import { useMemo } from 'react';

import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import { SizableText, Skeleton, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { BookmarksSectionItems } from './BookmarksSectionItems';
import { DashboardSectionHeader } from './DashboardSectionHeader';

import type { IBrowserBookmark, IMatchDAppItemType } from '../../types';

export function BookmarksSection({
  bookmarksData,
  onPressMore,
  handleOpenWebSite,
}: {
  bookmarksData: IBrowserBookmark[] | undefined;
  onPressMore: (isHistoriesView: boolean) => void;
  handleOpenWebSite: ({ dApp, webSite }: IMatchDAppItemType) => void;
}) {
  const intl = useIntl();

  const dataSource = useMemo<IBrowserBookmark[]>(
    () => bookmarksData ?? [],
    [bookmarksData],
  );

  const isNilDataSource = isNil(bookmarksData);

  return (
    <Stack px="$5" minHeight="$40">
      <DashboardSectionHeader>
        <DashboardSectionHeader.Heading selected>
          {intl.formatMessage({ id: ETranslations.explore_bookmarks })}
        </DashboardSectionHeader.Heading>

        {dataSource.length > 0 ? (
          <DashboardSectionHeader.Button
            onPress={() => {
              onPressMore(false);
            }}
          >
            {intl.formatMessage({ id: ETranslations.explore_see_all })}
          </DashboardSectionHeader.Button>
        ) : null}
      </DashboardSectionHeader>

      {dataSource.length > 0 ? (
        <BookmarksSectionItems
          dataSource={dataSource}
          handleOpenWebSite={handleOpenWebSite}
        />
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
                id: ETranslations.explore_no_boomark,
              })}
            </SizableText>
          )}
        </Stack>
      )}
    </Stack>
  );
}
