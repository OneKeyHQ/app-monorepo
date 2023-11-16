import type { ForwardedRef, PropsWithChildren } from 'react';
import {
  Children,
  cloneElement,
  createRef,
  forwardRef,
  isValidElement,
  useCallback,
  useContext,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Sheet,
  Dialog as TMDialog,
  composeEventHandlers,
  useMedia,
  withStaticProperties,
} from 'tamagui';

import { Button } from '../Button';
import useKeyboardHeight from '../hooks/useKeyboardHeight';
import { Icon } from '../Icon';
import { IconButton } from '../IconButton';
import { Portal } from '../Portal';
import { SheetGrabber } from '../SheetGrabber';
import { Stack, XStack, YStack } from '../Stack';
import { Text } from '../Text';

import { DialogContext } from './context';

import type { IDialogInstanceRef, IDialogProps } from './type';
import type { IButtonProps } from '../Button';
import type { IPortalManager } from '../Portal';

function Trigger({
  onOpen,
  children,
}: PropsWithChildren<{ onOpen?: () => void }>) {
  if (children) {
    const child = Children.only(children);
    if (isValidElement(child)) {
      const handleOpen = (child.props as IButtonProps).onPress
        ? composeEventHandlers((child.props as IButtonProps).onPress, onOpen)
        : onOpen;
      if (child.type === Button) {
        return cloneElement(child, { onPress: handleOpen } as IButtonProps);
      }
      return <Stack onPress={handleOpen}>{children}</Stack>;
    }
  }
  return null;
}

function DialogFrame({
  open,
  onClose,
  renderTrigger,
  onOpen,
  title,
  icon,
  description,
  renderContent,
  showFooter = true,
  onConfirm,
  onConfirmText = 'Confirm',
  onCancel,
  onCancelText = 'Cancel',
  tone,
  confirmButtonProps,
  cancelButtonProps,
  dismissOnOverlayPress = true,
  sheetProps,
  contextValue,
}: IDialogProps) {
  const [position, setPosition] = useState(0);
  const handleBackdropPress = useMemo(
    () => (dismissOnOverlayPress ? onClose : undefined),
    [dismissOnOverlayPress, onClose],
  );
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        onClose?.();
      }
    },
    [onClose],
  );

  const { bottom } = useSafeAreaInsets();
  const handleConfirmButtonPress = useCallback(async () => {
    const result = await onConfirm?.();
    if (result || result === undefined) {
      onClose?.();
    }
  }, [onConfirm, onClose]);

  const handleCancelButtonPress = useCallback(() => {
    onCancel?.();
    onClose?.();
  }, [onCancel, onClose]);

  const media = useMedia();
  const keyboardHeight = useKeyboardHeight();
  const content = (
    <Stack {...(bottom && { pb: bottom })}>
      {icon && (
        <Stack
          alignSelf="flex-start"
          p="$3"
          ml="$5"
          mt="$5"
          borderRadius="$full"
          bg={tone === 'destructive' ? '$bgCritical' : '$bgStrong'}
        >
          <Icon
            name={icon}
            size="$8"
            color={tone === 'destructive' ? '$iconCritical' : '$icon'}
          />
        </Stack>
      )}
      <Stack p="$5" pr="$16">
        <Text variant="$headingXl" py="$px">
          {title}
        </Text>
        {description && (
          <Text variant="$bodyLg" pt="$1.5">
            {description}
          </Text>
        )}
      </Stack>
      <IconButton
        position="absolute"
        right="$5"
        top="$5"
        icon="CrossedSmallOutline"
        iconProps={{
          color: '$iconSubdued',
        }}
        size="small"
        onPress={handleCancelButtonPress}
      />

      {renderContent && (
        <YStack px="$5" pb="$5">
          {renderContent}
        </YStack>
      )}
      {showFooter && (
        <XStack p="$5" pt="$0">
          <Button
            flex={1}
            $md={
              {
                size: 'large',
              } as IButtonProps
            }
            {...cancelButtonProps}
            onPress={handleCancelButtonPress}
          >
            {onCancelText}
          </Button>
          <Button
            variant={tone === 'destructive' ? 'destructive' : 'primary'}
            flex={1}
            ml="$2.5"
            $md={
              {
                size: 'large',
              } as IButtonProps
            }
            {...confirmButtonProps}
            onPress={handleConfirmButtonPress}
          >
            {onConfirmText}
          </Button>
        </XStack>
      )}
    </Stack>
  );
  const renderDialogContent = contextValue ? (
    <DialogContext.Provider value={contextValue}>
      {content}
    </DialogContext.Provider>
  ) : (
    content
  );
  if (media.md) {
    return (
      <>
        <Trigger onOpen={onOpen}>{renderTrigger}</Trigger>
        <Sheet
          open={open}
          position={position}
          onPositionChange={setPosition}
          dismissOnSnapToBottom
          dismissOnOverlayPress={dismissOnOverlayPress}
          onOpenChange={handleOpenChange}
          snapPointsMode="fit"
          animation="quick"
          {...sheetProps}
        >
          <Sheet.Overlay
            animation="quick"
            enterStyle={{ opacity: 0 }}
            exitStyle={{ opacity: 0 }}
            backgroundColor="$bgBackdrop"
          />
          <Sheet.Frame
            unstyled
            borderTopLeftRadius="$6"
            borderTopRightRadius="$6"
            bg="$bg"
            paddingBottom={keyboardHeight}
          >
            <SheetGrabber />
            {renderDialogContent}
          </Sheet.Frame>
        </Sheet>
      </>
    );
  }

  return (
    <TMDialog modal open={open}>
      <TMDialog.Trigger onPress={onOpen} asChild>
        {renderTrigger}
      </TMDialog.Trigger>
      <TMDialog.Portal>
        <TMDialog.Overlay
          key="overlay"
          animation="quick"
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
          backgroundColor="$bgBackdrop"
          onPress={handleBackdropPress}
        />
        <TMDialog.Content
          elevate
          key="content"
          animateOnly={['transform', 'opacity']}
          animation={[
            'quick',
            {
              opacity: {
                overshootClamping: true,
              },
            },
          ]}
          enterStyle={{ opacity: 0, scale: 0.95 }}
          exitStyle={{ opacity: 0, scale: 0.95 }}
          borderRadius="$4"
          borderWidth="$0"
          outlineColor="$borderSubdued"
          outlineStyle="solid"
          outlineWidth="$px"
          bg="$bg"
          width={400}
          p="$0"
        >
          {renderDialogContent}
        </TMDialog.Content>
      </TMDialog.Portal>
    </TMDialog>
  );
}

