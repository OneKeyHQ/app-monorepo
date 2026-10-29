/* cspell:ignore hoverable */
import type { PropsWithChildren, ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  OverlayView,
  useNestedOverlayLevel,
} from '@onekeyfe/react-native-native-overlay';
import { useIsomorphicLayoutEffect } from '@tamagui/core';
import { useWindowDimensions } from 'react-native';

import {
  getTokenValue,
  withStaticProperties,
} from '@onekeyhq/components/src/shared/tamagui';
import type { Token } from '@onekeyhq/components/src/shared/tamagui';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { GlassButtonCapsule } from '../../content/GlassButtonCapsule';
import { Keyboard } from '../../content/Keyboard';
import { NativeSheetPresentation } from '../../hocs/NativeSheetPresentation';
import {
  ModalNavigatorContext,
  useModalNavigatorContext,
  useSafeAreaInsets,
} from '../../hooks';
import { useDeferredGuideBlocker } from '../../hooks/useDeferredGuideBlocker';
import { useOverlayWidthClass } from '../../hooks/useOverlayWidthClass';
import { PageContext, usePageContext } from '../../layouts/Page/PageContext';
import { ScrollView } from '../../layouts/ScrollView';
import { SizableText, XStack, YStack } from '../../primitives';
import { assertOverlayProps } from '../../shared/assertOverlayProps';
import { OverlayCloseCancelledError } from '../../shared/overlayCloseCancellation';
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
import type { LayoutChangeEvent, ViewInstance } from 'react-native';

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
// Abnormal fallback after the SDK's 5000 ms close watchdog.
const POPOVER_CLOSE_FALLBACK_MS = 5500;

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
  logicalOpen = isOpen,
  renderTrigger,
  renderContent,
  floatingPanelProps,
  sheetProps,
  onOpenChange,
  openPopover,
  closePopover,
  placement: placementProp,
  usingSheet: _usingSheet = true,
  allowFlip = true,
  showHeader = true,
  mountNativePortalBeforeOpen,
  // Tamagui floating-panel props do not apply to the native sheet.
  ..._props
}: IPopoverProps & { logicalOpen?: boolean }) {
  useDeferredGuideBlocker(Boolean(isOpen));
  const { bottom } = useSafeAreaInsets();
  const { height: viewportHeight } = useWindowDimensions();
  // Native callers always keep a sheet presentation, including controls
  // that opt out of sheets only for their web anchored panel.
  const useNativeSheet = true;
  const [sheetHeaderHeight, setSheetHeaderHeight] = useState<
    number | undefined
  >();
  const [sheetContentMeasurement, setSheetContentMeasurement] = useState<
    IStableContentHeightMeasurement | undefined
  >();
  const sheetInnerViewRef = useRef<ViewInstance>(null!);
  const sheetMeasureRequestRef = useRef(0);
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
        sheetMeasureRequestRef.current += 1;
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
  useIsomorphicLayoutEffect(() => {
    if (isOpen && isFitSheet && sheetScrollContentHeight === undefined) {
      sheetMeasureRequestRef.current += 1;
      const request = sheetMeasureRequestRef.current;
      sheetInnerViewRef.current?.measure((_x, _y, _width, height) => {
        if (
          request === sheetMeasureRequestRef.current &&
          renderContentGeneration === renderContentGenerationRef.current
        ) {
          sheetContentHeightSchedulerRef.current?.schedule(
            height,
            renderContentGeneration,
          );
        }
      });
    }
    return () => {
      sheetMeasureRequestRef.current += 1;
    };
  }, [isFitSheet, isOpen, renderContentGeneration, sheetScrollContentHeight]);
  const nativeSheetMaxHeight = Math.floor(
    viewportHeight * FIT_SHEET_MAX_HEIGHT_RATIO,
  );
  const percentSheetHeight = !isFitSheet
    ? Math.min(
        nativeSheetMaxHeight,
        Math.max(
          1,
          (viewportHeight * (sheetProps?.snapPoints?.[0] ?? 80)) / 100,
        ),
      )
    : undefined;
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
    resolvedSheetHeaderHeight !== undefined
      ? Math.max(
          0,
          (percentSheetHeight ?? nativeSheetMaxHeight) -
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
  const hasRequestedNativeSheetRef = useRef(false);
  const previousOpenRef = useRef(false);
  const openCycleRef = useRef(0);
  if (logicalOpen && !previousOpenRef.current) openCycleRef.current += 1;
  previousOpenRef.current = Boolean(logicalOpen);
  const renderCycle = openCycleRef.current;
  const desiredOpenRef = useRef(Boolean(logicalOpen));
  desiredOpenRef.current = Boolean(logicalOpen);
  const nativeSheetOpen = Boolean(
    useNativeSheet &&
    isOpen &&
    (!isFitSheet ||
      hasOpenedNativeSheetRef.current ||
      nativeFitSheetHeight !== undefined),
  );
  if (nativeSheetOpen) hasRequestedNativeSheetRef.current = true;
  useIsomorphicLayoutEffect(() => {
    if (!isOpen) {
      hasOpenedNativeSheetRef.current = false;
    } else if (nativeSheetOpen) {
      hasOpenedNativeSheetRef.current = true;
    }
  }, [isOpen, nativeSheetOpen]);
  // `closePopover()` resolves on the sheet's exit callback. The timer also
  // covers a missing callback after the SDK's close watchdog.
  const pendingCloseRef = useRef<
    | {
        promise: Promise<void>;
        resolve: () => void;
        reject: (error: Error) => void;
        timer: ReturnType<typeof setTimeout>;
        sawClosed: boolean;
      }
    | undefined
  >(undefined);
  const flushPendingClose = useCallback((cancelled = false) => {
    const pending = pendingCloseRef.current;
    if (!pending) return;
    pendingCloseRef.current = undefined;
    clearTimeout(pending.timer);
    if (cancelled) {
      pending.reject(
        new OverlayCloseCancelledError('Popover close canceled by reopening'),
      );
    } else {
      pending.resolve();
    }
  }, []);
  useEffect(() => () => flushPendingClose(), [flushPendingClose]);
  useIsomorphicLayoutEffect(() => {
    if (pendingCloseRef.current) {
      if (!logicalOpen) {
        pendingCloseRef.current.sawClosed = true;
      } else if (pendingCloseRef.current.sawClosed) {
        flushPendingClose(true);
      }
    }
  }, [flushPendingClose, logicalOpen]);
  const handleClosePopover = useCallback(() => {
    if (pendingCloseRef.current) {
      return pendingCloseRef.current.promise;
    }
    if (!nativeSheetOpen && !hasRequestedNativeSheetRef.current) {
      closePopover?.();
      return Promise.resolve();
    }
    let resolve: () => void = () => undefined;
    let reject: (error: Error) => void = () => undefined;
    const promise = new Promise<void>((done, fail) => {
      resolve = done;
      reject = fail;
    });
    void promise.catch(() => undefined);
    const timer = setTimeout(flushPendingClose, POPOVER_CLOSE_FALLBACK_MS);
    pendingCloseRef.current = {
      promise,
      resolve,
      reject,
      timer,
      sawClosed: false,
    };
    closePopover?.();
    return promise;
  }, [closePopover, flushPendingClose, nativeSheetOpen]);
  const onSheetAnimationComplete = sheetProps?.onAnimationComplete;
  const hasOpenAttemptRef = useRef(false);
  const handleSheetAnimationComplete = useCallback(
    (info: { open: boolean }) => {
      if (renderCycle !== openCycleRef.current) return;
      if (!info.open && !desiredOpenRef.current) {
        hasRequestedNativeSheetRef.current = false;
        hasOpenAttemptRef.current = false;
        flushPendingClose();
      }
      onSheetAnimationComplete?.(info);
    },
    [flushPendingClose, onSheetAnimationComplete, renderCycle],
  );
  useIsomorphicLayoutEffect(() => {
    if (isOpen) {
      hasOpenAttemptRef.current = true;
    } else if (
      hasOpenAttemptRef.current &&
      !hasRequestedNativeSheetRef.current
    ) {
      handleSheetAnimationComplete({ open: false });
    }
  }, [handleSheetAnimationComplete, isOpen]);

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

  return (
    <NativeSheetPresentation
      open={nativeSheetOpen}
      height={
        percentSheetHeight !== undefined
          ? Math.max(1, percentSheetHeight - nativeSheetSystemBottomInset)
          : nativeFitSheetHeight
      }
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
      {/* The overlay caps the sheet width (OVERLAY_SHEET_MAX_WIDTH). */}
      <YStack height={percentSheetHeight}>
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
          flex={isFitSheet ? undefined : 1}
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
          innerViewRef={sheetInnerViewRef}
          borderCurve="continuous"
        >
          {content}
        </ScrollView>
      </YStack>
    </NativeSheetPresentation>
  );
}

const ANCHORED_PANEL_WIDTH = 384;

// The panel is positioned in points, so size tokens (`$56`) resolve here.
function resolveAnchoredPanelWidth(width: unknown): number {
  if (typeof width === 'number') return width;
  if (typeof width === 'string' && width.startsWith('$')) {
    const value = Number(getTokenValue(width as Token, 'size'));
    if (Number.isFinite(value) && value > 0) return value;
  }
  return ANCHORED_PANEL_WIDTH;
}
const ANCHORED_VIEWPORT_PADDING = 8;
const ANCHORED_DEFAULT_OFFSET = 8;
// Below this much room the panel opens on the other side of the trigger.
const ANCHORED_MIN_HEIGHT = 240;
// Longer than the system rotation and window resize animations.
const ANCHORED_SETTLE_MS = 500;
const ANCHORED_BACKDROP = { color: 'transparent', dismissOnPress: true };
const ANCHORED_SHADOW_OFFSET = { width: 0, height: 8 };

interface IAnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Mirrors floating-ui's `offset` for the bottom/top placements native uses:
// mainAxis is the gap from the trigger, crossAxis shifts horizontally, and
// alignmentAxis replaces crossAxis for start/end alignments.
function resolveAnchoredOffset(
  offset: IPopoverProps['offset'],
  placement: IPopoverProps['placement'],
): { mainAxis: number; crossAxis: number } {
  if (typeof offset === 'number') return { mainAxis: offset, crossAxis: 0 };
  if (!offset || typeof offset === 'function') {
    return { mainAxis: ANCHORED_DEFAULT_OFFSET, crossAxis: 0 };
  }
  const align = (placement ?? 'bottom-end').split('-')[1];
  const { mainAxis = 0, crossAxis = 0, alignmentAxis } = offset;
  if (align && typeof alignmentAxis === 'number') {
    return {
      mainAxis,
      crossAxis: align === 'end' ? -alignmentAxis : alignmentAxis,
    };
  }
  return { mainAxis, crossAxis };
}

function getAnchoredFrame({
  anchor,
  placement,
  offset,
  crossOffset,
  width: preferredWidth,
  maxHeight: preferredMaxHeight,
  window,
  insets,
}: {
  anchor: IAnchorRect;
  placement: IPopoverProps['placement'];
  offset: number;
  crossOffset: number;
  width: number;
  maxHeight?: number;
  window: { width: number; height: number };
  insets: { top: number; left: number; bottom: number; right: number };
}) {
  const minX = insets.left + ANCHORED_VIEWPORT_PADDING;
  const maxX = window.width - insets.right - ANCHORED_VIEWPORT_PADDING;
  const width = Math.max(0, Math.min(preferredWidth, maxX - minX));
  // Native panels open below or above the trigger; side placements map to
  // below so the panel never covers its trigger on narrow side rails.
  const [side, align] = (placement ?? 'bottom-end').split('-');
  let left: number;
  if (align === 'start') {
    left = anchor.x;
  } else if (align === 'end') {
    left = anchor.x + anchor.width - width;
  } else {
    left = anchor.x + anchor.width / 2 - width / 2;
  }
  left = Math.min(Math.max(left + crossOffset, minX), maxX - width);

  const spaceBelow =
    window.height -
    insets.bottom -
    ANCHORED_VIEWPORT_PADDING -
    (anchor.y + anchor.height + offset);
  const spaceAbove = anchor.y - offset - insets.top - ANCHORED_VIEWPORT_PADDING;
  const preferAbove = side === 'top';
  const openAbove = preferAbove
    ? spaceAbove >= ANCHORED_MIN_HEIGHT || spaceAbove >= spaceBelow
    : spaceBelow < ANCHORED_MIN_HEIGHT && spaceAbove > spaceBelow;
  const available = Math.max(0, openAbove ? spaceAbove : spaceBelow);
  const maxHeight =
    preferredMaxHeight !== undefined
      ? Math.min(preferredMaxHeight, available)
      : available;
  return openAbove
    ? {
        left,
        width,
        maxHeight,
        bottom: window.height - (anchor.y - offset),
      }
    : { left, width, maxHeight, top: anchor.y + anchor.height + offset };
}

// Wide-window presentation: a panel placed under (or above) its trigger in a
// non-sheet overlay, like the anchored panel on web.
function AnchoredPopover({
  isOpen,
  anchor,
  placement,
  offset,
  floatingPanelProps,
  renderContent,
  closePopover,
  onAnimationComplete,
  anchorIsModalRelative,
}: {
  isOpen: boolean;
  anchor: IAnchorRect | undefined;
  // A rect from `measureInWindow`, relative to the enclosing native modal;
  // the overlay reports the offset that maps it onto the screen.
  anchorIsModalRelative: boolean;
  placement: IPopoverProps['placement'];
  offset: IPopoverProps['offset'];
  floatingPanelProps: IPopoverProps['floatingPanelProps'];
  renderContent: IPopoverProps['renderContent'];
  closePopover: () => void;
  // Mirrors the sheet's animation callback so callers that wait for the
  // close (ActionList runs item actions after it) are not left on a timeout.
  onAnimationComplete?: (info: { open: boolean }) => void;
}) {
  useDeferredGuideBlocker(isOpen);
  // Unlike the sheet, this stays mounted while closed, so dismiss the
  // keyboard on open/close transitions only, never on mount.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (wasOpenRef.current === isOpen) return;
    wasOpenRef.current = isOpen;
    void Keyboard.dismissWithDelay(50);
  }, [isOpen]);
  const level = useNestedOverlayLevel();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const [windowOffset, setWindowOffset] = useState<{ x: number; y: number }>();
  const [windowOffsetRequest, setWindowOffsetRequest] = useState(0);
  useEffect(() => {
    // Drop the last offset so a reopen waits for a fresh one.
    if (!isOpen) setWindowOffset(undefined);
  }, [isOpen]);
  useEffect(() => {
    if (anchorIsModalRelative && isOpen && anchor) {
      setWindowOffsetRequest((request) => request + 1);
    }
  }, [anchor, anchorIsModalRelative, isOpen]);
  const handleWindowOffset = useCallback(
    (next: { x: number; y: number }) =>
      setWindowOffset((prev) =>
        prev && prev.x === next.x && prev.y === next.y ? prev : next,
      ),
    [],
  );
  const screenAnchor = useMemo(() => {
    if (!anchor || !anchorIsModalRelative) return anchor;
    if (!windowOffset) return undefined;
    return {
      ...anchor,
      x: anchor.x + windowOffset.x,
      y: anchor.y + windowOffset.y,
    };
  }, [anchor, anchorIsModalRelative, windowOffset]);
  const closeResolversRef = useRef<Array<() => void>>([]);
  const flushCloseResolvers = useCallback(() => {
    const resolvers = closeResolversRef.current;
    closeResolversRef.current = [];
    resolvers.forEach((resolve) => resolve());
  }, []);
  useEffect(() => flushCloseResolvers, [flushCloseResolvers]);
  const handlePresented = useCallback(
    () => onAnimationComplete?.({ open: true }),
    [onAnimationComplete],
  );
  const handleClosed = useCallback(() => {
    flushCloseResolvers();
    onAnimationComplete?.({ open: false });
  }, [flushCloseResolvers, onAnimationComplete]);
  const handleClosePopover = useCallback(
    () =>
      new Promise<void>((resolve) => {
        if (!isOpen) {
          resolve();
          return;
        }
        closeResolversRef.current.push(resolve);
        setTimeout(resolve, POPOVER_CLOSE_FALLBACK_MS);
        closePopover();
      }),
    [closePopover, isOpen],
  );
  const popoverContextValue = useMemo(
    () => ({ open: isOpen, closePopover: handleClosePopover }),
    [handleClosePopover, isOpen],
  );

  const {
    width: panelWidthProp,
    maxWidth: _maxWidth,
    maxHeight: panelMaxHeightProp,
    style: _style,
    onOpenAutoFocus: _openFocus,
    onCloseAutoFocus: _closeFocus,
    trapFocus: _trapFocus,
    ...panelProps
  } = floatingPanelProps ?? {};
  const resolvedOffset = resolveAnchoredOffset(offset, placement);
  const frame = screenAnchor
    ? getAnchoredFrame({
        anchor: screenAnchor,
        placement,
        offset: resolvedOffset.mainAxis,
        crossOffset: resolvedOffset.crossAxis,
        width: resolveAnchoredPanelWidth(panelWidthProp),
        maxHeight:
          typeof panelMaxHeightProp === 'number'
            ? panelMaxHeightProp
            : undefined,
        window,
        insets,
      })
    : undefined;

  const RenderContent =
    typeof renderContent === 'function' ? renderContent : null;
  return (
    <OverlayView
      visible={isOpen && !!frame}
      level={level}
      presentation="anchored"
      backdrop={ANCHORED_BACKDROP}
      dismissOnBackPress
      onRequestDismiss={closePopover}
      onPresented={handlePresented}
      onClose={handleClosed}
      // Mounted (hidden) while open so it can report the modal offset
      // before the panel is placed.
      keepContentMounted={anchorIsModalRelative && isOpen}
      windowOffsetRequest={windowOffsetRequest}
      onWindowOffset={anchorIsModalRelative ? handleWindowOffset : undefined}
    >
      {frame ? (
        <YStack
          position="absolute"
          left={frame.left}
          top={frame.top}
          bottom={frame.bottom}
          width={frame.width}
          maxHeight={frame.maxHeight}
          backgroundColor="$bg"
          borderRadius="$4"
          borderWidth="$px"
          borderColor="$borderSubdued"
          borderCurve="continuous"
          overflow="hidden"
          elevation={8}
          shadowColor="black"
          shadowOpacity={0.12}
          shadowRadius={24}
          shadowOffset={ANCHORED_SHADOW_OFFSET}
          {...panelProps}
        >
          <ScrollView
            flexShrink={1}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          >
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
          </ScrollView>
        </YStack>
      ) : null}
    </OverlayView>
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
  nativePresentation = 'auto',
  nativeAnchorRect,
  ...rest
}: IPopoverProps) {
  assertOverlayProps('Popover', { ...rest, sheetProps });
  const { isOpen, onOpenChange, openPopover, closePopover } = usePopoverValue(
    open,
    onOpenChangeFunc,
    trackID,
  );
  const isExpandedWindow = useOverlayWidthClass() === 'expanded';
  const isAnchored =
    Boolean(renderTrigger || nativeAnchorRect) &&
    (nativePresentation === 'anchored' ||
      (nativePresentation === 'auto' && isExpandedWindow));
  // A presentation change (folding, rotating across the wide threshold,
  // resizing a window) leaves the open panel or sheet in the wrong form, and a
  // transient menu is cheaper to reopen than to morph: close it.
  const previousIsAnchoredRef = useRef(isAnchored);
  useEffect(() => {
    if (previousIsAnchoredRef.current === isAnchored) return;
    previousIsAnchoredRef.current = isAnchored;
    if (isOpen) {
      closePopover();
    }
  }, [closePopover, isAnchored, isOpen]);

  const triggerRef = useRef<ViewInstance>(null);
  const [anchor, setAnchor] = useState<IAnchorRect | undefined>();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  useEffect(() => {
    // Drop the last measurement so a reopen waits for a fresh one instead of
    // presenting at the old position and jumping.
    if (!isOpen) setAnchor(undefined);
  }, [isOpen]);
  useEffect(() => {
    if (!isAnchored || !isOpen || nativeAnchorRect) return;
    // Re-measure on every window size change so the panel follows its
    // trigger when the window resizes or rotates within the wide range. The
    // new size arrives before the rotated layout settles, so measure again
    // once the rotation animation is over.
    const measure = () => {
      triggerRef.current?.measureInWindow((x, y, width, height) => {
        setAnchor((prev) =>
          prev &&
          prev.x === x &&
          prev.y === y &&
          prev.width === width &&
          prev.height === height
            ? prev
            : { x, y, width, height },
        );
      });
    };
    measure();
    const timer = setTimeout(measure, ANCHORED_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [isAnchored, isOpen, nativeAnchorRect, windowHeight, windowWidth]);

  const {
    shouldUseNativePortalLifecycle,
    isNativePortalMounted,
    popoverOpen,
    resolvedSheetProps,
  } = useNativePortalLifecycle({
    // The anchored panel reports its own close; the sheet lifecycle would
    // otherwise complete before the panel's exit animation.
    isOpen: isAnchored ? false : isOpen,
    sheetProps,
    mountNativePortalBeforeOpen,
  });
  const memoPopover = useMemo(
    () => (
      <RawPopover
        open={popoverOpen}
        logicalOpen={isOpen}
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
      isOpen,
      mountNativePortalBeforeOpen,
      onOpenChange,
      openPopover,
      popoverOpen,
      resolvedSheetProps,
      rest,
    ],
  );
  if (isAnchored) {
    return (
      <>
        {renderTrigger ? (
          <Trigger
            ref={triggerRef}
            testID="popover-trigger"
            onPress={isOpen ? closePopover : openPopover}
          >
            {renderTrigger}
          </Trigger>
        ) : null}
        <AnchoredPopover
          isOpen={Boolean(isOpen)}
          anchor={nativeAnchorRect ?? anchor}
          anchorIsModalRelative={!nativeAnchorRect}
          placement={rest.placement}
          offset={rest.offset}
          floatingPanelProps={rest.floatingPanelProps}
          renderContent={rest.renderContent}
          closePopover={closePopover}
          onAnimationComplete={sheetProps?.onAnimationComplete}
        />
      </>
    );
  }

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
