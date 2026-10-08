/* cspell:ignore hoverable */
import type {
  ComponentType,
  PropsWithChildren,
  ReactElement,
  ReactNode,
} from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIsomorphicLayoutEffect } from '@tamagui/core';
import { Dimensions, useWindowDimensions } from 'react-native';

import { useMedia } from '@onekeyhq/components/src/hooks/useStyle';
import { withStaticProperties } from '@onekeyhq/components/src/shared/tamagui';
import type { SheetProps } from '@onekeyhq/components/src/shared/tamagui';
import { TMPopover } from '@onekeyhq/components/src/shared/tamaguiOverlay';
import type {
  PopoverContentProps as PopoverContentTypeProps,
  TMPopoverProps,
} from '@onekeyhq/components/src/shared/tamaguiOverlay';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { SHEET_POPOVER_Z_INDEX } from '@onekeyhq/shared/src/utils/overlayUtils';

import { FIX_SHEET_PROPS } from '../../composite/Dialog';
import { Keyboard } from '../../content/Keyboard';
import { Portal } from '../../hocs';
import { NativeSheetPresentation } from '../../hocs/NativeSheetPresentation';
import {
  ModalNavigatorContext,
  useBackHandler,
  useKeyboardHeight,
  useModalNavigatorContext,
  useOverlayZIndex,
  useSafeAreaInsets,
} from '../../hooks';
import { PageContext, usePageContext } from '../../layouts/Page/PageContext';
import { ScrollView } from '../../layouts/ScrollView';
import { SizableText, Stack, XStack, YStack } from '../../primitives';
import {
  ANIMATE_ONLY_OPACITY,
  ANIMATE_ONLY_OPACITY_TRANSFORM,
} from '../../utils/animationConstants';
import { NATIVE_HIT_SLOP } from '../../utils/getFontSize';
import { IconButton } from '../IconButton';
import { Trigger } from '../Trigger';

import { PopoverContext, usePopoverContext } from './context';
import { PopoverContent } from './PopoverContent';
import {
  runPopoverCloseSideEffects,
  runPopoverOpenSideEffects,
} from './popoverSideEffects';
import { shouldUseNativeSheetPresentation } from './sheetPresentation';
import {
  type IStableContentHeightMeasurement,
  createStableContentHeightScheduler,
  getStableContentHeightForGeneration,
} from './stableContentHeight';
import { useNativePortalLifecycle } from './useNativePortalLifecycle';

import type { IPopoverTooltip } from './type';
import type { IIconButtonProps } from '../IconButton';
import type { LayoutChangeEvent, View } from 'react-native';

const gtMdShFrameStyle = {
  minWidth: 400,
  maxWidth: 480,
  mx: 'auto',
} as const;

// Fit-mode sheets size their frame to the content, and the sheet only caps the
// inner ScrollView at the full screen height, so a tall list plus the header
// pushes the frame past the screen (header under the status bar, last rows
// clipped). Keep the whole frame within the footprint percent-mode sheets use,
// so short lists stay compact and long lists scroll.
const FIT_SHEET_MAX_HEIGHT_RATIO = 0.92;
// Matches the `$5` fallback margin under the sheet ScrollView.
const SHEET_BOTTOM_MARGIN = 20;
// Matches the `$-0.5` overlap between the header and content card.
const SHEET_HEADER_CONTENT_OVERLAP = 2;

const POPOVER_ENTER_STYLE = { scale: 0.95, opacity: 0 } as const;
const POPOVER_EXIT_STYLE = { scale: 0.95, opacity: 0 } as const;
const POPOVER_PLATFORM_WEB_STYLE = {
  outlineColor: '$neutral3',
  outlineStyle: 'solid',
  outlineWidth: '$px',
  boxShadow:
    '0 4px 6px -4px rgba(0, 0, 0, 0.10), 0 10px 15px -3px rgba(0, 0, 0, 0.10)',
} as const;
const POPOVER_PLATFORM_NATIVE = { elevation: 20 } as const;
const OVERLAY_ENTER_STYLE = { opacity: 0 } as const;
const OVERLAY_EXIT_STYLE = { opacity: 0 } as const;
const WORD_BREAK_ALL_STYLE = { wordBreak: 'break-all' } as const;
const WEB_KEEP_MOUNTED_TRANSITION =
  'opacity 150ms cubic-bezier(0.215, 0.61, 0.355, 1), transform 150ms cubic-bezier(0.215, 0.61, 0.355, 1)';
