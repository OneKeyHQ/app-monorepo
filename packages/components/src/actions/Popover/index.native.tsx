/* cspell:ignore hoverable */
import type { PropsWithChildren, ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIsomorphicLayoutEffect } from '@tamagui/core';
import { useWindowDimensions } from 'react-native';

import { useMedia } from '@onekeyhq/components/src/hooks/useStyle';
import { withStaticProperties } from '@onekeyhq/components/src/shared/tamagui';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { GlassButtonCapsule } from '../../content/GlassButtonCapsule';
import { Keyboard } from '../../content/Keyboard';
import { NativeSheetPresentation } from '../../hocs/NativeSheetPresentation';
import {
  ModalNavigatorContext,
  useModalNavigatorContext,
  useSafeAreaInsets,
} from '../../hooks';
import { PageContext, usePageContext } from '../../layouts/Page/PageContext';
import { ScrollView } from '../../layouts/ScrollView';
import { SizableText, XStack, YStack } from '../../primitives';
import { assertOverlayProps } from '../../shared/assertOverlayProps';
import { NATIVE_HIT_SLOP } from '../../utils/getFontSize';
import { IconButton } from '../IconButton';
import { Trigger } from '../Trigger';

import { PopoverContext, usePopoverContext } from './context';
import {
  runPopoverCloseSideEffects,
  runPopoverOpenSideEffects,
} from './popoverSideEffects';
import {
  type IStableContentHeightMeasurement,
  createStableContentHeightScheduler,
  getStableContentHeightForGeneration,
} from './stableContentHeight';
import { useNativePortalLifecycle } from './useNativePortalLifecycle';

import type { IPopoverProps, IPopoverTooltip } from './type';
import type { IIconButtonProps } from '../IconButton';
import type { LayoutChangeEvent } from 'react-native';

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

const WORD_BREAK_ALL_STYLE = { wordBreak: 'break-all' } as const;
// Longest overlay exit plus slack; only a safety net for `closePopover()`.
const POPOVER_CLOSE_FALLBACK_MS = 1000;

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
  allowFlip = true,
  showHeader = true,
  mountNativePortalBeforeOpen,
  // Tamagui floating-panel props do not apply to the native sheet.
  ..._props
}: IPopoverProps) {
  const { bottom } = useSafeAreaInsets();
  const { height: viewportHeight } = useWindowDimensions();
  const { gtMd } = useMedia();
  // Every native popover is a native overlay sheet. `usingSheet={false}`
  // renders no panel on native (those callers are web / desktop panels).
  const useNativeSheet = usingSheet;
  const isWideSheet = Boolean(gtMd) || Boolean(platformEnv.isNativeIOSPad);
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
  // `closePopover()` resolves once the sheet's exit animation finished; the
  // timer only covers a sheet that never presented.
  const closeResolversRef = useRef<Array<() => void>>([]);
  const pendingCloseRef = useRef<Promise<void> | undefined>(undefined);
  const flushCloseResolvers = useCallback(() => {
    const resolvers = closeResolversRef.current;
    closeResolversRef.current = [];
    resolvers.forEach((resolve) => resolve());
  }, []);
  useEffect(() => () => flushCloseResolvers(), [flushCloseResolvers]);
  const handleClosePopover = useCallback(() => {
    if (pendingCloseRef.current) {
      return pendingCloseRef.current;
    }
    if (!nativeSheetOpen) {
      closePopover?.();
      return Promise.resolve();
    }
    const completion = new Promise<void>((resolve) => {
      const timer = setTimeout(flushCloseResolvers, POPOVER_CLOSE_FALLBACK_MS);
      closeResolversRef.current.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
    pendingCloseRef.current = completion.finally(() => {
      pendingCloseRef.current = undefined;
    });
    closePopover?.();
    return pendingCloseRef.current;
  }, [closePopover, flushCloseResolvers, nativeSheetOpen]);
  const onSheetAnimationComplete = sheetProps?.onAnimationComplete;
  const handleSheetAnimationComplete = useCallback(
    (info: { open: boolean }) => {
      onSheetAnimationComplete?.(info);
      if (!info.open) {
        flushCloseResolvers();
      }
    },
    [flushCloseResolvers, onSheetAnimationComplete],
  );

  useDismissKeyboard(isOpen);

  const handleNativeSheetOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        closePopover?.();
      }
    },
    [closePopover],
  );

  const RenderContent =
    typeof renderContent === 'function' ? renderContent : null;
  const popoverContextValue = useMemo(
    () => ({
      open: isOpen,
      closePopover: handleClosePopover,
    }),
    [handleClosePopover, isOpen],
  );
  const content = (
    <ModalPortalProvider>
      <PopoverContext.Provider value={popoverContextValue}>
        {RenderContent
          ? ((
              <RenderContent
                isOpen={isOpen}
                closePopover={handleClosePopover}
              />
            ) as ReactElement)
          : (renderContent as ReactElement)}
      </PopoverContext.Provider>
    </ModalPortalProvider>
  );

  if (!useNativeSheet) {
    return null;
  }
  return (
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
      onAnimationComplete={handleSheetAnimationComplete}
    >
      <YStack {...(isWideSheet ? gtMdShFrameStyle : undefined)}>
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
            <GlassButtonCapsule circular>
              <IconButton
                icon="CrossedSmallOutline"
                size="small"
                hitSlop={NATIVE_HIT_SLOP}
                onPress={closePopover}
                testID="popover-btn-close"
              />
            </GlassButtonCapsule>
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
  assertOverlayProps('Popover', { ...rest, sheetProps });
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
  // The overlay sheet renders in the native overlay level, so the popover
  // stays in the caller's tree (and its contexts) instead of a portal.
  return (
    <>
      {renderTrigger ? (
        <Trigger testID="popover-trigger" onPress={openPopover}>
          {renderTrigger}
        </Trigger>
      ) : null}
      {keepChildrenMounted ||
      (shouldUseNativePortalLifecycle ? isNativePortalMounted : isOpen)
        ? memoPopover
        : null}
    </>
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
  Tooltip,
});

export * from './type';
export { usePopoverContext };