type IDialogContainerProps = PropsWithChildren<
  Omit<IDialogProps, 'onConfirm'> & {
    onConfirm?: () => void | Promise<boolean>;
  }
>;

function BaseDialogContainer(
  {
    onOpen,
    onClose,
    renderContent,
    onConfirm,
    ...props
  }: IDialogContainerProps,
  ref: ForwardedRef<IDialogInstanceRef>,
) {
  const [isOpen, changeIsOpen] = useState(true);
  const handleClose = useCallback(() => {
    changeIsOpen(false);
    onClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  const contextValue = useMemo(
    () => ({
      dialogInstance: {
        close: handleClose,
      },
    }),
    [handleClose],
  );

  const handleOpen = useCallback(() => {
    changeIsOpen(true);
    onOpen?.();
  }, [onOpen]);

  const handleConfirm = useCallback(() => onConfirm?.(), [onConfirm]);

  useImperativeHandle(
    ref,
    () => ({
      close: handleClose,
    }),
    [handleClose],
  );
  return (
    <DialogContext.Provider value={contextValue}>
      <DialogFrame
        contextValue={contextValue}
        open={isOpen}
        onOpen={handleOpen}
        renderContent={renderContent}
        onClose={handleClose}
        {...props}
        onConfirm={handleConfirm}
      />
    </DialogContext.Provider>
  );
}

const DialogContainer = forwardRef<IDialogInstanceRef, IDialogContainerProps>(
  BaseDialogContainer,
);

function DialogConfirm({
  onClose,
  ...props
}: Omit<IDialogContainerProps, 'name'>): IDialogInstanceRef {
  let instanceRef: React.RefObject<IDialogInstanceRef> | undefined =
    createRef<IDialogInstanceRef>();
  let portalRef:
    | {
        current: IPortalManager;
      }
    | undefined;
  const handleClose = () => {
    onClose?.();
    // Remove the React node after the animation has finished.
    setTimeout(() => {
      if (instanceRef) {
        instanceRef = undefined;
      }
      if (portalRef) {
        portalRef.current.destroy();
        portalRef = undefined;
      }
    }, 300);
  };
  portalRef = {
    current: Portal.Render(
      Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL,
      <DialogContainer ref={instanceRef} {...props} onClose={handleClose} />,
    ),
  };
  return {
    close: handleClose,
  };
}

export const useDialogInstance = () => {
  const { dialogInstance } = useContext(DialogContext);
  return dialogInstance;
};

export const Dialog = withStaticProperties(DialogFrame, {
  confirm: DialogConfirm,
});