export interface IPopoverProps extends TMPopoverProps {
  title: string | ReactElement;
  description?: string;
  showHeader?: boolean;
  usingSheet?: boolean;
  /** Uses the platform-native sheet presentation on iOS and Android. */
  nativeSheet?: boolean;
  renderTrigger: ReactNode;
  openPopover?: () => void;
  closePopover?: () => void;
  renderContent:
    | ReactElement
    | ComponentType<{ isOpen?: boolean; closePopover: () => void }>
    | null;
  floatingPanelProps?: PopoverContentTypeProps;
  sheetProps?: SheetProps;
  /**
   * Mounts the native portal closed before opening and removes it after the
   * close animation. This avoids preserving child state between openings.
   */
  mountNativePortalBeforeOpen?: boolean;
  /**
   * Unique identifier for tracking/analytics purposes.
   */
  trackID?: string;
}

const usePopoverValue = (
  open?: boolean,
  onOpenChange?: IPopoverProps['onOpenChange'],
  trackID?: string,
) => {
  const [isOpen, setIsOpen] = useState(false);
  const isControlled = typeof open !== 'undefined';

  const openPopover = useCallback(() => {
    if (isControlled) {
      onOpenChange?.(true);
    } else {
      setIsOpen(true);
      onOpenChange?.(true);
    }

    runPopoverOpenSideEffects(trackID);
  }, [isControlled, onOpenChange, trackID]);

  const closePopover = useCallback(() => {
    if (isControlled) {
      onOpenChange?.(false);
    } else {
      setIsOpen(false);
      onOpenChange?.(false);
    }

    runPopoverCloseSideEffects(trackID);
  }, [isControlled, onOpenChange, trackID]);

  return {
    ...(isControlled
      ? {
          isOpen: open,
          onOpenChange,
        }
      : {
          isOpen,
          onOpenChange: setIsOpen,
        }),
    openPopover,
    closePopover,
  };
};

function ModalPortalProvider({ children }: PropsWithChildren) {
  const modalNavigatorContext = useModalNavigatorContext();
  const pageContextValue = usePageContext();
  return (
    <ModalNavigatorContext.Provider value={modalNavigatorContext}>
      <PageContext.Provider value={pageContextValue}>
        {children}
      </PageContext.Provider>
    </ModalNavigatorContext.Provider>
  );
}

const useDismissKeyboard = platformEnv.isNative
  ? (isOpen?: boolean) => {
      useMemo(() => {
        void Keyboard.dismissWithDelay(50);
      }, []);
      const isOpenRef = useRef(isOpen);
      useEffect(() => {
        if (isOpenRef.current !== isOpen) {
          isOpenRef.current = isOpen;
          void Keyboard.dismissWithDelay(50);
        }
      }, [isOpen]);
    }
  : () => {};

