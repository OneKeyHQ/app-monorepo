import type { ForwardedRef } from 'react';
import {
  cloneElement,
  createRef,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatePresence, Sheet, Dialog as TMDialog, useMedia } from 'tamagui';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { SheetGrabber } from '../../content';
import { Form } from '../../forms/Form';
import { Portal } from '../../hocs';
import { useBackHandler, useKeyboardHeight } from '../../hooks';
import { Stack } from '../../primitives';

import { Content } from './Content';
import { DialogContext } from './context';
import { DialogForm } from './DialogForm';
import { Footer, FooterAction } from './Footer';
import {
  DialogDescription,
  DialogHeader,
  DialogHeaderContext,
  DialogIcon,
  DialogTitle,
  SetDialogHeader,
} from './Header';
import { renderToContainer } from './renderToContainer';

import type {
  IDialogCancelProps,
  IDialogConfirmProps,
  IDialogContainerProps,
  IDialogHeaderProps,
  IDialogInstance,
  IDialogProps,
  IDialogShowProps,
} from './type';
import type { IPortalManager } from '../../hocs';
import type { IStackProps } from '../../primitives';

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
  modal,
  renderContent,
  showFooter = true,
  footerProps,
  onConfirm,
  onConfirmText,
  onCancel,
  onOpen,
  onCancelText,
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
  const intl = useIntl();
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

  useEffect(() => {
    onOpen?.();
  }, [onOpen]);

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

  const media = useMedia();
  const keyboardHeight = useKeyboardHeight();
  const renderDialogContent = (
    <Stack
      {...(bottom &&
        // remove safe area padding when keyboard is shown
        !keyboardHeight && { pb: bottom })}
    >
      <DialogHeader onClose={handleCancelButtonPress} />
      {/* extra children */}
      <Content testID={testID} estimatedContentHeight={estimatedContentHeight}>
        {renderContent}
      </Content>
      <Footer
        tone={tone}
        showFooter={showFooter}
        footerProps={footerProps}
        showCancelButton={showCancelButton}
        showConfirmButton={showConfirmButton}
        cancelButtonProps={cancelButtonProps}
        onConfirm={onConfirm}
        onCancel={handleCancelButtonPress}
        onConfirmText={
          onConfirmText ||
          intl.formatMessage({ id: ETranslations.global_confirm })
        }
        confirmButtonProps={confirmButtonProps}
        onCancelText={
          onCancelText ||
          intl.formatMessage({ id: ETranslations.global_cancel })
        }
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
          disableHideBottomOverflow
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
            {/* /* fix missing title warnings in html dialog element on Web */}
            <TMDialog.Title display="none" />
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
  {
    onOpen,
    onClose,
    renderContent,
    title,
    tone,
    description,
    icon,
    showExitButton,
    ...props
  }: IDialogContainerProps,
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
  const [headerProps, setHeaderProps] = useState<IDialogHeaderProps>({
    title,
    tone,
    description,
    icon,
    showExitButton,
  });
  const headerContextValue = useMemo(
    () => ({ headerProps, setHeaderProps }),
    [headerProps],
  );
  return (
    <DialogContext.Provider value={contextValue}>
      <DialogHeaderContext.Provider value={headerContextValue}>
        <DialogFrame
          contextValue={contextValue}
          open={isOpen}
          onOpen={handleOpen}
          renderContent={renderContent}
          onClose={handleContainerClose}
          {...props}
        />
      </DialogHeaderContext.Provider>
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
  portalContainer,
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

  portalRef = {
    current: portalContainer
      ? renderToContainer(portalContainer, element)
      : Portal.Render(Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL, element),
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
  Header: SetDialogHeader,
  Title: DialogTitle,
  Description: DialogDescription,
  Icon: DialogIcon,
  Footer: FooterAction,
  Form: DialogForm,
  FormField: Form.Field,
  show: dialogShow,
  confirm: dialogConfirm,
  cancel: dialogCancel,
};
