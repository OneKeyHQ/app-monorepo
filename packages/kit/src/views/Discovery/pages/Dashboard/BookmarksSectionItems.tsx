import { useEffect, useState } from 'react';

import type { IXStackProps } from '@onekeyhq/components';
import { XStack, useMedia } from '@onekeyhq/components';

import { BookmarksSectionItem } from './BookmarksSectionItem';

import type { IBrowserBookmark, IMatchDAppItemType } from '../../types';

export function BookmarksSectionItems({
  dataSource,
  handleOpenWebSite,
  ...restProps
}: IXStackProps & {
  dataSource: IBrowserBookmark[];
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
        <BookmarksSectionItem
          key={index}
          logo={logo}
          title={title}
          url={url}
          handleOpenWebSite={handleOpenWebSite}
        />
      ))}
    </XStack>
  );
}