const getPlacement = (
  placementProp: IPopoverProps['placement'],
  triggerRef: React.RefObject<View | null>,
): NonNullable<IPopoverProps['placement']> => {
  if (platformEnv.isNative) {
    return placementProp || 'bottom-end';
  }

  const element = triggerRef.current as unknown as HTMLElement;
  if (!element) {
    return placementProp || 'bottom-end';
  }

  const rect = element.getBoundingClientRect();
  const windowWidth = Dimensions.get('window').width;
  const windowHeight = Dimensions.get('window').height;

  // Estimated popover dimensions (default width $96 = 384px)
  const POPOVER_MIN_WIDTH = 384;
  const POPOVER_MIN_HEIGHT = 200; // Estimated minimum height
  const OFFSET = 8; // Popover offset

  // Calculate available space in each direction
  const spaces = {
    top: rect.top - OFFSET,
    bottom: windowHeight - rect.bottom - OFFSET,
    left: rect.left - OFFSET,
    right: windowWidth - rect.right - OFFSET,
  };

  // Check if a placement has enough space
  const hasEnoughSpace = (placement: string): boolean => {
    if (placement.startsWith('top')) {
      return spaces.top >= POPOVER_MIN_HEIGHT;
    }
    if (placement.startsWith('bottom')) {
      return spaces.bottom >= POPOVER_MIN_HEIGHT;
    }
    if (placement.startsWith('left')) {
      return spaces.left >= POPOVER_MIN_WIDTH;
    }
    if (placement.startsWith('right')) {
      return spaces.right >= POPOVER_MIN_WIDTH;
    }
    return false;
  };

  // If placementProp is specified and has enough space, use it
  if (placementProp && hasEnoughSpace(placementProp)) {
    return placementProp;
  }

  // Otherwise, choose the direction with most space
  const verticalPreference = spaces.bottom >= spaces.top ? 'bottom' : 'top';
  const horizontalAlignment = rect.left > windowWidth / 2 ? 'end' : 'start';

  // Build placement string
  const buildPlacement = (
    vertical: 'top' | 'bottom',
    horizontal: 'start' | 'end',
  ): NonNullable<IPopoverProps['placement']> =>
    `${vertical}-${horizontal}` as NonNullable<IPopoverProps['placement']>;

  // Check if preferred direction has enough space
  if (hasEnoughSpace(verticalPreference)) {
    return buildPlacement(verticalPreference, horizontalAlignment);
  }

  // Try opposite direction
  const oppositeVertical = verticalPreference === 'bottom' ? 'top' : 'bottom';
  if (hasEnoughSpace(oppositeVertical)) {
    return buildPlacement(oppositeVertical, horizontalAlignment);
  }

  // If neither has enough space, return the direction with most space (may overflow, but best option)
  return buildPlacement(verticalPreference, horizontalAlignment);
};

