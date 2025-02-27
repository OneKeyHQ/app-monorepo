import { useEffect, useState } from 'react';

import type { IYStackProps } from '@onekeyhq/components';
import { YStack, useMedia } from '@onekeyhq/components';

import { BookmarksSectionItem } from './BookmarksSectionItem';

import type { IBrowserBookmark, IMatchDAppItemType } from '../../types';

export function BookmarksSectionItems({
  dataSource,
  handleOpenWebSite,
  ...restProps
}: IYStackProps & {
  dataSource: IBrowserBookmark[];
  handleOpenWebSite: ({ dApp, webSite }: IMatchDAppItemType) => void;
}) {
  return (
    <YStack flexDirection="row" flexWrap="wrap" {...restProps}>
      {dataSource.slice(0, 8).map(({ logo, title, url }, index) => (
        <YStack
          key={index}
          width="25%"
          $gtSm={{
            width: '20%',
          }}
          $gt2Md={{
            width: '16.6%',
          }}
          $gtXl={{
            width: '14.2%',
          }}
        >
          <BookmarksSectionItem
            logo={logo}
            title={title}
            url={url}
            handleOpenWebSite={handleOpenWebSite}
          />
        </YStack>
      ))}
    </YStack>
  );
}
