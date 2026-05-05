import type { ReactElement } from 'react';
import { useCallback, useState } from 'react';

import { useIsFocused } from '@react-navigation/native';
import { isNil } from 'lodash';
import { useDebouncedCallback } from 'use-debounce';

import { useProps } from '@onekeyhq/components/src/shared/tamagui';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { AdCornerBadge } from '../../content/AdCornerBadge';
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

const paginationDotGtMdStyle = {
  w: '$4' as const,
};

export interface IBannerData {
  title?: string;
  titleTextProps?: ISizableTextProps;
  imgUrl?: string;
  theme?: 'dark' | 'light' | string;
  bannerId?: string;
  isAd?: boolean;
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

      {item.isAd ? <AdCornerBadge badgeSize="lg" placement="top-left" /> : null}

      <Stack position="absolute" {...itemTitleContainerStyle}>
        {// TODO：Lokalise processes \n as \\n when handling translations
        item.title?.split(/\n|\\n/).map((text, index) => (
          <SizableText
            key={index}
            color={item.theme === 'dark' ? '$textDark' : '$textLight'}
            size="$headingLg"
            {...item.titleTextProps}
          >
            {text}
          </SizableText>
        ))}
      </Stack>
    </Stack>
  );
}

function PaginationDot({
  index,
  currentIndex,
  goToIndex,
}: {
  index: number;
  currentIndex: number;
  goToIndex: (index: number) => void;
}) {
  const handlePress = useCallback(
    (event: { stopPropagation?: () => void }) => {
      event?.stopPropagation?.();
      goToIndex(index);
    },
    [goToIndex, index],
  );
  return (
    <Stack key={index} p="$1" borderRadius="$full" onPress={handlePress}>
      <Stack
        shadowColor="$blackA1"
        shadowOpacity={0.1}
        shadowRadius={3}
        w="$3"
        $gtMd={paginationDotGtMdStyle}
        h="$1"
        borderRadius="$full"
        bg="$whiteA12"
        opacity={currentIndex === index ? 1 : 0.5}
      />
    </Stack>
  );
}

function BannerCloseButtonWrapper({
  onBannerClose,
  bannerId,
  isHovering,
}: {
  onBannerClose?: (bannerId: string) => void;
  bannerId: string;
  isHovering: boolean;
}) {
  const handleClose = useCallback(() => {
    onBannerClose?.(bannerId);
  }, [onBannerClose, bannerId]);
  return <CloseButton onPress={handleClose} isHovering={isHovering} />;
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

  const handlePaginationMouseEnter = useCallback(
    () => setIsHoveringThrottled(true),
    [setIsHoveringThrottled],
  );

  const renderPagination = useCallback(
    ({
      currentIndex,
      goToNextIndex,
      gotToPrevIndex,
      goToIndex,
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
              <PaginationDot
                key={index}
                index={index}
                currentIndex={currentIndex}
                goToIndex={goToIndex}
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
              onMouseEnter={handlePaginationMouseEnter}
            />

            <PaginationButton
              isVisible={currentIndex !== data.length - 1 ? isHovering : false}
              direction="next"
              onPress={goToNextIndex}
              theme="light"
              onMouseEnter={handlePaginationMouseEnter}
            />
          </>
        ) : null}

        {showCloseButton ? (
          <BannerCloseButtonWrapper
            onBannerClose={onBannerClose}
            bannerId={data[currentIndex]?.bannerId ?? ''}
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
      handlePaginationMouseEnter,
    ],
  );

  const keyExtractor = useCallback((item: T) => item.bannerId, []);

  const handlePointerMoveTrue = useCallback(
    () => setIsHoveringThrottled(true),
    [setIsHoveringThrottled],
  );
  const handleMouseEnterTrue = useCallback(
    () => setIsHoveringThrottled(true),
    [setIsHoveringThrottled],
  );
  const handleMouseLeaveFalse = useCallback(
    () => setIsHoveringThrottled(false),
    [setIsHoveringThrottled],
  );
  const handlePointerEnterTrue = useCallback(
    () => setIsHoveringThrottled(true),
    [setIsHoveringThrottled],
  );
  const handlePointerLeaveFalse = useCallback(
    () => setIsHoveringThrottled(false),
    [setIsHoveringThrottled],
  );

  const isFocused = useIsFocused();

  if (isNil(isLoading) || isLoading || data.length === 0) {
    return emptyComponent;
  }

  return (
    <Stack
      onPointerMove={handlePointerMoveTrue}
      onMouseEnter={handleMouseEnterTrue}
      onMouseLeave={handleMouseLeaveFalse}
      w="100%"
    >
      <Swiper
        position="relative"
        autoplay={isFocused}
        autoplayLoop={isFocused}
        autoplayLoopKeepAnimation={isFocused}
        autoplayDelayMs={3000}
        keyExtractor={keyExtractor}
        data={data}
        renderItem={renderItem}
        renderPagination={renderPagination}
        overflow="hidden"
        borderRadius="$3"
        onPointerEnter={handlePointerEnterTrue}
        onPointerLeave={handlePointerLeaveFalse}
        {...(props as any)}
      />
    </Stack>
  );
}