function RawPopover({
  title,
  description,
  open: isOpen,
  renderTrigger,
  renderContent,
  floatingPanelProps,
  sheetProps,
  onOpenChange,
  openPopover,
  closePopover,
  placement: placementProp,
  usingSheet = true,
  nativeSheet = false,
  allowFlip = true,
  showHeader = true,
  mountNativePortalBeforeOpen,
  ...props
}: IPopoverProps) {
  const { bottom } = useSafeAreaInsets();
  const { height: viewportHeight } = useWindowDimensions();
  const { gtMd } = useMedia();
  const useNativeSheet = shouldUseNativeSheetPresentation({
    usingSheet,
    nativeSheet,
    isGtMd: Boolean(gtMd),
    isNativeIOSPad: Boolean(platformEnv.isNativeIOSPad),
  });
  const [sheetHeaderHeight, setSheetHeaderHeight] = useState<
    number | undefined
  >();
  const [sheetContentMeasurement, setSheetContentMeasurement] = useState<
    IStableContentHeightMeasurement | undefined
  >();
  const previousRenderContentRef = useRef(renderContent);
  const renderContentGenerationRef = useRef(0);
  if (previousRenderContentRef.current !== renderContent) {
    previousRenderContentRef.current = renderContent;
    renderContentGenerationRef.current += 1;
  }
  const renderContentGeneration = renderContentGenerationRef.current;
  const sheetScrollContentHeight = getStableContentHeightForGeneration(
    sheetContentMeasurement,
    renderContentGeneration,
  );
  const sheetContentHeightSchedulerRef = useRef<
    ReturnType<typeof createStableContentHeightScheduler> | undefined
  >(undefined);
  useIsomorphicLayoutEffect(() => {
    const scheduler = createStableContentHeightScheduler({
      onStableMeasurement: setSheetContentMeasurement,
    });
    sheetContentHeightSchedulerRef.current = scheduler;
    return () => {
      scheduler.dispose();
      if (sheetContentHeightSchedulerRef.current === scheduler) {
        sheetContentHeightSchedulerRef.current = undefined;
      }
    };
  }, []);
  const handleSheetHeaderLayout = useCallback((event: LayoutChangeEvent) => {
    setSheetHeaderHeight(Math.ceil(event.nativeEvent.layout.height));
  }, []);
  const handleSheetContentSizeChange = useCallback(
    (_width: number, height: number) => {
      if (renderContentGenerationRef.current === renderContentGeneration) {
        sheetContentHeightSchedulerRef.current?.schedule(
          height,
          renderContentGeneration,
        );
      }
    },
    [renderContentGeneration],
  );
  const isFitSheet =
    !sheetProps?.snapPointsMode || sheetProps.snapPointsMode === 'fit';
  const keyboardHeight = useKeyboardHeight();
  const nativeSheetMaxHeight = Math.floor(
    viewportHeight * FIT_SHEET_MAX_HEIGHT_RATIO,
  );
  const nativeSheetBottomSpacing = bottom || SHEET_BOTTOM_MARGIN;
  // UISheetPresentationController adds the window bottom safe area below a
  // custom detent. Exclude that inset from the requested detent height while
  // keeping the existing card margin in the React layout.
  const nativeSheetSystemBottomInset = platformEnv.isNativeIOS ? bottom : 0;
  const nativeSheetDetentMaxHeight = Math.max(
    1,
    nativeSheetMaxHeight - nativeSheetSystemBottomInset,
  );
  const nativeSheetDetentBottomSpacing = Math.max(
    0,
    nativeSheetBottomSpacing - nativeSheetSystemBottomInset,
  );
  const resolvedSheetHeaderHeight = showHeader ? sheetHeaderHeight : 0;
  const sheetScrollViewMaxHeight =
    isFitSheet && resolvedSheetHeaderHeight !== undefined
      ? Math.max(
          0,
          nativeSheetMaxHeight -
            resolvedSheetHeaderHeight -
            nativeSheetBottomSpacing +
            (showHeader ? SHEET_HEADER_CONTENT_OVERLAP : 0),
        )
      : undefined;
  const jsSheetScrollViewMaxHeight = isFitSheet
    ? Math.max(
        0,
        nativeSheetMaxHeight -
          (sheetHeaderHeight ?? 0) -
          nativeSheetBottomSpacing -
          keyboardHeight,
      )
    : undefined;
  const nativeFitSheetHeight =
    isFitSheet &&
    resolvedSheetHeaderHeight !== undefined &&
    sheetScrollContentHeight !== undefined &&
    sheetScrollViewMaxHeight !== undefined
      ? Math.min(
          nativeSheetDetentMaxHeight,
          resolvedSheetHeaderHeight +
            Math.min(sheetScrollContentHeight, sheetScrollViewMaxHeight) +
            nativeSheetDetentBottomSpacing -
            (showHeader ? SHEET_HEADER_CONTENT_OVERLAP : 0),
        )
      : undefined;
  const hasOpenedNativeSheetRef = useRef(false);
  const nativeSheetOpen = Boolean(
    useNativeSheet &&
    isOpen &&
    (!isFitSheet ||
      hasOpenedNativeSheetRef.current ||
      nativeFitSheetHeight !== undefined),
  );
  useIsomorphicLayoutEffect(() => {
    if (!isOpen) {
      hasOpenedNativeSheetRef.current = false;
    } else if (nativeSheetOpen) {
      hasOpenedNativeSheetRef.current = true;
    }
  }, [isOpen, nativeSheetOpen]);
  const triggerRef = useRef<View | null>(null);
  const contentRef = useRef<View | null>(null);
  const placement = getPlacement(placementProp, triggerRef);
  const transformOrigin = useMemo(() => {
    switch (placement) {
      case 'top':
        return 'bottom center';
      case 'bottom':
        return 'top center';
      case 'left':
        return 'right center';
      case 'right':
        return 'left center';
      case 'top-start':
        return 'bottom left';
      case 'top-end':
        return 'bottom right';
      case 'right-start':
        return 'top left';
      case 'bottom-start':
        return 'top left';
      case 'left-start':
        return 'top right';
      case 'left-end':
        return 'bottom right';
      default:
        return 'top right';
    }
  }, [placement]);

  const handleClosePopover = useCallback(
    () =>
      new Promise<void>((resolve) => {
        closePopover?.();
        setTimeout(
          () => {
            resolve();
          },
          // Need to execute the callback after the sheet animation ends on the Native side
          platformEnv.isNative ? 300 : 50,
        );
      }),
    [closePopover],
  );

  const handleBackPress = useCallback(() => {
    if (!isOpen || useNativeSheet) {
      return false;
    }
    void handleClosePopover();
    return true;
  }, [handleClosePopover, isOpen, useNativeSheet]);

  useDismissKeyboard(isOpen);
  useBackHandler(handleBackPress);

  const handleNativeSheetOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        closePopover?.();
      }
    },
    [closePopover],
  );

  const getMaxScrollViewHeight = useCallback(() => {
    if (platformEnv.isNative) {
      return undefined;
    }
    const windowHeight = Dimensions.get('window').height;
    const currentElement = triggerRef.current as unknown as HTMLElement;

    const top = currentElement?.getBoundingClientRect().top;
    const height =
      currentElement?.clientHeight ||
      currentElement?.parentElement?.clientHeight ||
      0;
    let contentHeight = 0;
    if (placement.startsWith('bottom')) {
      contentHeight = windowHeight - top - height - 20;
    } else if (placement.startsWith('top')) {
      contentHeight = top - 20;
    } else {
      contentHeight = windowHeight;
    }

    return Math.max(contentHeight, 0);
  }, [placement]);

  const RenderContent =
    typeof renderContent === 'function' ? renderContent : null;
  const popoverContextValue = useMemo(
    () => ({
      open: isOpen,
      closePopover: handleClosePopover,
    }),
    [handleClosePopover, isOpen],
  );
  const keepChildrenMounted = Boolean(props.keepChildrenMounted);
  const shouldUseWebKeepMountedTransition =
    keepChildrenMounted && !platformEnv.isNative;
  const shouldAnimateContent = !keepChildrenMounted;
  const content = (
    <ModalPortalProvider>
      <PopoverContext.Provider value={popoverContextValue}>
        <PopoverContent
          isOpen={isOpen}
          closePopover={handleClosePopover}
          hoverable={Boolean(props.hoverable)}
          keepChildrenMounted={keepChildrenMounted}
        >
          {RenderContent
            ? ((
                <RenderContent
                  isOpen={isOpen}
                  closePopover={handleClosePopover}
                />
              ) as ReactElement)
            : (renderContent as ReactElement)}
        </PopoverContent>
      </PopoverContext.Provider>
    </ModalPortalProvider>
  );

  const zIndex = useOverlayZIndex(isOpen);
  const shouldUseTransientNativeBackdrop =
    platformEnv.isNative && Boolean(mountNativePortalBeforeOpen);
  const shouldUseExternalNativeBackdrop =
    platformEnv.isNative &&
    (keepChildrenMounted || shouldUseTransientNativeBackdrop);
  const nativeBackdropBackgroundColor =
    shouldUseTransientNativeBackdrop || isOpen ? '$bgBackdrop' : 'transparent';
  const nativeBackdropOpacity = shouldUseTransientNativeBackdrop
    ? Number(isOpen)
    : undefined;

  const maxScrollViewHeight = getMaxScrollViewHeight();
  const transformOriginStyle = useMemo(
    () => ({ transformOrigin }),
    [transformOrigin],
  );
  useIsomorphicLayoutEffect(() => {
    if (!shouldUseWebKeepMountedTransition) {
      return;
    }
    const popperElement = contentRef.current as unknown as HTMLElement;
    if (!popperElement) {
      return;
    }
    const contentElement = popperElement.hasAttribute('data-state')
      ? popperElement
      : (popperElement.firstElementChild as HTMLElement | null);
    if (!contentElement) {
      return;
    }
    if (contentElement !== popperElement) {
      popperElement.style.removeProperty('transition');
      popperElement.style.removeProperty('opacity');
      popperElement.style.removeProperty('transform');
      popperElement.style.removeProperty('visibility');
    }
    contentElement.style.transition = isOpen
      ? WEB_KEEP_MOUNTED_TRANSITION
      : `${WEB_KEEP_MOUNTED_TRANSITION}, visibility 0ms linear 150ms`;
    contentElement.style.opacity = isOpen ? '1' : '0';
    contentElement.style.transform = `scale(${isOpen ? 1 : 0.95})`;
    contentElement.style.visibility = isOpen ? 'visible' : 'hidden';
  }, [isOpen, shouldUseWebKeepMountedTransition]);
  const scrollViewStyle = useMemo(
    () => ({ maxHeight: maxScrollViewHeight }),
    [maxScrollViewHeight],
  );
  const contentStyle = useMemo(
    () => [transformOriginStyle, floatingPanelProps?.style],
    [floatingPanelProps?.style, transformOriginStyle],
  );
  return (
    <TMPopover
      offset={8}
      allowFlip={allowFlip}
      placement={placement}
      onOpenChange={onOpenChange}
      open={isOpen}
      {...props}
    >
      <TMPopover.Trigger asChild>
        {/* testID is carried by renderTrigger from the caller. */}
        {/* oxlint-disable-next-line onekey/require-testid */}
        <Trigger ref={triggerRef} onPress={openPopover}>
          {renderTrigger}
        </Trigger>
      </TMPopover.Trigger>
      {/* floating panel */}
      {platformEnv.isNative ? null : (
        <TMPopover.Content
          ref={contentRef}
          zIndex={keepChildrenMounted ? undefined : SHEET_POPOVER_Z_INDEX + 1}
          trapFocus={false}
          unstyled
          w="$96"
          bg="$bg"
          borderRadius="$3"
          $platform-web={POPOVER_PLATFORM_WEB_STYLE}
          $platform-native={POPOVER_PLATFORM_NATIVE}
          {...(shouldAnimateContent
            ? {
                enterStyle: POPOVER_ENTER_STYLE,
                exitStyle: POPOVER_EXIT_STYLE,
                transition: 'popoverQuick' as const,
                animateOnly: ANIMATE_ONLY_OPACITY_TRANSFORM,
              }
            : {})}
          {...floatingPanelProps}
          style={contentStyle}
        >
          <TMPopover.ScrollView
            testID="TMPopover-ScrollView"
            style={scrollViewStyle}
          >
            {content}
          </TMPopover.ScrollView>
        </TMPopover.Content>
      )}
      {/* sheet */}
      {useNativeSheet ? (
        <NativeSheetPresentation
          open={nativeSheetOpen}
          height={nativeFitSheetHeight}
          onOpenChange={handleNativeSheetOpenChange}
          dismissOnOverlayPress={sheetProps?.dismissOnOverlayPress ?? true}
          dismissOnSnapToBottom={sheetProps?.dismissOnSnapToBottom ?? true}
          disableDrag={sheetProps?.disableDrag}
          showHandle={false}
          cornerRadius={24}
          backgroundColor="transparent"
          maxHeight={nativeSheetDetentMaxHeight}
          onAnimationComplete={sheetProps?.onAnimationComplete}
        >
          <YStack>
            {/* header */}
            {showHeader ? (
              <XStack
                onLayout={handleSheetHeaderLayout}
                borderTopLeftRadius="$6"
                borderTopRightRadius="$6"
                backgroundColor="$bg"
                mx="$5"
                p="$5"
                justifyContent="space-between"
                alignItems="flex-start"
                borderCurve="continuous"
                gap="$2"
              >
                <YStack flexShrink={1}>
                  {typeof title === 'string' ? (
                    <SizableText
                      size="$headingXl"
                      color="$text"
                      style={WORD_BREAK_ALL_STYLE}
                    >
                      {title}
                    </SizableText>
                  ) : (
                    title
                  )}
                  {description ? (
                    <SizableText size="$bodyMd" color="$textSubdued" pt="$2">
                      {description}
                    </SizableText>
                  ) : null}
                </YStack>
                <IconButton
                  icon="CrossedSmallOutline"
                  size="small"
                  hitSlop={NATIVE_HIT_SLOP}
                  onPress={closePopover}
                  testID="popover-btn-close"
                />
              </XStack>
            ) : null}
            <ScrollView
              nestedScrollEnabled
              flexShrink={1}
              minHeight={0}
              marginTop="$-0.5"
              borderTopLeftRadius={showHeader ? undefined : '$6'}
              borderTopRightRadius={showHeader ? undefined : '$6'}
              borderBottomLeftRadius="$6"
              borderBottomRightRadius="$6"
              backgroundColor="$bg"
              showsVerticalScrollIndicator={false}
              mx="$5"
              mb={bottom || '$5'}
              maxHeight={sheetScrollViewMaxHeight}
              onContentSizeChange={handleSheetContentSizeChange}
              borderCurve="continuous"
            >
              {content}
            </ScrollView>
          </YStack>
        </NativeSheetPresentation>
      ) : null}
      {usingSheet && !useNativeSheet ? (
        <>
          {shouldUseExternalNativeBackdrop ? (
            <Stack
              position="absolute"
              // Android must paint this sibling backdrop above the parent dialog.
              zIndex={
                platformEnv.isNativeAndroid
                  ? sheetProps?.zIndex || zIndex
                  : undefined
              }
              pointerEvents={isOpen ? 'auto' : 'none'}
              onPress={isOpen ? closePopover : undefined}
              bg={nativeBackdropBackgroundColor}
              opacity={nativeBackdropOpacity}
              transition={
                shouldUseTransientNativeBackdrop ? 'quick' : undefined
              }
              animateOnly={
                shouldUseTransientNativeBackdrop
                  ? ANIMATE_ONLY_OPACITY
                  : undefined
              }
              top={0}
              left={0}
              right={0}
              bottom={0}
            />
          ) : null}

          <TMPopover.Adapt when={platformEnv.isNative ? true : 'md'}>
            <TMPopover.Sheet
              dismissOnSnapToBottom
              transition="quick"
              snapPointsMode="fit"
              zIndex={zIndex}
              {...sheetProps}
            >
              {shouldUseExternalNativeBackdrop ? null : (
                <TMPopover.Sheet.Overlay
                  {...FIX_SHEET_PROPS}
                  zIndex={sheetProps?.zIndex || zIndex}
                  backgroundColor="$bgBackdrop"
                  transition="quick"
                  animateOnly={ANIMATE_ONLY_OPACITY}
                  enterStyle={OVERLAY_ENTER_STYLE}
                  exitStyle={OVERLAY_EXIT_STYLE}
                />
              )}
              <TMPopover.Sheet.Frame
                unstyled
                paddingBottom={keyboardHeight}
                {...(gtMd || platformEnv.isNativeIOSPad
                  ? gtMdShFrameStyle
                  : undefined)}
              >
                {showHeader ? (
                  <XStack
                    onLayout={handleSheetHeaderLayout}
                    borderTopLeftRadius="$6"
                    borderTopRightRadius="$6"
                    backgroundColor="$bg"
                    mx="$5"
                    p="$5"
                    justifyContent="space-between"
                    alignItems="flex-start"
                    borderCurve="continuous"
                    gap="$2"
                  >
                    <YStack flexShrink={1}>
                      {typeof title === 'string' ? (
                        <SizableText
                          size="$headingXl"
                          color="$text"
                          style={WORD_BREAK_ALL_STYLE}
                        >
                          {title}
                        </SizableText>
                      ) : (
                        title
                      )}
                      {description ? (
                        <SizableText
                          size="$bodyMd"
                          color="$textSubdued"
                          pt="$2"
                        >
                          {description}
                        </SizableText>
                      ) : null}
                    </YStack>
                    <IconButton
                      icon="CrossedSmallOutline"
                      size="small"
                      hitSlop={NATIVE_HIT_SLOP}
                      onPress={closePopover}
                      testID="popover-btn-close"
                    />
                  </XStack>
                ) : null}
                <TMPopover.Sheet.ScrollView
                  marginTop="$-0.5"
                  borderTopLeftRadius={showHeader ? undefined : '$6'}
                  borderTopRightRadius={showHeader ? undefined : '$6'}
                  borderBottomLeftRadius="$6"
                  borderBottomRightRadius="$6"
                  backgroundColor="$bg"
                  showsVerticalScrollIndicator={false}
                  mx="$5"
                  mb={bottom || '$5'}
                  maxHeight={jsSheetScrollViewMaxHeight}
                  borderCurve="continuous"
                >
                  {content}
                </TMPopover.Sheet.ScrollView>
              </TMPopover.Sheet.Frame>
            </TMPopover.Sheet>
          </TMPopover.Adapt>
        </>
      ) : null}
    </TMPopover>
  );
}

