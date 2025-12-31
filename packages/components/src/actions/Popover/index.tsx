import type {
  ComponentType,
  PropsWithChildren,
  ReactElement,
  ReactNode,
} from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Dimensions } from 'react-native';

import { useMedia } from '@onekeyhq/components/src/hooks/useStyle';
import {
  TMPopover,
  withStaticProperties,
} from '@onekeyhq/components/src/shared/tamagui';
import type {
  PopoverContentProps as PopoverContentTypeProps,
  SheetProps,
  TMPopoverProps,
  UseMediaState,
} from '@onekeyhq/components/src/shared/tamagui';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { FIX_SHEET_PROPS } from '../../composite/Dialog';
import { Keyboard } from '../../content';
import { Portal } from '../../hocs';
import {
  ModalNavigatorContext,
  useBackHandler,
  useKeyboardHeight,
  useModalNavigatorContext,
  useOverlayZIndex,
  useSafeAreaInsets,
} from '../../hooks';
import { PageContext, usePageContext } from '../../layouts/Page/PageContext';
import { SizableText, Stack, XStack, YStack } from '../../primitives';
import { NATIVE_HIT_SLOP } from '../../utils/getFontSize';
import { IconButton } from '../IconButton';
import { Trigger } from '../Trigger';

import { PopoverContent } from './PopoverContent';

import type { IPopoverTooltip } from './type';
import type { IIconButtonProps } from '../IconButton';
import type { View } from 'react-native';

const gtMdShFrameStyle = {
  minWidth: 400,
  maxWidth: 480,
  mx: 'auto',
} as const;
export interface IPopoverProps extends TMPopoverProps {
  title: string | ReactElement;
  showHeader?: boolean;
  usingSheet?: boolean;
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
   * Unique identifier for tracking/analytics purposes.
   */
  trackID?: string;
}

interface IPopoverContext {
  open?: boolean;
  closePopover?: () => Promise<void>;
}

