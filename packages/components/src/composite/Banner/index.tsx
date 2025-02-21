import type { ReactElement } from 'react';
import { useCallback } from 'react';

import { isNil } from 'lodash';
import { useMedia, useProps } from 'tamagui';

import { type IRenderPaginationParams, Swiper } from '../../layouts';
import { Image, Stack, XStack } from '../../primitives';

import { PaginationButton } from './PaginationButton';

import type { IIconButtonProps } from '../../actions';
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
      {item.imgUrl ? <Image flex={1} bg="$bgStrong" src={item.imgUrl} /> : null}

      {item.imgSource ? (
        <Image
          flex={1}
          bg="$bgStrong"
          source={item.imgSource}
          resizeMode={item.imgResizeMode}
        />
      ) : null}
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
  indicatorContainerStyle,
  leftIconButtonStyle,
  rightIconButtonStyle,
  showPaginationButton = false,
  ...props
}: {
  data: T[];
  itemContainerStyle?: IStackStyle;
  leftIconButtonStyle?: Omit<IIconButtonProps, 'icon'>;
  rightIconButtonStyle?: Omit<IIconButtonProps, 'icon'>;
  indicatorContainerStyle?: IStackStyle;
  itemTitleContainerStyle?: IStackStyle;
  showPaginationButton?: boolean;
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
        {data.length > 1 ? (
          <XStack
            gap="$1"
            position="absolute"
            right={0}
            width="100%"
            jc="center"
            bottom="$2"
            {...indicatorContainerStyle}
          >
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

        {showPaginationButton || media.gtMd ? (
          <>
            <PaginationButton
              isVisible={currentIndex !== 0}
              direction="previous"
              onPress={gotToPrevIndex}
            />

            <PaginationButton
              isVisible={currentIndex !== data.length - 1}
              direction="next"
              onPress={goToNextIndex}
            />
          </>
        ) : null}
      </>
    ),
    [data, indicatorContainerStyle, showPaginationButton, media.gtMd],
  );

  const keyExtractor = useCallback((item: T) => item.bannerId, []);

  if (isNil(isLoading) || isLoading || data.length === 0) {
    return emptyComponent;
  }

  return (
    <Swiper
      autoplay
      autoplayLoop
      autoplayLoopKeepAnimation
      autoplayDelayMs={30_000}
      keyExtractor={keyExtractor}
      data={data}
      renderItem={renderItem}
      renderPagination={renderPagination}
      overflow="hidden"
      borderRadius="$3"
      {...(props as any)}
    />
  );
}
