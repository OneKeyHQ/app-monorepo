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
import { Footer, FooterAction } from './Footer';

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
import type { ColorTokens } from 'tamagui';

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
  floatingPanelProps,
  disableDrag = false,
  showConfirmButton = true,
  showCancelButton = true,
  testID,
}: IDialogProps) {
  const { footerRef } = useContext(DialogContext);
  const [position, setPosition] = useState(0);
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

  const handleCancelButtonPress = useCallback(() => {
    const cancel = onCancel || footerRef.props?.onCancel;
    cancel?.();
    void onClose();
  }, [footerRef.props?.onCancel, onCancel, onClose]);

  const getColors = (): {
    iconWrapperBg: ColorTokens;
    iconColor: ColorTokens;
  } => {
    if (tone === 'destructive') {
      return {
        iconWrapperBg: '$bgCritical',
        iconColor: '$iconCritical',
      };
    }
    if (tone === 'warning') {
      return {
        iconWrapperBg: '$bgCaution',
        iconColor: '$iconCaution',
      };
    }

    return {
      iconWrapperBg: '$bgStrong',
      iconColor: '$icon',
    };
  };

  const media = useMedia();
  const keyboardHeight = useKeyboardHeight();
  const renderDialogContent = (
    <Stack {...(bottom && { pb: bottom })}>
      {/* leading icon */}
      {icon && (
        <Stack
          alignSelf="flex-start"
          p="$3"
          ml="$5"
          mt="$5"
          borderRadius="$full"
          bg={getColors().iconWrapperBg}
        >
          <Icon name={icon} size="$8" color={getColors().iconColor} />
        </Stack>
      )}

      {/* title and description */}
      {(title || description) && (
        <Stack p="$5" pr="$16">
          {title && (
            <Text variant="$headingXl" py="$px">
              {title}
            </Text>
          )}
          {description && (
            <Text variant="$bodyLg" pt="$1.5">
              {description}
            </Text>
          )}
        </Stack>
      )}

      {/* close button */}
      <IconButton
        position="absolute"
        zIndex={1}
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
        onConfirm={onConfirm}
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
          style={{
            borderCurve: 'continuous',
          }}
        >
          {!disableDrag && <SheetGrabber />}
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
              animateOnly={['opacity']}
              animation="quick"
              enterStyle={{
                opacity: 0,
              }}
              exitStyle={{
                opacity: 0,
              }}
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
              {...floatingPanelProps}
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
      footerRef: {
        notifyUpdate: undefined,
        props: undefined,
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
  Footer: FooterAction,
};

export * from './hooks';

export type {
  IDialogShowProps,
  IDialogConfirmProps,
  IDialogCancelProps,
  IDialogInstance,
} from './type';