const PopoverContext = createContext({} as IPopoverContext);

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

    if (trackID) {
      defaultLogger.ui.popover.popoverOpen({
        trackId: trackID,
      });
    }
    void Keyboard.dismissWithDelay(50);
  }, [isControlled, onOpenChange, trackID]);

  const closePopover = useCallback(() => {
    if (isControlled) {
      onOpenChange?.(false);
    } else {
      setIsOpen(false);
      onOpenChange?.(false);
    }

    if (trackID) {
      defaultLogger.ui.popover.popoverClose({
        trackId: trackID,
      });
    }
    void Keyboard.dismissWithDelay(50);
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

const useContentDisplay = platformEnv.isNative
  ? () => undefined
  : (isOpen?: boolean, keepChildrenMounted?: boolean) => {
      const [display, setDisplay] = useState<'none' | undefined>(undefined);
      useEffect(() => {
        if (!keepChildrenMounted) {
          return;
        }
        if (isOpen) {
          setDisplay(undefined);
        } else {
          setTimeout(() => {
            setDisplay('none');
          }, 250);
        }
      }, [isOpen, keepChildrenMounted]);
      return display;
    };

export const usePopoverContext = () => {
  const { closePopover, open } = useContext(PopoverContext);
  return {
    open,
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

const when: (state: { media: UseMediaState }) => boolean = () => true;

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
) => {
  if (platformEnv.isNative) {
    return placementProp || 'bottom-end';
  }
  if (placementProp) {
    return placementProp;
  }
  const element = triggerRef.current as unknown as HTMLElement;
  if (element) {
    const { top } = element.getBoundingClientRect();
    if (top > Dimensions.get('window').height / 2) {
      return 'top-end';
    }
    return 'bottom-end';
  }
  return 'bottom-end';
};

function RawPopover({
  title,
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
  ...props
}: IPopoverProps) {
  const { bottom } = useSafeAreaInsets();
  const triggerRef = useRef<View | null>(null);
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
    if (!isOpen) {
      return false;
    }
    void handleClosePopover();
    return true;
  }, [handleClosePopover, isOpen]);

  useDismissKeyboard(isOpen);

  useBackHandler(handleBackPress);

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
  const { gtMd } = useMedia();

  const display = useContentDisplay(isOpen, props.keepChildrenMounted);
  const keyboardHeight = useKeyboardHeight();
  const zIndex = useOverlayZIndex(isOpen);
  const content = (
    <ModalPortalProvider>
      <PopoverContext.Provider value={popoverContextValue}>
        <PopoverContent
          isOpen={isOpen}
          closePopover={handleClosePopover}
          keepChildrenMounted={props.keepChildrenMounted}
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

  const isShowNativeKeepChildrenMountedBackdrop =
    platformEnv.isNative && props.keepChildrenMounted;
  const maxScrollViewHeight = getMaxScrollViewHeight();
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
        <Trigger ref={triggerRef} onPress={openPopover}>
          {renderTrigger}
        </Trigger>
      </TMPopover.Trigger>
      {/* floating panel */}
      {platformEnv.isNative ? null : (
        <TMPopover.Content
          unstyled
          display={display}
          style={{
            transformOrigin,
          }}
          enterStyle={{
            scale: 0.95,
            opacity: 0,
          }}
          exitStyle={{ scale: 0.95, opacity: 0 }}
          w="$96"
          bg="$bg"
          borderRadius="$3"
          $platform-web={{
            outlineColor: '$neutral3',
            outlineStyle: 'solid',
            outlineWidth: '$px',
            boxShadow:
              '0 4px 6px -4px rgba(0, 0, 0, 0.10), 0 10px 15px -3px rgba(0, 0, 0, 0.10)',
          }}
          $platform-native={{
            elevation: 20,
          }}
          animation={[
            'quick',
            {
              opacity: {
                overshootClamping: true,
              },
            },
          ]}
          {...floatingPanelProps}
        >
          <TMPopover.ScrollView
            testID="TMPopover-ScrollView"
            style={{ maxHeight: maxScrollViewHeight }}
          >
            {content}
          </TMPopover.ScrollView>
        </TMPopover.Content>
      )}
      {/* sheet */}
      {usingSheet ? (
        <>
          {/* TODO: Temporary solution for overlay backdrop. 
               This should be deprecated in favor of Tamagui's overlay implementation */}
          {isShowNativeKeepChildrenMountedBackdrop ? (
            <Stack
              position="absolute"
              pointerEvents={isOpen ? 'auto' : 'none'}
              onPress={isOpen ? closePopover : undefined}
              bg={isOpen ? '$bgBackdrop' : 'transparent'}
              top={0}
              left={0}
              right={0}
              bottom={0}
            />
          ) : null}

          <TMPopover.Adapt when={platformEnv.isNative ? when : 'md'}>
            <TMPopover.Sheet
              dismissOnSnapToBottom
              animation="quick"
              snapPointsMode="fit"
              zIndex={zIndex}
              {...sheetProps}
            >
              {isShowNativeKeepChildrenMountedBackdrop ? null : (
                <TMPopover.Sheet.Overlay
                  {...FIX_SHEET_PROPS}
                  zIndex={sheetProps?.zIndex || zIndex}
                  backgroundColor="$bgBackdrop"
                  animation="quick"
                  enterStyle={{ opacity: 0 }}
                  exitStyle={{ opacity: 0 }}
                />
              )}
              <TMPopover.Sheet.Frame
                unstyled
                paddingBottom={keyboardHeight}
                {...(gtMd || platformEnv.isNativeIOSPad
                  ? gtMdShFrameStyle
                  : undefined)}
              >
                {/* header */}
                {showHeader ? (
                  <XStack
                    borderTopLeftRadius="$6"
                    borderTopRightRadius="$6"
                    backgroundColor="$bg"
                    mx="$5"
                    p="$5"
                    justifyContent="space-between"
                    alignItems="center"
                    borderCurve="continuous"
                    gap="$2"
                  >
                    {typeof title === 'string' ? (
                      <SizableText
                        size="$headingXl"
                        color="$text"
                        flexShrink={1}
                        style={{
                          wordBreak: 'break-all',
                        }}
                      >
                        {title}
                      </SizableText>
                    ) : (
                      title
                    )}
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
  ...rest
}: IPopoverProps) {
  const { isOpen, onOpenChange, openPopover, closePopover } = usePopoverValue(
    open,
    onOpenChangeFunc,
    trackID,
  );
  const { md } = useMedia();
  const memoPopover = useMemo(
    () => (
      <RawPopover
        open={isOpen}
        onOpenChange={onOpenChange}
        openPopover={openPopover}
        closePopover={closePopover}
        renderTrigger={undefined}
        keepChildrenMounted={keepChildrenMounted}
        {...rest}
        sheetProps={sheetProps}
      />
    ),
    [
      closePopover,
      isOpen,
      keepChildrenMounted,
      onOpenChange,
      openPopover,
      rest,
      sheetProps,
    ],
  );
  const modalNavigatorContext = useModalNavigatorContext();
  const pageContextValue = usePageContext();

  if (platformEnv.isNative) {
    // on native and ipad, we add the popover to the RNScreen.FULL_WINDOW_OVERLAY
    return (
      <>
        {renderTrigger ? (
          <Trigger onPress={openPopover}>{renderTrigger}</Trigger>
        ) : null}
        {isOpen || keepChildrenMounted ? (
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
      //  the sheet needs to use the onOpenChange function to close the popover
      onOpenChange={md ? onOpenChange : undefined}
      openPopover={openPopover}
      closePopover={closePopover}
      sheetProps={{ ...sheetProps, modal: true }}
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
  return (
    <BasicPopover
      placement={placement}
      title={title}
      renderTrigger={
        <IconButton
          iconColor="$iconSubdued"
          iconSize={iconSize}
          icon="InfoCircleOutline"
          variant="tertiary"
          {...triggerProps}
        />
      }
      renderContent={
        renderContent || (
          <YStack p="$5">
            <SizableText size="$bodyLg">{tooltip}</SizableText>
          </YStack>
        )
      }
    />
  );
}

export const Popover = withStaticProperties(BasicPopover, {
  Close: TMPopover.Close,
  Tooltip,
});

export * from './type';
