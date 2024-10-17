import type { ReactNode } from 'react';

import memoizee from 'memoizee';
import { useWindowDimensions } from 'react-native';

import {
  ScrollView,
  Stack,
  getTokenValue,
  useMedia,
} from '@onekeyhq/components';
import type { IScrollViewProps, IStackProps } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { ICategory, IDApp } from '@onekeyhq/shared/types/discovery';

import { ChunkedItem } from '../../../components/ChunkedItem';

import type { IMatchDAppItemType } from '../../../types';

export const chunkArray = (array: ICategory['dapps'], chunkSize: number) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
};

export type IChunkedItemsViewProps = {
  dataChunks: IDApp[][];
  handleOpenWebSite: ({ dApp, webSite }: IMatchDAppItemType) => void;
  isExploreView: boolean;
};

const getIconSize = memoizee(() => getTokenValue('$12', 'size') as number, {
  maxAge: timerUtils.getTimeDurationMs({ minute: 10 }),
});

export function useCardWidth() {
  const { width } = useWindowDimensions();
  const iconSize = getIconSize();
  return width - iconSize;
}

export function usePaginationStyle(isHorizontal: boolean) {
  const cardWidth = useCardWidth();
  const iconSize = getIconSize();
  return isHorizontal
    ? ({
        horizontal: true,
        showsHorizontalScrollIndicator: false,
        decelerationRate: 0,
        snapToInterval: cardWidth,
        snapToAlignment: 'start',
        contentContainerStyle: {
          paddingRight: iconSize,
        },
      } as IScrollViewProps)
    : undefined;
}

export function ItemsContainer({
  children,
  horizontal,
  ...rest
}: {
  children: ReactNode;
} & IStackProps &
  IScrollViewProps) {
  const media = useMedia();
  const paginationStyle = usePaginationStyle(!!horizontal);
  if (media.gtMd) {
    return <Stack {...rest}>{children}</Stack>;
  }
  return (
    <ScrollView
      pagingEnabled
      {...paginationStyle}
      {...rest}
      contentContainerStyle={{
        ...rest.contentContainerStyle,
        ...paginationStyle?.contentContainerStyle,
      }}
    >
      {children}
    </ScrollView>
  );
}

export function ChunkedItemsView({
  isExploreView,
  dataChunks,
  handleOpenWebSite,
}: IChunkedItemsViewProps) {
  const cardWidth = useCardWidth();
  return (
    <ItemsContainer
      mx="$-5"
      // There is a slight issue with the space calculation in tamagui, it needs to be resolved by upgrading the version.
      $md={
        platformEnv.isRuntimeBrowser
          ? {
              ml: '$-3',
            }
          : undefined
      }
      horizontal={!isExploreView}
      contentContainerStyle={{
        px: '$2',
        $md: {
          flexDirection: isExploreView ? 'column' : 'row',
        },
        $gtMd: {
          flexDirection: 'column',
        },
      }}
    >
      {dataChunks.map((chunk, chunkIndex) => (
        <Stack
          key={chunkIndex}
          $md={
            isExploreView
              ? {
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                }
              : {
                  w: cardWidth,
                }
          }
          $gtMd={{
            flexDirection: 'row',
            flexWrap: 'wrap',
          }}
        >
          {chunk.map((item, index) => (
            <ChunkedItem
              key={index}
              item={item}
              isExploreView={isExploreView}
              onPress={() =>
                handleOpenWebSite({
                  webSite: {
                    url: item.url,
                    title: item.name,
                  },
                })
              }
            />
          ))}
        </Stack>
      ))}
    </ItemsContainer>
  );
}
