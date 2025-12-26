import type { ForwardedRef } from 'react';
import {
  cloneElement,
  createRef,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { setStringAsync } from 'expo-clipboard';
import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import { useMedia } from '@onekeyhq/components/src/hooks/useStyle';
import {
  AnimatePresence,
  Sheet,
  TMDialog,
} from '@onekeyhq/components/src/shared/tamagui';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { Toast } from '../../actions/Toast';
import { Keyboard, SheetGrabber } from '../../content';
import { Form } from '../../forms/Form';
import {
  EPageType,
  EPortalContainerConstantName,
  Portal,
  usePageType,
} from '../../hocs';
import {
  useBackHandler,
  useModalNavigatorContextPortalId,
  useOverlayZIndex,
} from '../../hooks';
import { usePageContext } from '../../layouts/Page/PageContext';
import { ScrollView } from '../../layouts/ScrollView';
import { SizableText, Spinner, Stack } from '../../primitives';

import { Content } from './Content';
import { DialogContext } from './context';
import { DialogForm } from './DialogForm';
import { addDialogInstance, removeDialogInstance } from './dialogInstances';
import { Footer, FooterAction } from './Footer';
import {
  DialogDescription,
  DialogHeader,
  DialogHeaderContext,
  DialogHyperlinkTextDescription,
  DialogIcon,
  DialogRichDescription,
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
import type { UseFormReturn } from '../../hooks';
import type { IYStackProps } from '../../primitives';
import type { IColorTokens } from '../../types';
import type { GestureResponderEvent } from 'react-native';

export * from './dialogInstances';
export * from './hooks';
export type {
  IDialogCancelProps,
  IDialogConfirmProps,
  IDialogInstance,
  IDialogShowProps,
} from './type';

export const FIX_SHEET_PROPS: IYStackProps = {
  display: 'block',
};

const MAX_CONTENT_WIDTH = 400;

/**
 * Renders a responsive dialog component that adapts between a sheet (for medium and larger screens) and a modal dialog (for smaller screens or web), supporting customizable content, footer actions, and platform-specific behaviors.
 *
 * Handles dialog open/close state, confirm and cancel actions (including async handlers), backdrop and back button interactions, and tracks dialog events. Supports custom header, footer, and content rendering, as well as various configuration options for appearance and interactivity.
 *
 * @returns The rendered dialog UI as a React element.
 */
function DialogFrame({
  title,
  open,
  onHeaderCloseButtonPress,
  onClose,
  modal,
  renderContent,
  showFooter = true,
  footerProps,
  contentContainerProps,
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
  sheetOverlayProps,
  floatingPanelProps,
  disableDrag = false,
  showConfirmButton = true,
  showCancelButton = true,
  testID,
  isAsync,
  trackID,
  forceMount,
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
    if (trackID) {
      defaultLogger.ui.dialog.dialogOpen({
        trackId: trackID,
      });
    }
    onOpen?.();
  }, [trackID, onOpen]);

  const handleBackPress = useCallback(() => {
    if (!open) {
      return false;
    }
    handleOpenChange(false);
    return true;
  }, [handleOpenChange, open]);

  useBackHandler(handleBackPress);

  const handleEscapeKeyDown = useCallback((event: GestureResponderEvent) => {
    event.preventDefault();
  }, []);

  const handleCancelButtonPress = useCallback(async () => {
    if (trackID) {
      defaultLogger.ui.dialog.dialogCancel({
        trackId: trackID,
      });
    }
    const cancel = onCancel || footerRef.props?.onCancel;
    cancel?.(() => onClose({ flag: 'cancel' }));
    if (!onCancel?.length) {
      await onClose({ flag: 'cancel' });
    }
  }, [trackID, footerRef.props?.onCancel, onCancel, onClose]);

  const handleHeaderCloseButtonPress = useCallback(async () => {
    onHeaderCloseButtonPress?.();
    await onClose?.();
  }, [onClose, onHeaderCloseButtonPress]);

  const media = useMedia();

  const zIndex = useOverlayZIndex(open, title);
  const renderDialogContent = (
    <Stack>
      <DialogHeader trackID={trackID} onClose={handleHeaderCloseButtonPress} />
      {/* extra children */}
      <Content
        testID={testID}
        isAsync={isAsync}
        estimatedContentHeight={estimatedContentHeight}
        {...(contentContainerProps as any)}
      >
        {renderContent}
      </Content>
      <Footer
        trackID={trackID}
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
          intl.formatMessage({
            id: ETranslations.global_confirm,
          })
        }
        confirmButtonProps={confirmButtonProps}
        onCancelText={
          onCancelText ||
          intl.formatMessage({
            id: ETranslations.global_cancel,
          })
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
        zIndex={zIndex}
        // OK-36893 OK-38624
        // When modal is false, multiple Tamagui sheets may collapse into position:relative
        // which causes z-index stacking issues
        modal={!platformEnv.isNative && modal === undefined ? true : modal}
        {...sheetProps}
      >
        <Sheet.Overlay
          {...FIX_SHEET_PROPS}
          animation="quick"
          enterStyle={{ opacity: 0 } as any}
          exitStyle={{ opacity: 0 } as any}
          backgroundColor="$bgBackdrop"
          zIndex={sheetProps?.zIndex || zIndex}
          {...sheetOverlayProps}
        />
        <Sheet.Frame
          unstyled
          testID={testID}
          borderTopLeftRadius="$6"
          borderTopRightRadius="$6"
          bg="$bg"
          borderCurve="continuous"
          disableHideBottomOverflow
          // Fix width issue for portrait iPad mini - ensure proper dialog width
          mx={platformEnv.isNativeIOSPad ? 'auto' : undefined}
          width={platformEnv.isNativeIOSPad ? MAX_CONTENT_WIDTH : undefined}
          maxWidth={platformEnv.isNativeIOSPad ? MAX_CONTENT_WIDTH : undefined}
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
            position={
              platformEnv.isNative ? 'absolute' : ('fixed' as unknown as any)
            }
            top={0}
            left={0}
            right={0}
            bottom={0}
            alignItems="center"
            justifyContent="center"
            zIndex={floatingPanelProps?.zIndex || zIndex}
          >
            <TMDialog.Overlay
              key="overlay"
              backgroundColor="$bgBackdrop"
              animateOnly={['opacity']}
              animation="quick"
              forceMount={forceMount || undefined}
              enterStyle={{
                opacity: 0,
              }}
              exitStyle={{
                opacity: 0,
              }}
              onPress={handleBackdropPress}
              zIndex={floatingPanelProps?.zIndex || zIndex}
            />
            {/* /* fix missing title warnings in html dialog element on Web */}
            <TMDialog.Title display="none" />
            <TMDialog.Content
              elevate
              onEscapeKeyDown={handleEscapeKeyDown as any}
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
              $theme-dark={{
                outlineColor: '$neutral5',
              }}
              outlineWidth={1}
              outlineOffset={0}
              outlineColor="$neutral3"
              style={{
                outlineStyle: 'solid',
              }}
              bg="$bg"
              width={MAX_CONTENT_WIDTH}
              p="$0"
              {...floatingPanelProps}
              zIndex={floatingPanelProps?.zIndex || zIndex}
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
    renderIcon,
    showExitButton,
    open,
    isExist,
    onOpenChange,
    ...props
  }: IDialogContainerProps,
  ref: ForwardedRef<IDialogInstance>,
) {
  const [isOpenState, changeIsOpenState] = useState(true);
  const isControlled = !isNil(open);
  const isOpen = isControlled ? open : isOpenState;
  const changeIsOpen = useCallback(
    (value: boolean) => {
      if (isControlled) {
        onOpenChange?.(value);
      }
      changeIsOpenState(value);
    },
    [isControlled, onOpenChange],
  );
  const formRef = useRef<UseFormReturn<any, any, any> | undefined | undefined>(
    undefined,
  );
  const handleClose = useCallback(
    (extra?: { flag?: string }) => {
      if (
        props.trackID &&
        extra?.flag !== 'confirm' &&
        extra?.flag !== 'cancel'
      ) {
        defaultLogger.ui.dialog.dialogClose({
          trackId: props.trackID,
        });
      }
      changeIsOpen(false);
      void Keyboard.dismissWithDelay(50);
      return onClose(extra);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [changeIsOpen, onClose, props.trackID],
  );

  const handleIsExist = useCallback(
    () => (isExist ? isExist() : false),
    [isExist],
  );

  const contextValue = useMemo(
    () => ({
      dialogInstance: {
        close: handleClose,
        ref: formRef,
        isExist: handleIsExist,
      },
      footerRef: {
        notifyUpdate: undefined,
        props: undefined,
      },
    }),
    [handleClose, handleIsExist],
  );

  const handleOpen = useCallback(() => {
    changeIsOpen(true);
    onOpen?.();
  }, [changeIsOpen, onOpen]);

  const handleImperativeClose = useCallback(
    (extra?: { flag?: string }) => handleClose(extra),
    [handleClose],
  );

  useImperativeHandle(
    ref,
    () => ({
      close: handleImperativeClose,
      getForm: () => formRef.current,
      isExist: handleIsExist,
    }),
    [handleImperativeClose, handleIsExist],
  );
  const [headerProps, setHeaderProps] = useState<IDialogHeaderProps>({
    title,
    tone,
    description,
    icon,
    renderIcon,
    showExitButton,
  });

  // If the header properties change, update the headerContext content.
  useLayoutEffect(() => {
    setHeaderProps((prev) => ({
      ...prev,
      title,
      tone,
      description,
      icon,
      renderIcon,
      showExitButton,
    }));
  }, [description, icon, renderIcon, showExitButton, title, tone]);
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
          onClose={handleClose}
          title={title}
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

type IDialogShowFunctionProps = IDialogShowProps & {
  dialogContainer?: (o: {
    ref: React.RefObject<IDialogInstance | null>;
  }) => JSX.Element;
};
function dialogShow({
  onClose,
  dialogContainer,
  portalContainer,
  isOverTopAllViews,
  ...props
}: IDialogShowFunctionProps): IDialogInstance {
  void Keyboard.dismissWithDelay(50);
  let instanceRef: React.RefObject<IDialogInstance | null> | undefined =
    createRef();

  let portalRef:
    | {
        current: IPortalManager;
      }
    | undefined;

  let dialogInstance: IDialogInstance | undefined;

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
          if (dialogInstance) {
            removeDialogInstance(dialogInstance);
            dialogInstance = undefined;
          }
          void Keyboard.dismissWithDelay(50);
          void options.onClose?.(extra);
          resolve();
        }, 300);
      });
  const isExist = () => !!instanceRef?.current;
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
        isExist={isExist}
      />
    );
  })();

  portalRef = {
    current: portalContainer
      ? renderToContainer(portalContainer, element, isOverTopAllViews)
      : Portal.Render(Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL, element),
  };
  const close = async (extra?: { flag?: string }, times = 0) => {
    if (times > 10) {
      return;
    }
    if (!instanceRef?.current) {
      setTimeout(() => {
        void close(extra, times + 1);
      }, 10);
      return Promise.resolve();
    }
    return instanceRef?.current?.close(extra);
  };
  dialogInstance = {
    close,
    getForm: () => instanceRef?.current?.getForm(),
    isExist,
  };
  addDialogInstance(dialogInstance);
  return dialogInstance;
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

