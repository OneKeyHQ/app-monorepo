import { useCallback } from 'react';

import type { IRenderPaginationParams } from '@onekeyhq/components';
import {
  IconButton,
  Image,
  SizableText,
  Stack,
  Swiper,
  XStack,
  useMedia,
} from '@onekeyhq/components';

import type { ListRenderItemInfo } from 'react-native';

const bannerData = [
  {
    imgUrl:
      'https://asset.onekey-asset.com/portal/803ff853ecdd7808b35fdf6f837ae1af514aad56/static/shop-hero-animation-poster-8e1206b59d2201dfaa8cd72a8134179f.jpg',
    title: 'Lorem do minim dolore excepteur veniam Lorem id dolor.',
    theme: 'light',
    onPress: () => console.log('clicked'),
  },
  {
    imgUrl:
      'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?q=80&w=2148&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    title: 'Lorem do minim dolore excepteur veniam Lorem id dolor.',
    theme: 'dark',
    onPress: () => console.log('clicked'),
  },
  {
    imgUrl:
      'https://images.unsplash.com/photo-1588345921523-c2dcdb7f1dcd?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    title: 'Lorem do minim dolore excepteur veniam Lorem id dolor.',
    theme: 'light',
    onPress: () => console.log('clicked'),
  },
];

export function Banner() {
  const media = useMedia();
  const renderItem = useCallback(
    ({
      item,
    }: ListRenderItemInfo<{
      imgUrl: string;
      title: string;
      theme: string;
      onPress: () => void;
    }>) => {
      const { imgUrl, title, theme, onPress } = item;
      return (
        <Stack
          p="$5"
          tag="section"
          flex={1}
          position="relative"
          onPress={onPress}
          userSelect="none"
        >
          <Image flex={1} borderRadius="$3" bg="$bgStrong" src={imgUrl} />
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
              color={theme === 'light' ? '$neutral12Light' : '$neutral12Dark'}
              size="$headingLg"
              $gtMd={{
                size: '$heading2xl',
              }}
              maxWidth="$96"
            >
              {title}
            </SizableText>
          </Stack>
        </Stack>
      );
    },
    [],
  );

  const renderPagination = useCallback(
    ({
      currentIndex,
      goToNextIndex,
      gotToPrevIndex,
    }: IRenderPaginationParams) => (
      <>
        {media.gtMd && (
          <>
            {currentIndex !== 0 && (
              <IconButton
                position="absolute"
                left="$10"
                top="50%"
                transform="translateY(-50%)"
                icon="ChevronLeftOutline"
                variant="tertiary"
                iconProps={{
                  color:
                    bannerData[currentIndex].theme === 'light'
                      ? '$iconSubduedLight'
                      : '$iconSubduedDark',
                }}
                onPress={gotToPrevIndex}
              />
            )}

            {currentIndex !== bannerData.length - 1 && (
              <IconButton
                icon="ChevronRightOutline"
                variant="tertiary"
                position="absolute"
                right="$10"
                top="50%"
                transform="translateY(-50%)"
                iconProps={{
                  color:
                    bannerData[currentIndex].theme === 'light'
                      ? '$iconSubduedLight'
                      : '$iconSubduedDark',
                }}
                onPress={goToNextIndex}
                disabled={currentIndex === bannerData.length - 1}
              />
            )}
          </>
        )}
        {bannerData.length > 1 && (
          <XStack space="$1" position="absolute" right="$10" bottom="$10">
            {bannerData.map((_, index) => (
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
        )}
      </>
    ),
    [media.gtMd],
  );

  const keyExtractor = useCallback(
    ({ title }: { title: string }, index: number) => `${title}-${index}`,
    [],
  );

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
      data={bannerData}
      renderItem={renderItem}
      renderPagination={renderPagination}
    />
  );
}
