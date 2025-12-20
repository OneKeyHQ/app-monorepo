import { useEffect, useState } from 'react';

import type { IYStackProps } from '@onekeyhq/components';
import { YStack, useMedia } from '@onekeyhq/components';
import type { IDApp } from '@onekeyhq/shared/types/discovery';

import { TrendingSectionItem } from './TrendingSectionItem';

import type { IMatchDAppItemType } from '../../types';

export function TrendingSectionItems({
  dataSource,
  handleOpenWebSite,
  isLoading,
  ...restProps
}: IYStackProps & {
  dataSource: IDApp[];
  handleOpenWebSite: ({ dApp, webSite }: IMatchDAppItemType) => void;
  isLoading?: boolean;
}) {
  const [numberOfItems, setNumberOfItems] = useState(0);
  const media = useMedia();

  const innerDataSource =
    dataSource.length > 0
      ? dataSource
      : Array<IDApp>(14)
          .fill({
            dappId: '',
            logo: '',
            name: '',
            url: '',
            description: '',
            networkIds: [],
            tags: [],
          })
          .map((item, index) => {
            return {
              ...item,
              dappId: `dapp-${index}`,
            };
          });

  useEffect(() => {
    const calculateNumberOfItems = () => {
      if (media.sm) return 8;
      if (media['2md']) return 10;
      if (media.xl) return 12;
      return 14;
    };
    setNumberOfItems(calculateNumberOfItems());
  }, [media.gtXl, media.gt2Md, media.gtSm, media]);

  return (
    <YStack
      flexDirection="row"
      flexWrap="wrap"
      rowGap="$2"
      py="$2"
      {...restProps}
    >
      {innerDataSource.slice(0, numberOfItems).map((dApp, index) => (
        <YStack
          key={dApp.dappId || index}
          width="25%"
          $gtSm={{ width: '20%' }}
          $gt2Md={{ width: '16.6%' }}
          $gtXl={{ width: '14.2%' }}
        >
          <TrendingSectionItem
            logo={dApp.logo}
            title={dApp.name}
            url={dApp.url}
            dApp={dApp}
            isLoading={isLoading}
            handleOpenWebSite={handleOpenWebSite}
          />
        </YStack>
      ))}
    </YStack>
  );
}
