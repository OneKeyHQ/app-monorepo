import type { ComponentType, ReactElement, ReactNode } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import { InteractionManager } from 'react-native';
import { Popover as TMPopover } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { FIX_SHEET_PROPS } from '../../composite';
import { Divider } from '../../content';
import { Portal } from '../../hocs';
import { useBackHandler, useSafeAreaInsets } from '../../hooks';
import { SizableText, XStack, YStack } from '../../primitives';
import { IconButton } from '../IconButton';
import { Trigger } from '../Trigger';

import type {
  PopoverContentTypeProps,
  SheetProps,
  PopoverProps as TMPopoverProps,
} from 'tamagui';

export interface IPopoverProps extends TMPopoverProps {
  title: string;
  usingSheet?: boolean;
  renderTrigger: ReactNode;
  renderContent:
    | ReactElement
    | ComponentType<{ isOpen?: boolean; closePopover: () => void }>;
  floatingPanelProps?: PopoverContentTypeProps;
  sheetProps?: SheetProps;
}

interface IPopoverContext {
  closePopover?: () => Promise<void>;
}

const PopoverContext = createContext({} as IPopoverContext);

const usePopoverValue = (
  open?: boolean,
  onOpenChange?: IPopoverProps['onOpenChange'],
) => {
  const [isOpen, setIsOpen] = useState(false);
  const isControlled = typeof open !== 'undefined';
  const openPopover = useCallback(() => {
    console.log('openPopover');
    if (isControlled) {
      onOpenChange?.(true);
    } else {
      setIsOpen(true);
    }
  }, [isControlled, onOpenChange]);
  const closePopover = useCallback(() => {
    if (isControlled) {
      onOpenChange?.(false);
    } else {
      setIsOpen(false);
    }
  }, [isControlled, onOpenChange]);
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

export const usePopoverContext = () => {
  const { closePopover } = useContext(PopoverContext);
  return {
    closePopover,
  };
};

function RawPopover({
  title,
  open: isOpen,
  renderTrigger,
  renderContent,
  floatingPanelProps,
  sheetProps,
  onOpenChange,
  usingSheet = true,
  ...props
}: IPopoverProps) {
  const { bottom } = useSafeAreaInsets();
  let transformOrigin;

  switch (props.placement) {
    case 'top':
      transformOrigin = 'bottom center';
      break;
    case 'bottom':
      transformOrigin = 'top center';
      break;
    case 'left':
      transformOrigin = 'right center';
      break;
    case 'right':
      transformOrigin = 'left center';
      break;
    case 'top-start':
      transformOrigin = 'bottom left';
      break;
    case 'top-end':
      transformOrigin = 'bottom right';
      break;
    case 'right-start':
      transformOrigin = 'top left';
      break;
    case 'bottom-start':
      transformOrigin = 'top left';
      break;
    case 'left-start':
      transformOrigin = 'top right';
      break;
    case 'left-end':
      transformOrigin = 'bottom right';
      break;
    default:
      transformOrigin = 'top right';
  }

  const closePopover = useCallback(
    () =>
      new Promise<void>((resolve) => {
        onOpenChange?.(false);
        setTimeout(
          () => {
            resolve();
          },
          // Need to execute the callback after the sheet animation ends on the Native side
          platformEnv.isNative ? 300 : 0,
        );
      }),
    [onOpenChange],
  );

  const openPopover = useCallback(() => {
    onOpenChange?.(true);
  }, [onOpenChange]);

  const handleBackPress = useCallback(() => {
    if (!isOpen) {
      return false;
    }
    void closePopover();
    return true;
  }, [closePopover, isOpen]);

  useBackHandler(handleBackPress);

  const RenderContent =
    typeof renderContent === 'function' ? renderContent : null;
  const popoverContextValue = useMemo(
    () => ({
      closePopover,
    }),
    [closePopover],
  );
  const content = (
    <PopoverContext.Provider value={popoverContextValue}>
      {RenderContent
        ? ((
            <RenderContent isOpen={isOpen} closePopover={closePopover} />
          ) as ReactElement)
        : (renderContent as ReactElement)}
    </PopoverContext.Provider>
  );
  return (
    <TMPopover
      offset={8}
      allowFlip
      placement="bottom-end"
      onOpenChange={onOpenChange}
      open={isOpen}
      {...props}
    >
      <TMPopover.Trigger asChild>
        <Trigger onPress={openPopover}>{renderTrigger}</Trigger>
      </TMPopover.Trigger>

      {/* floating panel */}
      <TMPopover.Content
        unstyled
        outlineColor="$neutral3"
        outlineStyle="solid"
        outlineWidth="$px"
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
        elevation={20}
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
        <TMPopover.ScrollView>{content}</TMPopover.ScrollView>
      </TMPopover.Content>

      {/* sheet */}
      {usingSheet && (
        <TMPopover.Adapt when="md">
          <TMPopover.Sheet
            dismissOnSnapToBottom
            animation="quick"
            snapPointsMode="fit"
            {...sheetProps}
          >
            <TMPopover.Sheet.Overlay
              {...FIX_SHEET_PROPS}
              backgroundColor="$bgBackdrop"
              animation="quick"
              enterStyle={{ opacity: 0 }}
              exitStyle={{ opacity: 0 }}
            />
            <TMPopover.Sheet.Frame unstyled>
              {/* header */}
              <XStack
                borderTopLeftRadius="$6"
                borderTopRightRadius="$6"
                backgroundColor="$bg"
                marginHorizontal="$5"
                paddingHorizontal="$5"
                paddingVertical="$4"
                justifyContent="space-between"
                alignItems="center"
                style={{
                  borderCurve: 'continuous',
                }}
              >
                <SizableText size="$headingXl" color="$text">
                  {title}
                </SizableText>
                <IconButton
                  icon="CrossedSmallOutline"
                  size="small"
                  $platform-native={{
                    hitSlop: { top: 8, left: 8, right: 8, bottom: 8 },
                  }}
                  onPress={closePopover}
                  testID="popover-btn-close"
                />
              </XStack>

              {/* divider */}
              <YStack
                backgroundColor="$bg"
                marginHorizontal="$5"
                paddingHorizontal="$5"
              >
                <Divider />
              </YStack>

              <TMPopover.Sheet.ScrollView
                borderBottomLeftRadius="$6"
                borderBottomRightRadius="$6"
                backgroundColor="$bg"
                showsVerticalScrollIndicator={false}
                marginHorizontal="$5"
                marginBottom={bottom || '$5'}
                style={{
                  borderCurve: 'continuous',
                }}
              >
                <TMPopover.Adapt.Contents />
              </TMPopover.Sheet.ScrollView>
            </TMPopover.Sheet.Frame>
          </TMPopover.Sheet>
        </TMPopover.Adapt>
      )}
    </TMPopover>
  );
}

const Popover = ({
  open,
  onOpenChange: onOpenChangeFunc,
  renderTrigger,
  sheetProps,
  ...rest
}: IPopoverProps) => {
  const { isOpen, onOpenChange, openPopover } = usePopoverValue(
    open,
    onOpenChangeFunc,
  );
  // on web and WAP, we add the popover to the RNRootView
  if (platformEnv.isRuntimeBrowser) {
    return (
      <RawPopover
        open={isOpen}
        onOpenChange={onOpenChange}
        sheetProps={{ ...sheetProps, modal: true }}
        renderTrigger={renderTrigger}
        {...rest}
      />
    );
  }
  // on native and ipad, we add the popover to the RNScreen.FULL_WINDOW_OVERLAY
  return (
    <>
      <Trigger onPress={openPopover}>{renderTrigger}</Trigger>
      <Portal.Body container={Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL}>
        <RawPopover
          open={isOpen}
          onOpenChange={onOpenChange}
          renderTrigger={undefined}
          {...rest}
          sheetProps={sheetProps}
        />
      </Portal.Body>
    </>
  );
};

Popover.Close = TMPopover.Close;

export { Popover };
