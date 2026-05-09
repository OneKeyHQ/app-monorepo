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
  const [numberOfItems, setNumberOfItems] = useState(0);
  const media = useMedia();

  useEffect(() => {
    const calculateNumberOfItems = () => {
      if (media.gtXl) return 7;
      if (media.gt2Md) return 6;
      if (media.gtSm) return 10;
      return 8;
    };
    setNumberOfItems(calculateNumberOfItems());
  }, [media.gtXl, media.gt2Md, media.gtSm]);

  return (
    <YStack
      px="$pagePadding"
      mx="$-3"
      py="$2"
      flexDirection="row"
      flexWrap="wrap"
      rowGap="$4"
      {...restProps}
    >
      {dataSource.slice(0, numberOfItems).map(({ logo, title, url }) => (
        <YStack
          key={title + url}
          width="25%"
          $gtSm={{ width: '20%' }}
          $gt2Md={{ width: '16.6%' }}
          $gtXl={{ width: '14.2%' }}
          px="$3"
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
