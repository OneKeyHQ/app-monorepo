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
      if (media.gtXl) return 8;
      if (media.gtLg) return 6;
      if (media.gtSm) return 5;
      return 4;
    };
    setNumberOfItems(calculateNumberOfItems());
  }, [media.gtXl, media.gtLg, media.gtSm, media.gtMd]);

  return (
    <YStack flexDirection="row" flexWrap="wrap" {...restProps}>
      {dataSource.slice(0, numberOfItems).map(({ logo, title, url }, index) => (
        <YStack
          key={index}
          width="25%"
          $gtSm={{
            width: '20%',
          }}
          $gt2Md={{
            width: '16.6%',
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
