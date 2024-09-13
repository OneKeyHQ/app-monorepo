import type { ReactElement } from 'react';
import { useCallback } from 'react';

import { isNil } from 'lodash';
import { useMedia, useThemeName } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { IconButton } from '../../actions';
import { type IRenderPaginationParams, Swiper } from '../../layouts';
import { Image, SizableText, Stack, XStack } from '../../primitives';

import type { IImageSourceProps, IStackStyle } from '../../primitives';

export function Banner<
  T extends {
    title: string;
    titleColor?: string;
    imgUrl?: string;
    theme?: 'dark' | 'light' | string;
    bannerId: string;
    imgSource?: IImageSourceProps['source'];
    gtLgImgSource?: IImageSourceProps['source'];
    gtLgResizeMode?: IImageSourceProps['resizeMode'];
  },
>({
  data,
  onItemPress,
  isLoading,
  emptyComponent,
  itemContainerStyle,
  ...props
}: {
  data: T[];
  itemContainerStyle?: IStackStyle;
  size?: 'small' | 'large';
  onItemPress: (item: T) => void;
  isLoading?: boolean;
  emptyComponent?: ReactElement;
} & IStackStyle) {
  const media = useMedia();
  const theme = useThemeName();

  const renderItem = useCallback(
    ({ item }: { item: T }) => (
      <Stack
        tag="section"
        flex={1}
        position="relative"
        userSelect="none"
        onPress={() => onItemPress(item)}
        {...itemContainerStyle}
      >
        {item.imgUrl ? (
          <Image flex={1} borderRadius="$3" bg="$bgStrong" src={item.imgUrl} />
        ) : null}

        {item.imgSource || item.gtLgImgSource ? (
          <Image
            flex={1}
            borderRadius="$3"
            bg="$bgStrong"
            source={media.gtLg ? item.gtLgImgSource : item.imgSource}
            resizeMode={item.gtLgResizeMode}
          />
        ) : null}
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
            color={
              item.titleColor || (item.theme || theme) === 'dark'
                ? '$textDark'
                : '$textLight'
            }
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
    [itemContainerStyle, media.gtLg, onItemPress, theme],
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
    return emptyComponent;
  }

  return (
    <Swiper
      autoplay
      autoplayLoop
      autoplayLoopKeepAnimation
      autoplayDelayMs={3000}
      keyExtractor={keyExtractor}
      data={data}
      renderItem={renderItem}
      renderPagination={renderPagination}
      {...(props as any)}
    />
  );
}
