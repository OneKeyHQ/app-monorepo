import type { ReactNode } from 'react';

import { Dimensions } from 'react-native';

import {
  Badge,
  Image,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import type {
  IBadgeType,
  IScrollViewProps,
  IStackProps,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ICategory, IDApp } from '@onekeyhq/shared/types/discovery';

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

export const CARD_WIDTH_IN_MD = Dimensions.get('window').width - 48;
export const SPACING_FOR_CARD_INSET = 100;

const paginationStyle: IScrollViewProps = {
  horizontal: true,
  showsHorizontalScrollIndicator: false,
  decelerationRate: 0,
  snapToInterval: CARD_WIDTH_IN_MD,
  contentInset: platformEnv.isNativeIOS
    ? {
        top: 0,
        left: SPACING_FOR_CARD_INSET, // Left spacing for the very first card
        bottom: 0,
        right: SPACING_FOR_CARD_INSET, // Right spacing for the very last card
      }
    : undefined,
  contentContainerStyle: {
    // contentInset alternative for Android
    paddingHorizontal: platformEnv.isNativeAndroid ? SPACING_FOR_CARD_INSET : 0, // Horizontal spacing before and after the ScrollView
  },
};

export function ItemsContainer({
  children,
  horizontal,
  ...rest
}: {
  children: ReactNode;
} & IStackProps &
  IScrollViewProps) {
  const media = useMedia();

  if (media.gtMd) {
    return <Stack {...rest}>{children}</Stack>;
  }

  return (
    <ScrollView
      pagingEnabled
      {...(horizontal ? paginationStyle : undefined)}
      {...rest}
    >
      {children}
    </ScrollView>
  );
}

// There is a slight issue with the space calculation in tamagui, it needs to be resolved by upgrading the version.
const patchFixMdBrowserStyleMl = (itemLength: number) =>
  platformEnv.isRuntimeBrowser && itemLength > 1 ? '$-3' : undefined;

export function ChunkedItemsView({
  isExploreView,
  dataChunks,
  handleOpenWebSite,
}: IChunkedItemsViewProps) {
  return (
    <ItemsContainer
      mx="$-5"
      $md={{
        ml: patchFixMdBrowserStyleMl(dataChunks.length),
      }}
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
                  w: CARD_WIDTH_IN_MD,
                }
          }
          $gtMd={{
            flexDirection: 'row',
            flexWrap: 'wrap',
          }}
        >
          {chunk.map((item) => (
            <XStack
              key={item.dappId}
              p="$3"
              alignItems="center"
              $md={
                isExploreView
                  ? {
                      flexBasis: '100%',
                    }
                  : undefined
              }
              $gtMd={{
                px: '$5',
                flexBasis: '50%',
              }}
              $gtLg={{
                px: '$5',
                flexBasis: '33.3333%',
              }}
              onPress={() =>
                handleOpenWebSite({
                  webSite: {
                    url: item.url,
                    title: item.name,
                  },
                })
              }
            >
              <Image w="$14" h="$14" borderRadius="$3">
                <Image.Source
                  source={{
                    uri: item.logo,
                  }}
                />
              </Image>
              <Stack flex={1} ml="$3">
                <XStack alignItems="center">
                  <SizableText
                    size="$bodyLgMedium"
                    $gtMd={{
                      size: '$bodyMdMedium',
                    }}
                    numberOfLines={1}
                  >
                    {item.name}
                  </SizableText>
                  {Array.isArray(item.tags) && item.tags.length ? (
                    <Badge
                      badgeSize="sm"
                      badgeType={item.tags[0].type as IBadgeType}
                      ml="$2"
                    >
                      {item.tags[0].name}
                    </Badge>
                  ) : null}
                </XStack>
                <SizableText
                  size="$bodyMd"
                  color="$textSubdued"
                  numberOfLines={1}
                  $gtMd={{
                    size: '$bodySm',
                    numberOfLines: 2,
                    whiteSpace: 'break-spaces',
                  }}
                >
                  {item.description}
                </SizableText>
              </Stack>
            </XStack>
          ))}
        </Stack>
      ))}
    </ItemsContainer>
  );
}
