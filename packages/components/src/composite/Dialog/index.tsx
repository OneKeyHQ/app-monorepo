import type { ForwardedRef } from 'react';
import {
  cloneElement,
  createRef,
  forwardRef,
  useCallback,
  useContext,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { createPortal } from 'react-dom';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatePresence, Sheet, Dialog as TMDialog, useMedia } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { IconButton } from '../../actions/IconButton';
import { SheetGrabber } from '../../content';
import { Form } from '../../forms/Form';
import { Portal } from '../../hocs';
import { useBackHandler, useKeyboardHeight } from '../../hooks';
import { Icon, SizableText, Stack } from '../../primitives';

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

export * from './hooks';
export type {
  IDialogCancelProps,
  IDialogConfirmProps,
  IDialogInstance,
  IDialogShowProps,
} from './type';

export const FIX_SHEET_PROPS: IStackProps = {
  display: 'block',
};

function DialogFrame({
  open,
  onClose,
  title,
  icon,
  modal,
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
  const onBackdropPress = useMemo(
    () => (dismissOnOverlayPress ? onClose : undefined),
    [dismissOnOverlayPress, onClose],
  );
  const handleBackdropPress = useCallback(() => {
    void onBackdropPress?.();
  }, [onBackdropPress]);
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        void onClose();
      }
    },
    [onClose],
  );

  const handleBackPress = useCallback(() => {
    if (!open) {
      return false;
    }
    handleOpenChange(false);
    return true;
  }, [handleOpenChange, open]);

  useBackHandler(handleBackPress);

  const { bottom } = useSafeAreaInsets();

  const handleCancelButtonPress = useCallback(async () => {
    const cancel = onCancel || footerRef.props?.onCancel;
    cancel?.(() => onClose());
    if (!onCancel?.length) {
      await onClose();
    }
  }, [footerRef.props?.onCancel, onCancel, onClose]);

  const getColors = (): {
    iconWrapperBg: ColorTokens;
    iconColor: ColorTokens;
  } => {
    switch (tone) {
      case 'destructive': {
        return {
          iconWrapperBg: '$bgCritical',
          iconColor: '$iconCritical',
        };
      }
      case 'warning': {
        return {
          iconWrapperBg: '$bgCaution',
          iconColor: '$iconCaution',
        };
      }
      case 'success': {
        return {
          iconWrapperBg: '$bgSuccess',
          iconColor: '$iconSuccess',
        };
      }
      default: {
        return {
          iconWrapperBg: '$bgStrong',
          iconColor: '$icon',
        };
      }
    }
  };

  const media = useMedia();
  const keyboardHeight = useKeyboardHeight();
  const renderDialogContent = (
    <Stack {...(bottom && { pb: bottom })}>
      {/* leading icon */}
      {icon ? (
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
      ) : null}

      {/* title and description */}
      {title || description ? (
        <Stack p="$5" pr="$16">
          {title ? (
            <SizableText size="$headingXl" py="$px">
              {title}
            </SizableText>
          ) : null}
          {description ? (
            <SizableText size="$bodyLg" pt="$1.5">
              {description}
            </SizableText>
          ) : null}
        </Stack>
      ) : null}

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
        // the native dismissOnOverlayPress used on native side,
        //  so it needs to assign a value to onOpenChange.
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
          zIndex={sheetProps?.zIndex}
        />
        <Sheet.Frame
          unstyled
          testID={testID}
          borderTopLeftRadius="$6"
          borderTopRightRadius="$6"
          bg="$bg"
          paddingBottom={keyboardHeight}
          borderCurve="continuous"
        >
          {!disableDrag ? <SheetGrabber /> : null}
          {renderDialogContent}
        </Sheet.Frame>
      </Sheet>
    );
  }

  return (
    <TMDialog
      open={open}
      modal={modal}
      // the native dismissOnOverlayPress used on native side,
      //  so it needs to assign a value to onOpenChange.
      onOpenChange={platformEnv.isNative ? handleOpenChange : undefined}
    >
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
            zIndex={floatingPanelProps?.zIndex}
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
              zIndex={floatingPanelProps?.zIndex}
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
  const handleClose = useCallback(
    (extra?: { flag?: string }) => {
      changeIsOpen(false);
      return onClose(extra);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [onClose],
  );

  const handleContainerClose = useCallback(() => handleClose(), [handleClose]);

  const contextValue = useMemo(
    () => ({
      dialogInstance: {
        close: handleContainerClose,
        ref: formRef,
      },
      footerRef: {
        notifyUpdate: undefined,
        props: undefined,
      },
    }),
    [handleContainerClose],
  );

  const handleOpen = useCallback(() => {
    changeIsOpen(true);
    onOpen?.();
  }, [onOpen]);

  const handleImperativeClose = useCallback(
    (extra?: { flag?: string }) => handleClose(extra),
    [handleClose],
  );

  useImperativeHandle(
    ref,
    () => ({
      close: handleImperativeClose,
      getForm: () => formRef.current,
    }),
    [handleImperativeClose],
  );
  return (
    <DialogContext.Provider value={contextValue}>
      <DialogFrame
        contextValue={contextValue}
        open={isOpen}
        onOpen={handleOpen}
        renderContent={renderContent}
        onClose={handleContainerClose}
        {...props}
      />
    </DialogContext.Provider>
  );
}

export const DialogContainer = forwardRef<
  IDialogInstance,
  IDialogContainerProps
>(BaseDialogContainer);

function dialogShow({
  onClose,
  dialogContainer,
  ...props
}: IDialogShowProps & {
  dialogContainer?: (o: {
    ref: React.RefObject<IDialogInstance> | undefined;
  }) => JSX.Element;
}): IDialogInstance {
  let instanceRef: React.RefObject<IDialogInstance> | undefined =
    createRef<IDialogInstance>();

  let portalRef:
    | {
        current: IPortalManager;
      }
    | undefined;

  const buildForwardOnClose =
    (options: {
      onClose?: (extra?: { flag?: string }) => void | Promise<void>;
    }) =>
    (extra?: { flag?: string }) =>
      new Promise<void>((resolve) => {
        // Remove the React node after the animation has finished.
        setTimeout(() => {
          if (instanceRef) {
            instanceRef = undefined;
          }
          if (portalRef) {
            portalRef.current.destroy();
            portalRef = undefined;
          }
          void options.onClose?.(extra);
          resolve();
        }, 300);
      });

  if (platformEnv.isDev) {
    const {
      showFooter = true,
      onCancel,
      onCancelText,
      cancelButtonProps,
      showConfirmButton = true,
      showCancelButton = true,
      onConfirm,
      onConfirmText,
      confirmButtonProps,
    } = props;
    if (
      showFooter === false &&
      (onCancel ||
        onCancelText ||
        cancelButtonProps ||
        onConfirm ||
        onConfirmText ||
        confirmButtonProps)
    ) {
      throw new Error(
        'When showFooter is false, onCancel, onCancelText, cancelButtonProps, onConfirm, onConfirmText, confirmButtonProps cannot assign value',
      );
    }

    if (
      showConfirmButton === false &&
      (onConfirm || onConfirmText || confirmButtonProps)
    ) {
      throw new Error(
        'When showConfirmButton is false, onConfirm, onConfirmText, confirmButtonProps cannot assign value',
      );
    }

    if (
      showCancelButton === false &&
      (onCancel || onCancelText || cancelButtonProps)
    ) {
      throw new Error(
        'When showCancelButton is false, onCancel, onCancelText, cancelButtonProps cannot assign value',
      );
    }
  }

  const element = (() => {
    if (dialogContainer) {
      const e = dialogContainer({ ref: instanceRef });
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      // const newOnClose = buildForwardOnClose({ onClose: e.props.onClose });
      const newOnClose = buildForwardOnClose({ onClose });
      const newProps = {
        ...props,
        ...e.props,
        onClose: newOnClose,
      };
      return cloneElement(e, newProps);
    }
    return (
      <DialogContainer
        ref={instanceRef}
        {...props}
        onClose={buildForwardOnClose({ onClose })}
      />
    );
  })();

  // fix modal attributes is invalid in Tamagui
  let renderElement = element;
  if (props.modal && !platformEnv.isNative) {
    const Component = () => createPortal(element, document.body);
    renderElement = <Component />;
  }
  portalRef = {
    current: Portal.Render(
      Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL,
      renderElement,
    ),
  };
  return {
    close: async (extra?: { flag?: string }) =>
      instanceRef?.current?.close(extra),
    getForm: () => instanceRef?.current?.getForm(),
  };
}

const dialogConfirm = (props: IDialogConfirmProps) =>
  dialogShow({
    ...props,
    showFooter: true,
    showConfirmButton: true,
    showCancelButton: false,
  });

const dialogCancel = (props: IDialogCancelProps) =>
  dialogShow({
    ...props,
    showFooter: true,
    showConfirmButton: false,
    showCancelButton: true,
  });

export const Dialog = {
  Form: DialogForm,
  FormField: Form.Field,
  Footer: FooterAction,
  show: dialogShow,
  confirm: dialogConfirm,
  cancel: dialogCancel,
};