const dialogDebugMessage = (
  props: IDialogShowProps & { debugMessage: any },
) => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const dataContent = (() => {
    if (props.debugMessage instanceof Error) {
      return stringUtils.stableStringify(
        errorUtils.toPlainErrorObject(props.debugMessage),
        null,
        4,
      );
    }
    return stringUtils.stableStringify(props.debugMessage, null, 4);
  })();
  const copyContent = async () => {
    await setStringAsync(dataContent);
    console.log('dialogDebugMessage: object >>> ', props.debugMessage);
    console.log('dialogDebugMessage: ', dataContent);
    Toast.success({
      title: 'Copied',
    });
  };
  return dialogShow({
    title: 'DebugMessage',
    showFooter: true,
    showConfirmButton: true,
    showCancelButton: true,
    onConfirmText: 'Copy',
    dismissOnOverlayPress: false,
    onConfirm: async ({ preventClose }) => {
      preventClose();
      await copyContent();
    },
    renderContent: (
      <ScrollView maxHeight="$48" nestedScrollEnabled>
        <SizableText size="$bodySm" onPress={copyContent}>
          {dataContent}
        </SizableText>
      </ScrollView>
    ),
    ...props,
  });
};

export function DialogLoadingView({
  children,
  bg,
}: {
  children?: any;
  bg?: IColorTokens;
}) {
  return (
    <Stack
      borderRadius="$3"
      p="$5"
      bg={bg ?? '$bgSubdued'}
      borderCurve="continuous"
    >
      <Spinner size="large" />
      {children}
    </Stack>
  );
}

