import type { ForwardedRef } from 'react';
import {
  createRef,
  forwardRef,
  useCallback,
  useContext,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatePresence, Sheet, Dialog as TMDialog, useMedia } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { IconButton } from '../../actions/IconButton';
import { SheetGrabber } from '../../content';
import { Form } from '../../forms/Form';
import { Portal } from '../../hocs';
import { useKeyboardHeight } from '../../hooks';
import { Icon, Stack, Text } from '../../primitives';

import { Content } from './Content';
import { DialogContext } from './context';
import { DialogForm } from './DialogForm';
import { Footer } from './Footer';

import type {
  IDialogCancelProps,
  IDialogConfirmProps,
  IDialogContainerProps,
  IDialogInstance,
  IDialogProps,
  IDialogShowProps,
} from './type';
import type { IPortalManager } from '../../hocs';
import type { IStackProps } from '../../primitives';

// Fix the issue of the overlay layer in tamagui being too low
export const FIX_SHEET_PROPS: IStackProps = {
  zIndex: 100001,
  display: 'block',
};

function DialogFrame({
  open,
  onClose,
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
  dismissOnOverlayPress = true,
  sheetProps,
  disableDrag = false,
  showConfirmButton = true,
  showCancelButton = true,
  testID,
}: IDialogProps) {
  const [position, setPosition] = useState(0);
  const { dialogInstance } = useContext(DialogContext);
  const handleBackdropPress = useMemo(
    () => (dismissOnOverlayPress ? onClose : undefined),
    [dismissOnOverlayPress, onClose],
  );
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        void onClose();
      }
    },
    [onClose],
  );

  const { bottom } = useSafeAreaInsets();
  const handleConfirmButtonPress = useCallback(async () => {
    const form = dialogInstance.ref.current;
    if (form) {
      const isValidated = await form.trigger();
      if (!isValidated) {
        return;
      }
    }
    const result = await onConfirm?.({
      close: dialogInstance.close,
      getForm: () => dialogInstance.ref.current,
    });
    if (result || result === undefined) {
      void onClose();
    }
  }, [onConfirm, dialogInstance, onClose]);

  const handleCancelButtonPress = useCallback(() => {
    onCancel?.();
    void onClose();
  }, [onCancel, onClose]);

  const media = useMedia();
  const keyboardHeight = useKeyboardHeight();
  const renderDialogContent = (
    <Stack {...(bottom && { pb: bottom })}>
      {/* illustration */}

      {/* leading icon */}
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

      {/* title and description */}
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

      {/* close button */}
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

      {/* extra children */}
      <Content testID={testID} estimatedContentHeight={estimatedContentHeight}>
        {renderContent}
      </Content>
      <Footer
        tone={tone}
        showFooter={showFooter}
        showCancelButton={showCancelButton}
        showConfirmButton={showConfirmButton}
        cancelButtonProps={cancelButtonProps}
        onConfirm={handleConfirmButtonPress}
        onCancel={handleCancelButtonPress}
        onConfirmText={onConfirmText}
        confirmButtonProps={confirmButtonProps}
        onCancelText={onCancelText}
      />
    </Stack>
  );

  if (media.md) {
    return (
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
          {...FIX_SHEET_PROPS}
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
    );
  }

  return (
    <TMDialog open={open}>
      <AnimatePresence>
        {open ? (
          <Stack
            position={'fixed' as unknown as any}
            top={0}
            left={0}
            right={0}
            bottom={0}
            alignItems="center"
            justifyContent="center"
          >
            <TMDialog.Overlay
              key="overlay"
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
              enterStyle={{ opacity: 0, scale: 0.85 }}
              exitStyle={{ opacity: 0, scale: 0.85 }}
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
          </Stack>
        ) : null}
      </AnimatePresence>
    </TMDialog>
  );
}

function BaseDialogContainer(
  { onOpen, onClose, renderContent, ...props }: IDialogContainerProps,
  ref: ForwardedRef<IDialogInstance>,
) {
  const [isOpen, changeIsOpen] = useState(true);
  const formRef = useRef();
  const handleClose = useCallback(() => {
    changeIsOpen(false);
    return onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  const contextValue = useMemo(
    () => ({
      dialogInstance: {
        close: handleClose,
        ref: formRef,
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
      getForm: () => formRef.current,
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

const DialogContainer = forwardRef<IDialogInstance, IDialogContainerProps>(
  BaseDialogContainer,
);

function DialogShow({
  onClose,
  onDismiss,
  ...props
}: IDialogShowProps): IDialogInstance {
  let instanceRef: React.RefObject<IDialogInstance> | undefined =
    createRef<IDialogInstance>();
  let portalRef:
    | {
        current: IPortalManager;
      }
    | undefined;
  const handleClose = () =>
    new Promise<void>((resolve) => {
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
        onDismiss?.();
        resolve();
      }, 300);
    });
  portalRef = {
    current: Portal.Render(
      Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL,
      <DialogContainer ref={instanceRef} {...props} onClose={handleClose} />,
    ),
  };
  return {
    close: async () => instanceRef?.current?.close(),
    getForm: () => instanceRef?.current?.getForm(),
  };
}

const DialogConfirm = (props: IDialogConfirmProps) =>
  DialogShow({
    ...props,
    showCancelButton: false,
  });

const DialogCancel = (props: IDialogCancelProps) =>
  DialogShow({
    ...props,
    showConfirmButton: false,
  });

export const Dialog = {
  Form: DialogForm,
  FormField: Form.Field,
  show: DialogShow,
  confirm: DialogConfirm,
  cancel: DialogCancel,
};

export * from './hooks';

export type {
  IDialogShowProps,
  IDialogConfirmProps,
  IDialogCancelProps,
  IDialogInstance,
} from './type';
