import type { ReactElement } from 'react';
import { useCallback, useState } from 'react';

import { isNil } from 'lodash';
import { useProps } from 'tamagui';
import { useDebouncedCallback } from 'use-debounce';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useHoverOpacity } from '../../hooks/useHoverOpacity';
import { type IRenderPaginationParams, Swiper } from '../../layouts';
import { Image, SizableText, Stack, XStack } from '../../primitives';

import CloseButton from './CloseButton';
import { PaginationButton } from './PaginationButton';

import type {
  IImageProps,
  ISizableTextProps,
  IStackStyle,
  IXStackProps,
} from '../../primitives';

export interface IBannerData {
  title?: string;
  titleTextProps?: ISizableTextProps;
  imgUrl?: string;
  theme?: 'dark' | 'light' | string;
  bannerId?: string;
  imgSource?: IImageProps['source'];
  imgResizeMode?: IImageProps['resizeMode'];
  $gtMd?: IBannerData;
  $gtLg?: IBannerData;
}

function BannerItem<T extends IBannerData>({
  itemContainerStyle,
  itemTitleContainerStyle,
  onPress,
  item: rawItem,
  isFirst,
  isLast,
}: {
  onPress: (item: T) => void;
  item: T;
  itemContainerStyle?: IStackStyle;
  itemTitleContainerStyle?: IStackStyle;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  const item = useProps(rawItem, {
    resolveValues: 'value',
  }) as T;
  const onItemPress = useCallback(() => {
    onPress(item);
  }, [item, onPress]);
  return (
    <Stack
      borderTopLeftRadius={isFirst ? '$3' : 0}
      borderBottomLeftRadius={isFirst ? '$3' : 0}
      borderTopRightRadius={isLast ? '$3' : 0}
      borderBottomRightRadius={isLast ? '$3' : 0}
      overflow="hidden"
      tag="section"
      flex={1}
      position="relative"
      userSelect="none"
      onPress={onItemPress}
      {...itemContainerStyle}
    >
      {item.imgUrl ? <Image flex={1} src={item.imgUrl} /> : null}

      {item.imgSource ? (
        <Image
          flex={1}
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
              {...item.titleTextProps}
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
  indicatorContainerStyle,
  showPaginationButton = !platformEnv.isNative,
  showCloseButton = false,
  onBannerClose,
  ...props
}: IStackStyle & {
  data: T[];
  itemContainerStyle?: IStackStyle;
  indicatorContainerStyle?: IXStackProps;
  itemTitleContainerStyle?: IStackStyle;
  size?: 'small' | 'large';
  onItemPress: (item: T) => void;
  isLoading?: boolean;
  emptyComponent?: ReactElement;
  showCloseButton?: boolean;
  showPaginationButton?: boolean;
  onBannerClose?: (bannerId: string) => void;
}) {
  const [isHovering, setIsHovering] = useState(false);
  const setIsHoveringThrottled = useDebouncedCallback((value: boolean) => {
    setIsHovering(value);
  }, 100);
  const hoverOpacity = useHoverOpacity(isHovering);

  const renderItem = useCallback(
    ({ item }: { item: T }) => (
      <BannerItem
        isFirst={item.bannerId === data[0].bannerId}
        isLast={item.bannerId === data[data.length - 1].bannerId}
        onPress={onItemPress}
        item={item}
        itemContainerStyle={itemContainerStyle}
        itemTitleContainerStyle={itemTitleContainerStyle}
      />
    ),
    [data, itemContainerStyle, itemTitleContainerStyle, onItemPress],
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
            {...hoverOpacity}
            {...indicatorContainerStyle}
          >
            {data.map((_, index) => (
              <Stack
                shadowColor="$blackA1"
                shadowOpacity={0.1}
                shadowRadius={3}
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

        {showPaginationButton ? (
          <>
            <PaginationButton
              isVisible={currentIndex !== 0 ? isHovering : false}
              direction="previous"
              onPress={gotToPrevIndex}
              theme="light"
              onMouseEnter={() => setIsHoveringThrottled(true)}
            />

            <PaginationButton
              isVisible={currentIndex !== data.length - 1 ? isHovering : false}
              direction="next"
              onPress={goToNextIndex}
              theme="light"
              onMouseEnter={() => setIsHoveringThrottled(true)}
            />
          </>
        ) : null}

        {showCloseButton ? (
          <CloseButton
            onPress={() => {
              onBannerClose?.(data[currentIndex]?.bannerId ?? '');
            }}
            isHovering={isHovering}
          />
        ) : null}
      </>
    ),
    [
      data,
      indicatorContainerStyle,
      isHovering,
      onBannerClose,
      showCloseButton,
      showPaginationButton,
      hoverOpacity,
      setIsHoveringThrottled,
    ],
  );

  const keyExtractor = useCallback((item: T) => item.bannerId, []);

  if (isNil(isLoading) || isLoading || data.length === 0) {
    return emptyComponent;
  }

  return (
    <Stack
      onPointerMove={() => setIsHoveringThrottled(true)}
      onMouseEnter={() => setIsHoveringThrottled(true)}
      onMouseLeave={() => setIsHoveringThrottled(false)}
      w="100%"
    >
      <Swiper
        position="relative"
        autoplay
        autoplayLoop
        autoplayLoopKeepAnimation
        autoplayDelayMs={3000}
        keyExtractor={keyExtractor}
        data={data}
        renderItem={renderItem}
        renderPagination={renderPagination}
        overflow="hidden"
        borderRadius="$3"
        onPointerEnter={() => {
          setIsHoveringThrottled(true);
        }}
        onPointerLeave={() => {
          setIsHoveringThrottled(false);
        }}
        {...(props as any)}
      />
    </Stack>
  );
}
