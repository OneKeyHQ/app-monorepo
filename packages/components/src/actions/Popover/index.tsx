/* cspell:ignore hoverable */
import type { ComponentType, ReactElement, ReactNode } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { OverlayView } from '@onekeyfe/react-native-native-overlay';
import { useWindowDimensions } from 'react-native';

import { useMedia, useTheme } from '@onekeyhq/components/src/hooks/useStyle';
import { withStaticProperties } from '@onekeyhq/components/src/shared/tamagui';
import type { SheetProps } from '@onekeyhq/components/src/shared/tamagui';
import type {
  PopoverContentProps as PopoverContentTypeProps,
  TMPopoverProps,
} from '@onekeyhq/components/src/shared/tamaguiOverlay';

import { useSafeAreaInsets } from '../../hooks';
import { ScrollView } from '../../layouts/ScrollView';
import { SizableText, XStack, YStack } from '../../primitives';
import { IconButton } from '../IconButton';
import { Trigger } from '../Trigger';

import {
  useAnchoredPosition,
  useHoverOpen,
  useOutsidePress,
} from './anchoredPopover';
import { PopoverContext, usePopoverContext } from './context';
import {
  runPopoverCloseSideEffects,
  runPopoverOpenSideEffects,
} from './popoverSideEffects';

import type { IPopoverHoverable } from './anchoredPopover';
import type { IPopoverTooltip } from './type';
import type { IIconButtonProps } from '../IconButton';
import type { Placement } from '@floating-ui/dom';
import type {
  IOverlayBackdrop,
  IOverlaySheetOptions,
} from '@onekeyfe/react-native-native-overlay';
import type { LayoutChangeEvent, View } from 'react-native';

// Fit-mode sheets size their frame to the content, and the sheet only caps the
// inner ScrollView at the full screen height, so a tall list plus the header
// pushes the frame past the screen (header under the status bar, last rows
// clipped). Keep the whole frame within the footprint percent-mode sheets use,
// so short lists stay compact and long lists scroll.
const FIT_SHEET_MAX_HEIGHT_RATIO = 0.92;
// Matches the `$5` fallback margin under the sheet ScrollView.
const SHEET_BOTTOM_MARGIN = 20;

const POPOVER_PANEL_WEB_STYLE = {
  boxShadow:
    '0 4px 6px -4px rgba(0, 0, 0, 0.10), 0 10px 15px -3px rgba(0, 0, 0, 0.10)',
} as const;
// The positioned box Floating UI moves; it caps its height to the space left.
const ANCHORED_PANEL_STYLE = {
  position: 'absolute',
  top: 0,
  left: 0,
  display: 'flex',
  flexDirection: 'column',
} as const;
const WORD_BREAK_ALL_STYLE = { wordBreak: 'break-all' } as const;
// Longest overlay exit plus slack; only a safety net for `closePopover()`.
const POPOVER_CLOSE_FALLBACK_MS = 1000;
const noop = () => undefined;
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

