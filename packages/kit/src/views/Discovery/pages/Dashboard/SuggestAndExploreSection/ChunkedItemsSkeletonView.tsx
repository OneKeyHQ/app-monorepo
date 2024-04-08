import { Skeleton, Stack, XStack } from '@onekeyhq/components';

import {
  CARD_WIDTH_IN_MD,
  type IChunkedItemsViewProps,
  ItemsContainer,
} from './ChunkedItemsView';

export function ChunkedItemsSkeletonView({
  isExploreView,
  dataChunks,
}: Partial<IChunkedItemsViewProps>) {
  return (
    <ItemsContainer
      mx="$-5"
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
      {dataChunks?.map((chunk, chunkIndex) => (
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
              space="$3"
              alignItems="center"
              $md={
                isExploreView
                  ? {
                      flexBasis: '100%',
                    }
                  : undefined
              }
              $gtMd={{
                flexBasis: '50%',
              }}
              $gtLg={{
                flexBasis: '33.3333%',
              }}
            >
              <Skeleton w="$14" h="$14" borderRadius="$3" />
              <Stack flex={1} space="$1">
                <XStack alignItems="center">
                  <Skeleton w="$20" h="$4" />
                </XStack>
                <Skeleton
                  w={216}
                  h="$4"
                  $md={{
                    w: '100%',
                  }}
                />
              </Stack>
            </XStack>
          ))}
        </Stack>
      ))}
    </ItemsContainer>
  );
}
