import type { ReactElement } from 'react';
import { useCallback } from 'react';

import { isNil } from 'lodash';
import { useMedia, useProps, useStyle } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { IconButton } from '../../actions';
import { type IRenderPaginationParams, Swiper } from '../../layouts';
import { Image, SizableText, Stack, XStack } from '../../primitives';

import type {
  IImageSourceProps,
  ISizableTextProps,
  IStackStyle,
} from '../../primitives';

export interface IBannerData {
  title?: string;
  titleTextProps?: ISizableTextProps;
  imgUrl?: string;
  theme?: 'dark' | 'light' | string;
  bannerId?: string;
  imgSource?: IImageSourceProps['source'];
  imgResizeMode?: IImageSourceProps['resizeMode'];
  $gtMd?: IBannerData;
  $gtLg?: IBannerData;
}

function BannerItem<T extends IBannerData>({
  itemContainerStyle,
  itemTitleContainerStyle,
  onPress,
  item: rawItem,
}: {
  onPress: (item: T) => void;
  item: T;
  itemContainerStyle?: IStackStyle;
  itemTitleContainerStyle?: IStackStyle;
}) {
  const item = useProps(rawItem, {
    resolveValues: 'value',
  }) as T;
  const textStyle = useStyle(item.titleTextProps || {}, {
    resolveValues: 'auto',
  });
  const onItemPress = useCallback(() => {
    onPress(item);
  }, [item, onPress]);
  return (
    <Stack
      tag="section"
      flex={1}
      position="relative"
      userSelect="none"
      onPress={onItemPress}
      {...itemContainerStyle}
    >
      {item.imgUrl ? (
        <Image flex={1} borderRadius="$3" bg="$bgStrong" src={item.imgUrl} />
      ) : null}

      {item.imgSource ? (
        <Image
          flex={1}
          borderRadius="$3"
          bg="$bgStrong"
          source={item.imgSource}
          resizeMode={item.imgResizeMode}
        />
      ) : null}
      <Stack position="absolute" {...itemTitleContainerStyle}>
        {
          // TODO：Lokalise processes \n as \\n when handling translations
          item.title?.split(/\n|\\n/).map((text, index) => (
            <SizableText
              key={index}
              color={item.theme === 'dark' ? '$textDark' : '$textLight'}
              size="$headingLg"
              {...textStyle}
            >
              {text}
            </SizableText>
          ))
        }
      </Stack>
    </Stack>
  );
}

export function Banner<T extends IBannerData>({
  data,
  onItemPress,
  isLoading,
  emptyComponent,
  itemContainerStyle,
  itemTitleContainerStyle,
  ...props
}: {
  data: T[];
  itemContainerStyle?: IStackStyle;
  itemTitleContainerStyle?: IStackStyle;
  size?: 'small' | 'large';
  onItemPress: (item: T) => void;
  isLoading?: boolean;
  emptyComponent?: ReactElement;
} & IStackStyle) {
  const media = useMedia();

  const renderItem = useCallback(
    ({ item }: { item: T }) => (
      <BannerItem
        onPress={onItemPress}
        item={item}
        itemContainerStyle={itemContainerStyle}
        itemTitleContainerStyle={itemTitleContainerStyle}
      />
    ),
    [itemContainerStyle, itemTitleContainerStyle, onItemPress],
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