// Web: a native-overlay sheet on narrow windows, an anchored panel in the
// native-overlay `modal` level otherwise.
function RawPopover({
  title,
  description,
  open: isOpenProp,
  renderTrigger,
  renderContent,
  floatingPanelProps,
  sheetProps,
  openPopover,
  closePopover,
  placement = 'bottom-end',
  usingSheet = true,
  allowFlip: allowFlipProp = true,
  showHeader = true,
  offset: offsetProp,
  hoverable,
  keepChildrenMounted: keepChildrenMountedProp,
}: IPopoverProps) {
  const isOpen = Boolean(isOpenProp);
  const offset = typeof offsetProp === 'number' ? offsetProp : 8;
  const allowFlip = allowFlipProp !== false;
  // 'lazy' keeps the content once opened; mounting it up front is equivalent.
  const keepChildrenMounted = Boolean(keepChildrenMountedProp);
  const theme = useTheme();
  const { md } = useMedia();
  const { bottom } = useSafeAreaInsets();
  const { height: viewportHeight } = useWindowDimensions();
  const isSheet = usingSheet && md;
  const triggerRef = useRef<View | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panel, setPanel] = useState<HTMLDivElement | null>(null);
  const handlePanelRef = useCallback((node: HTMLDivElement | null) => {
    panelRef.current = node;
    setPanel(node);
  }, []);

  // Resolves once the overlay finished its exit animation.
  const closeResolversRef = useRef<Array<() => void>>([]);
  const flushCloseResolvers = useCallback(() => {
    const resolvers = closeResolversRef.current;
    closeResolversRef.current = [];
    resolvers.forEach((resolve) => resolve());
  }, []);
  const handleClosePopover = useCallback(
    () =>
      new Promise<void>((resolve) => {
        closeResolversRef.current.push(resolve);
        setTimeout(resolve, POPOVER_CLOSE_FALLBACK_MS);
        closePopover?.();
      }),
    [closePopover],
  );
  const requestClose = useCallback(() => {
    void handleClosePopover();
  }, [handleClosePopover]);

  const [sheetHeaderHeight, setSheetHeaderHeight] = useState(0);
  const handleSheetHeaderLayout = useCallback((event: LayoutChangeEvent) => {
    setSheetHeaderHeight(Math.ceil(event.nativeEvent.layout.height));
  }, []);
  const isFitSheet =
    !sheetProps?.snapPointsMode || sheetProps.snapPointsMode === 'fit';
  const sheetScrollViewMaxHeight = isFitSheet
    ? Math.max(
        0,
        Math.floor(viewportHeight * FIT_SHEET_MAX_HEIGHT_RATIO) -
          sheetHeaderHeight -
          (bottom || SHEET_BOTTOM_MARGIN),
      )
    : undefined;

  const reposition = useAnchoredPosition({
    open: isOpen && !isSheet,
    triggerRef,
    panel,
    placement: placement as Placement,
    offset,
    allowFlip,
  });
  useOutsidePress({
    enabled: isOpen && !isSheet && !hoverable,
    panelRef,
    triggerRef,
    onOutsidePress: requestClose,
  });
  useHoverOpen({
    hoverable: isSheet ? undefined : (hoverable as IPopoverHoverable),
    triggerRef,
    panel,
    open: isOpen,
    onOpen: openPopover ?? noop,
    onClose: requestClose,
  });

  const RenderContent =
    typeof renderContent === 'function' ? renderContent : null;
  const popoverContextValue = useMemo(
    () => ({ open: isOpen, closePopover: handleClosePopover }),
    [handleClosePopover, isOpen],
  );
  const content = (
    <PopoverContext.Provider value={popoverContextValue}>
      {RenderContent
        ? ((
            <RenderContent isOpen={isOpen} closePopover={handleClosePopover} />
          ) as ReactElement)
        : (renderContent as ReactElement)}
    </PopoverContext.Provider>
  );

  const sheetBackdrop = useMemo<IOverlayBackdrop>(
    () => ({
      color: String(theme.bgBackdrop.val),
      dismissOnPress: sheetProps?.dismissOnOverlayPress ?? true,
    }),
    [sheetProps?.dismissOnOverlayPress, theme.bgBackdrop.val],
  );
  const sheetOptions = useMemo<IOverlaySheetOptions>(
    () => ({
      cornerRadius: 0,
      showHandle: false,
      backgroundColor: 'transparent',
      dismissOnPanDown:
        !sheetProps?.disableDrag && (sheetProps?.dismissOnSnapToBottom ?? true),
    }),
    [sheetProps?.disableDrag, sheetProps?.dismissOnSnapToBottom],
  );
  const {
    zIndex: _panelZIndex,
    onOpenAutoFocus: _openFocus,
    onCloseAutoFocus: _closeFocus,
    trapFocus: _trapFocus,
    ...panelProps
  } = (floatingPanelProps ?? {}) as NonNullable<
    IPopoverProps['floatingPanelProps']
  > & { trapFocus?: boolean };

  const handleTriggerPress = useCallback(() => {
    if (isOpen) {
      requestClose();
    } else {
      openPopover?.();
    }
  }, [isOpen, openPopover, requestClose]);

  return (
    <>
      {renderTrigger ? (
        // testID is carried by renderTrigger from the caller.
        // oxlint-disable-next-line onekey/require-testid
        <Trigger ref={triggerRef} onPress={handleTriggerPress}>
          {renderTrigger}
        </Trigger>
      ) : null}
      {isSheet ? (
        <OverlayView
          visible={isOpen}
          level="modal"
          presentation="sheet"
          sheet={sheetOptions}
          backdrop={sheetBackdrop}
          dismissOnBackPress
          keepContentMounted={keepChildrenMounted}
          onRequestDismiss={requestClose}
          onClose={flushCloseResolvers}
        >
          <YStack>
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
                  onPress={requestClose}
                  testID="popover-btn-close"
                />
              </XStack>
            ) : null}
            <ScrollView
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
              borderCurve="continuous"
            >
              {content}
            </ScrollView>
          </YStack>
        </OverlayView>
      ) : (
        <OverlayView
          visible={isOpen}
          level="modal"
          presentation="anchored"
          // Non-modal like the Tamagui popover: focus and typing stay where
          // they are; an outside press or Escape closes it.
          blocking={false}
          backdrop={false}
          dismissOnBackPress={!hoverable}
          keepContentMounted={keepChildrenMounted}
          onRequestDismiss={requestClose}
          onPresented={reposition}
          onClose={flushCloseResolvers}
        >
          <div ref={handlePanelRef} style={ANCHORED_PANEL_STYLE}>
            <YStack
              testID="popover-panel"
              w="$96"
              bg="$bg"
              borderRadius="$3"
              maxHeight="100%"
              overflow="hidden"
              outlineColor="$neutral3"
              outlineStyle="solid"
              outlineWidth="$px"
              style={POPOVER_PANEL_WEB_STYLE}
              {...panelProps}
            >
              <ScrollView testID="TMPopover-ScrollView" flexShrink={1}>
                {content}
              </ScrollView>
            </YStack>
          </div>
        </OverlayView>
      )}
    </>
  );
}

function BasicPopover({
  open,
  onOpenChange: onOpenChangeFunc,
  trackID,
  ...rest
}: IPopoverProps) {
  const { isOpen, openPopover, closePopover } = usePopoverValue(
    open,
    onOpenChangeFunc,
    trackID,
  );
  // The overlay renders in the native-overlay layers, so the popover stays
  // in the caller's tree (and its contexts) without a portal.
  return (
    <RawPopover
      open={isOpen}
      openPopover={openPopover}
      closePopover={closePopover}
      trackID={trackID}
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
  Tooltip,
});

export * from './type';
export { usePopoverContext };