function BasicPopover({
  open,
  onOpenChange: onOpenChangeFunc,
  renderTrigger,
  sheetProps,
  trackID,
  keepChildrenMounted,
  mountNativePortalBeforeOpen,
  ...rest
}: IPopoverProps) {
  const { isOpen, onOpenChange, openPopover, closePopover } = usePopoverValue(
    open,
    onOpenChangeFunc,
    trackID,
  );
  const {
    shouldUseNativePortalLifecycle,
    isNativePortalMounted,
    popoverOpen,
    resolvedSheetProps,
  } = useNativePortalLifecycle({
    isOpen,
    sheetProps,
    mountNativePortalBeforeOpen,
  });
  const { md } = useMedia();
  const memoPopover = useMemo(
    () => (
      <RawPopover
        open={popoverOpen}
        onOpenChange={onOpenChange}
        openPopover={openPopover}
        closePopover={closePopover}
        renderTrigger={undefined}
        keepChildrenMounted={keepChildrenMounted}
        mountNativePortalBeforeOpen={mountNativePortalBeforeOpen}
        {...rest}
        sheetProps={resolvedSheetProps}
      />
    ),
    [
      closePopover,
      keepChildrenMounted,
      mountNativePortalBeforeOpen,
      onOpenChange,
      openPopover,
      popoverOpen,
      resolvedSheetProps,
      rest,
    ],
  );
  const modalNavigatorContext = useModalNavigatorContext();
  const pageContextValue = usePageContext();

  const webSheetProps = useMemo(
    () => ({ ...sheetProps, modal: true }),
    [sheetProps],
  );

  if (platformEnv.isNative) {
    // on native and ipad, we add the popover to the RNScreen.FULL_WINDOW_OVERLAY
    return (
      <>
        {renderTrigger ? (
          <Trigger testID="popover-trigger" onPress={openPopover}>
            {renderTrigger}
          </Trigger>
        ) : null}
        {keepChildrenMounted ||
        (shouldUseNativePortalLifecycle ? isNativePortalMounted : isOpen) ? (
          <Portal.Body container={Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL}>
            <ModalNavigatorContext.Provider value={modalNavigatorContext}>
              <PageContext.Provider value={pageContextValue}>
                {memoPopover}
              </PageContext.Provider>
            </ModalNavigatorContext.Provider>
          </Portal.Body>
        ) : null}
      </>
    );
  }

  // on web, we add the popover into the RNRootView
  return (
    <RawPopover
      open={isOpen}
      // On the web platform of md size,
      //  the sheet needs to use the onOpenChange function to close the popover.
      // Hoverable popovers also need it to propagate Tamagui's hover state.
      onOpenChange={md || rest.hoverable ? onOpenChange : undefined}
      openPopover={openPopover}
      closePopover={closePopover}
      sheetProps={webSheetProps}
      renderTrigger={renderTrigger}
      trackID={trackID}
      keepChildrenMounted={keepChildrenMounted}
      {...rest}
    />
  );
}

function Tooltip({
  tooltip,
  title,
  placement = 'bottom',
  iconSize = '$4',
  renderContent,
  triggerProps,
}: IPopoverTooltip & {
  iconSize?: IIconButtonProps['iconSize'];
}) {
  const triggerMemo = useMemo(
    () => (
      // testID flows through {...triggerProps} so caller controls it.
      // oxlint-disable-next-line onekey/require-testid
      <IconButton
        iconColor="$iconSubdued"
        iconSize={iconSize}
        icon="InfoCircleOutline"
        variant="tertiary"
        {...triggerProps}
      />
    ),
    [iconSize, triggerProps],
  );

  const contentMemo = useMemo(
    () =>
      renderContent || (
        <YStack p="$5">
          <SizableText size="$bodyLg">{tooltip}</SizableText>
        </YStack>
      ),
    [renderContent, tooltip],
  );

  return (
    <BasicPopover
      placement={placement}
      title={title}
      renderTrigger={triggerMemo}
      renderContent={contentMemo}
    />
  );
}

export const Popover = withStaticProperties(BasicPopover, {
  Close: TMPopover.Close,
  Tooltip,
});

export * from './type';
export { usePopoverContext };
