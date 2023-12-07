import type { ForwardedRef, PropsWithChildren } from 'react';
import {
  createRef,
  forwardRef,
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
  useMedia,
  withStaticProperties,
} from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { SheetGrabber } from '../../content';
import { Portal } from '../../hocs';
import { useKeyboardHeight } from '../../hooks';
import { Icon, Stack, Text, XStack } from '../../primitives';
import { Button } from '../../primitives/Button';
import { IconButton } from '../IconButton';
import { Trigger } from '../Trigger';

import { Content } from './Content';
import { DialogContext } from './context';

import type { IDialogInstanceRef, IDialogProps } from './type';
import type { IPortalManager } from '../../hocs';
import type { IButtonProps } from '../../primitives/Button';

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
  estimatedContentHeight,
  logContentHeight,
  dismissOnOverlayPress = true,
  sheetProps,
  contextValue,
  disableDrag = false,
  testID,
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

      <Content
        testID={testID}
        estimatedContentHeight={estimatedContentHeight}
        logContentHeight={logContentHeight}
      >
        {renderContent}
      </Content>
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
          {onConfirm ? (
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
          ) : null}
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
        <Trigger onPress={onOpen}>{renderTrigger}</Trigger>
        <Sheet
          disableDrag={disableDrag}
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
            testID={testID}
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
        {
          /* fix missing title warnings in html dialog element on Web */
          platformEnv.isRuntimeBrowser ? (
            <TMDialog.Title display="none">{title}</TMDialog.Title>
          ) : null
        }
        <TMDialog.Content
          elevate
          key="content"
          testID={testID}
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
  { onOpen, onClose, renderContent, ...props }: IDialogContainerProps,
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
    close: () => instanceRef?.current?.close(),
  };
}

export const useDialogInstance = () => {
  const { dialogInstance } = useContext(DialogContext);
  return dialogInstance;
};

export const Dialog = withStaticProperties(DialogFrame, {
  confirm: DialogConfirm,
});
