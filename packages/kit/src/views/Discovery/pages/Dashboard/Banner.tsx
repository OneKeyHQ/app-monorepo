import { useState } from 'react';

import { useWindowDimensions } from 'react-native';

import {
  IconButton,
  Image,
  SizableText,
  Stack,
  Swiper,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';

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
  const { width } = useWindowDimensions();
  const containerWidth = width;
  return (
    <Swiper
      autoplay
      autoplayLoopKeepAnimation
      style={{ width: containerWidth }}
      autoplayDelay={4}
      autoplayLoop
      index={1}
      data={bannerData}
      renderItem={({ item }: any) => {
        const { imgUrl, title, theme, onPress } = item;
        return (
          <Stack p="$5" tag="section" width={width}>
            <XStack
              height="$52"
              $gtMd={{
                height: '$72',
              }}
              $gtLg={{
                height: '$96',
              }}
              p="$5"
              alignItems="center"
            >
              <Stack
                position="absolute"
                left={0}
                right={0}
                bottom={0}
                top={0}
                onPress={onPress}
                userSelect="none"
              >
                <Image
                  width="100%"
                  height="100%"
                  borderRadius="$3"
                  bg="$bgStrong"
                >
                  <Image.Source
                    source={{
                      uri: imgUrl,
                    }}
                  />
                </Image>
                <Stack
                  position="absolute"
                  bottom={0}
                  right={0}
                  left={0}
                  px="$5"
                  py="$4"
                  $gtMd={{
                    px: '$8',
                    py: '$6',
                  }}
                >
                  <SizableText
                    color={
                      theme === 'light' ? '$neutral12Light' : '$neutral12Dark'
                    }
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
            </XStack>
          </Stack>
        );
      }}
      renderPagination={({ currentIndex, goToNextIndex, gotToPrevIndex }) => (
        <>
          {media.gtMd && (
            <>
              {currentIndex !== 0 && (
                <IconButton
                  position="absolute"
                  left="$5"
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
                  right="$5"
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
      )}
    />
  );
}
