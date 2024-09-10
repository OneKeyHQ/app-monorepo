import { useCallback } from 'react';

import { isNil } from 'lodash';
import { useMedia } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { IconButton } from '../../actions';
import { type IRenderPaginationParams, Swiper } from '../../layouts';
import { Image, SizableText, Skeleton, Stack, XStack } from '../../primitives';

export function Banner<
  T extends {
    title: string;
    imgUrl: string;
    theme?: 'dark' | 'light';
    bannerId: string;
  },
>({
  data,
  onItemPress,
  isLoading,
}: {
  data: T[];
  onItemPress: (item: T) => void;
  isLoading: boolean | undefined;
}) {
  const media = useMedia();
  const renderItem = useCallback(
    ({ item }: { item: T }) => (
      <Stack
        p="$5"
        tag="section"
        flex={1}
        position="relative"
        userSelect="none"
        cursor="pointer"
        onPress={() => onItemPress(item)}
      >
        <Image flex={1} borderRadius="$3" bg="$bgStrong" src={item.imgUrl} />
        <Stack
          position="absolute"
          bottom={0}
          right={0}
          left={0}
          px="$10"
          py="$8"
          $gtMd={{
            px: '$14',
            py: '$10',
          }}
        >
          <SizableText
            color={item.theme === 'dark' ? '$textDark' : '$textLight'}
            size="$headingLg"
            $gtMd={{
              size: '$heading2xl',
            }}
            maxWidth="$96"
          >
            {item.title ?? ''}
          </SizableText>
        </Stack>
      </Stack>
    ),
    [onPress],
  );

  const renderPagination = useCallback(
    ({
      currentIndex,
      goToNextIndex,
      gotToPrevIndex,
    }: IRenderPaginationParams) => (
      <>
        {media.gtMd ? (
          <>
            {currentIndex !== 0 ? (
              <IconButton
                position="absolute"
                left="$10"
                top="50%"
                transform={platformEnv.isNative ? '' : 'translateY(-50%)'}
                icon="ChevronLeftOutline"
                variant="tertiary"
                iconProps={{
                  color:
                    data[currentIndex]?.theme === 'light'
                      ? '$iconSubduedLight'
                      : '$iconSubduedDark',
                }}
                onPress={gotToPrevIndex}
              />
            ) : null}

            {currentIndex !== data.length - 1 ? (
              <IconButton
                icon="ChevronRightOutline"
                variant="tertiary"
                position="absolute"
                right="$10"
                top="50%"
                transform={platformEnv.isNative ? '' : 'translateY(-50%)'}
                iconProps={{
                  color:
                    data[currentIndex]?.theme === 'light'
                      ? '$iconSubduedLight'
                      : '$iconSubduedDark',
                }}
                onPress={goToNextIndex}
                disabled={currentIndex === data.length - 1}
              />
            ) : null}
          </>
        ) : null}
        {data.length > 1 ? (
          <XStack gap="$1" position="absolute" right="$10" bottom="$10">
            {data.map((_, index) => (
              <Stack
                key={index}
                w="$3"
                $gtMd={{
                  w: '$4',
                }}
                h="$1"
                borderRadius="$full"
                bg="$whiteA12"
                opacity={currentIndex === index ? 1 : 0.5}
              />
            ))}
          </XStack>
        ) : null}
      </>
    ),
    [media.gtMd, data],
  );

  const keyExtractor = useCallback((item: T) => item.bannerId, []);

  if (isNil(isLoading) || isLoading) {
    return (
      <Stack p="$5">
        <Skeleton
          h={188}
          w="100%"
          $gtMd={{
            height: 268,
          }}
          $gtLg={{
            height: 364,
          }}
        />
      </Stack>
    );
  }

  return (
    <Swiper
      autoplay
      autoplayLoop
      autoplayLoopKeepAnimation
      autoplayDelayMs={3000}
      height={228}
      $gtMd={{
        height: 308,
      }}
      $gtLg={{
        height: 404,
      }}
      keyExtractor={keyExtractor}
      data={data}
      renderItem={renderItem}
      renderPagination={renderPagination}
    />
  );
}