export type IDialogLoadingProps = {
  title?: string;
  description?: string;
  showExitButton?: boolean;
};
function dialogLoading(props: IDialogLoadingProps) {
  return dialogShow({
    showExitButton: false,
    ...props,
    dismissOnOverlayPress: false,
    // disableSwipeGesture: true,
    disableDrag: true,
    showFooter: false,
    showConfirmButton: false,
    showCancelButton: false,
    renderContent: <DialogLoadingView />,
  });
}

export const Dialog = {
  Header: SetDialogHeader,
  Title: DialogTitle,
  Description: DialogDescription,
  RichDescription: DialogRichDescription,
  HyperlinkTextDescription: DialogHyperlinkTextDescription,
  Icon: DialogIcon,
  Footer: FooterAction,
  Form: DialogForm,
  FormField: Form.Field,
  Loading: DialogLoadingView,
  show: dialogShow,
  confirm: dialogConfirm,
  cancel: dialogCancel,
  loading: dialogLoading,
  debugMessage: dialogDebugMessage,
};

export enum EInPageDialogType {
  inTabPages = 'inTabPages',
  inModalPage = 'inModalPage',
  inOnboardingPage = 'inOnboardingPage',
}
export const useInPageDialog = (dialogType?: EInPageDialogType) => {
  const navigatorPortalId = useModalNavigatorContextPortalId();
  const { pagePortalId } = usePageContext();
  const pageType = usePageType();
  const type = useMemo(() => {
    if (dialogType) {
      return dialogType;
    }
    if (pageType === EPageType.modal) {
      return EInPageDialogType.inModalPage;
    }
    if (pageType === EPageType.onboarding) {
      return EInPageDialogType.inOnboardingPage;
    }
    return EInPageDialogType.inTabPages;
  }, [dialogType, pageType]);
  const portalId = useMemo(() => {
    if (type === EInPageDialogType.inTabPages) {
      return EPortalContainerConstantName.IN_PAGE_TAB_CONTAINER;
    }
    return platformEnv.isNative
      ? (pagePortalId as EPortalContainerConstantName)
      : navigatorPortalId;
  }, [navigatorPortalId, pagePortalId, type]);

  const basicDialogProps = useMemo(
    () => ({
      testID: portalId,
      modal: false,
      forceMount: platformEnv.isNative ? undefined : true,
      portalContainer: portalId,
    }),
    [portalId],
  );
  return useMemo(
    () => ({
      show: (props: IDialogShowFunctionProps) => {
        return dialogShow({
          ...basicDialogProps,
          ...props,
        });
      },
      confirm: (props: IDialogConfirmProps) => {
        return dialogConfirm({
          ...basicDialogProps,
          ...props,
        });
      },
      cancel: (props: IDialogCancelProps) => {
        return dialogConfirm({
          ...basicDialogProps,
          ...props,
        });
      },
      loading: (props: IDialogLoadingProps) => {
        return dialogLoading({
          ...basicDialogProps,
          ...props,
        });
      },
    }),
    [basicDialogProps],
  );
};

export const useInTabDialog = () =>
  useInPageDialog(EInPageDialogType.inTabPages);
export const useInModalDialog = () =>
  useInPageDialog(EInPageDialogType.inModalPage);
