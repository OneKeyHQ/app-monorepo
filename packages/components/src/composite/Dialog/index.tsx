import type { ComponentProps, ForwardedRef } from 'react';
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

import { FocusScope } from '@tamagui/focus-scope';
import { setStringAsync } from 'expo-clipboard';
import { isNil } from 'lodash';
import { useIntl } from 'react-intl';
import { Platform } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { initialWindowMetrics } from 'react-native-safe-area-context';

import { useMedia } from '@onekeyhq/components/src/hooks/useStyle';
import {
  AnimatePresence,
  Sheet,
  TMDialog,
} from '@onekeyhq/components/src/shared/tamagui';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import {
  createLazyModuleComponent,
  preloadLazyComponents,
} from '@onekeyhq/shared/src/lazyLoad';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { Toast } from '../../actions/Toast';
import { Keyboard } from '../../content/Keyboard';
import { SheetGrabber } from '../../content/SheetGrabber';
import {
  EPageType,
  EPortalContainerConstantName,
  Portal,
  usePageType,
} from '../../hocs';
import {
  NATIVE_SHEET_PRESENTATION_SUPPORTED,
  NativeSheetPresentation,
} from '../../hocs/NativeSheetPresentation';
import {
  useBackHandler,
  useKeyboardEventWithoutNavigation,
  useModalNavigatorContextPortalId,
  useOverlayZIndex,
  useSafeAreaInsets,
} from '../../hooks';
import { useKeyboardAnimation } from '../../hooks/useKeyboardAnimation';
import { usePageContext } from '../../layouts/Page/PageContext';
import { ScrollView } from '../../layouts/ScrollView';
import { SizableText, Spinner, Stack } from '../../primitives';
import {
  ANIMATE_ONLY_OPACITY,
  ANIMATE_ONLY_OPACITY_TRANSFORM,
} from '../../utils/animationConstants';

import { getDialogKeyboardPaddingBottom } from './boundedDialogLayout';
import { BoundedDialogScrollLayout } from './BoundedDialogScrollLayout';
import { Content } from './Content';
import { DialogContext, DialogSheetContext } from './context';
import { addDialogInstance, removeDialogInstance } from './dialogInstances';
import { DialogScrollView } from './DialogScrollView';
import { Footer, FooterAction } from './Footer';
import {
  DialogDescription,
  DialogHeader,
  DialogHeaderCloseButton,
  DialogHeaderContext,
  DialogHyperlinkTextDescription,
  DialogIcon,
  DialogRichDescription,
  DialogTitle,
  SetDialogHeader,
} from './Header';
import { HeaderDragZone } from './HeaderDragZone';
import { renderToContainer } from './renderToContainer';

import type {
  IDialogCancelProps,
  IDialogConfirmProps,
  IDialogContainerProps,
  IDialogForm,
  IDialogFormProps,
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

type IDialogFormModule = typeof import('./DialogForm');
type IDialogFormFieldProps = ComponentProps<
  (typeof import('./DialogForm'))['DialogFormField']
>;

let loadDialogFormModulePromise: Promise<IDialogFormModule> | undefined;
function loadDialogFormModule() {
  if (!loadDialogFormModulePromise) {
    loadDialogFormModulePromise = import('./DialogForm')
      .then(async (dialogFormModule) => {
        await dialogFormModule.preloadDialogForm();
        return dialogFormModule;
      })
      .catch((error: unknown) => {
        loadDialogFormModulePromise = undefined;
        throw error;
      });
  }
  return loadDialogFormModulePromise;
}

const LazyDialogFormFieldComponent = createLazyModuleComponent<
  IDialogFormFieldProps,
  IDialogFormModule
>(loadDialogFormModule, ({ DialogFormField }) => DialogFormField);

async function loadDialogFormComponentModule() {
  const dialogFormModule = await loadDialogFormModule();
  await LazyDialogFormFieldComponent.preload();
  return dialogFormModule;
}

const LazyDialogFormComponent = createLazyModuleComponent<
  IDialogFormProps,
  IDialogFormModule
>(loadDialogFormComponentModule, ({ DialogForm }) => DialogForm);

export function preloadDialogFormComponents() {
  return preloadLazyComponents([
    LazyDialogFormComponent,
    LazyDialogFormFieldComponent,
  ]);
}

export * from './dialogInstances';
export * from './hooks';
export type {
  IDialogCancelProps,
  IDialogConfirmProps,
  IDialogContainerProps,
  IDialogInstance,
  IDialogShowProps,
} from './type';

export const FIX_SHEET_PROPS = {
  display: 'block',
} satisfies IYStackProps;

const MAX_CONTENT_WIDTH = 400;

const DIALOG_ENTER_STYLE_OPACITY = { opacity: 0 } as any;
const DIALOG_EXIT_STYLE_OPACITY = { opacity: 0 } as any;
const DIALOG_CONTENT_ANIMATION: [
  'quick',
  { opacity: { overshootClamping: boolean } },
] = ['quick', { opacity: { overshootClamping: true } }];
const DIALOG_CONTENT_ENTER_EXIT_STYLE = { opacity: 0, scale: 0.85 };
const DIALOG_THEME_DARK = { outlineColor: '$neutral5' } as const;
const DIALOG_OUTLINE_STYLE = { outlineStyle: 'solid' } as const;
const DIALOG_CONTENT_VISIBILITY_HIDDEN = {
  outlineStyle: 'solid',
  contentVisibility: 'hidden',
} as any;
const DIALOG_HIDDEN_STYLE = { contentVisibility: 'hidden' } as any;
const EMPTY_DIALOG_STYLE = {} as const;
const INITIAL_BOTTOM_INSET = initialWindowMetrics?.insets.bottom || 0;

const DEFAULT_KEYBOARD_HEIGHT = 330;
const useSafeKeyboardAnimationStyle = ({
  useInitialSafeAreaBottomInsetFallback = false,
  trackKeyboardPadding = false,
}: {
  useInitialSafeAreaBottomInsetFallback?: boolean;
  trackKeyboardPadding?: boolean;
}) => {
  const { bottom } = useSafeAreaInsets();
  // Root-sibling portals can report zero before safe-area context propagates.
  // Opt in only for flows that must preserve the initial window inset.
  const safeAreaBottom =
    useInitialSafeAreaBottomInsetFallback && bottom === 0
      ? INITIAL_BOTTOM_INSET
      : bottom;
  const isNativeAndroid = Boolean(platformEnv.isNativeAndroid);
  const { height: keyboardHeight } = useKeyboardAnimation();
  const [trackedKeyboardHeight, setTrackedKeyboardHeight] = useState(0);
  // Keep the dialog clear of both the home indicator and the keyboard.
  // These are two independent concerns collapsed into one paddingBottom:
  //   - bottom safe-area inset: always required (static)
  //   - keyboard height: only while the keyboard is shown (dynamic)
  // Android keyboard events exclude the bottom system-bar inset, while iOS
  // keyboard events already include it. Only restore the inset on Android.
  // Read the keyboard-controller animation on every native frame. A portal-
  // mounted fit Sheet can miss or defer a one-shot keyboardWillShow layout
  // update, leaving its input behind the iOS keyboard until a later render.
  const animatedStyles = useAnimatedStyle(() => ({
    paddingBottom: getDialogKeyboardPaddingBottom({
      keyboardHeight: Math.abs(keyboardHeight.value),
      safeAreaBottom,
      isNativeAndroid,
    }),
  }));

  useKeyboardEventWithoutNavigation({
    keyboardWillShow: (e) => {
      const height =
        e.endCoordinates.height < 0
          ? DEFAULT_KEYBOARD_HEIGHT
          : e.endCoordinates.height;
      if (trackKeyboardPadding) {
        setTrackedKeyboardHeight(height);
      }
    },
    keyboardWillHide: () => {
      if (trackKeyboardPadding) {
        setTrackedKeyboardHeight(0);
      }
    },
  });
  const keyboardPaddingBottom = getDialogKeyboardPaddingBottom({
    keyboardHeight: trackKeyboardPadding ? trackedKeyboardHeight : 0,
    safeAreaBottom,
    isNativeAndroid,
  });
  // On web there is no reanimated keyboard tracking, but notched iOS
  // Safari/PWA still reports a bottom inset via env(safe-area-inset-bottom).
  // The frame must apply it as a static paddingBottom so bottom-sheet dialogs
  // clear the home indicator there too — footers only carry their design
  // padding now, and rely on the frame for the inset on every platform.
  if (!platformEnv.isNative) {
    return {
      style: safeAreaBottom ? { paddingBottom: safeAreaBottom } : undefined,
      keyboardPaddingBottom: safeAreaBottom,
    };
  }
  return { style: animatedStyles, keyboardPaddingBottom };
};

// Without a title the header drag zone is only the grabber strip; keep it
// tall enough to catch a finger.
const HEADER_DRAG_ZONE_MIN_HEIGHT = 24;

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
  onOpenAutoFocus,
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
  sheetDragArea = 'sheet',
  disableSystemClose = false,
  showHeader = true,
  trapFocus,
  showConfirmButton = true,
  showCancelButton = true,
  testID,
  isAsync,
  nativeSheet = false,
  trackID,
  forceMount,
  useInitialSafeAreaBottomInsetFallback = false,
  boundedSheetLayout = false,
}: IDialogProps) {
  const intl = useIntl();
  const { footerRef } = useContext(DialogContext);
  const [position, setPosition] = useState(0);
  const effectiveTrapFocus = trapFocus ?? !platformEnv.isNative;
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
    if (disableSystemClose) {
      // Consume the event without dismissing — keep the dialog mounted as a
      // blocker (e.g. pending force-update).
      return true;
    }
    handleOpenChange(false);
    return true;
  }, [disableSystemClose, handleOpenChange, open]);

  useBackHandler(handleBackPress);

  const handleEscapeKeyDown = useCallback((event: GestureResponderEvent) => {
    // preventDefault stops Tamagui's built-in Escape-to-close. Always called
    // here so unblocking is opt-in only via the close button / overlay.
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

  // Native OneKey login opt-in (OK-63232): cap + scroll inside the existing
  // Tamagui sheet. Never enable nativeSheet from this flag.
  const isBoundedDialogLayout = boundedSheetLayout && platformEnv.isNative;
  // Header-only drag (OK-61140): the sheet's own frame drag is switched off,
  // so a scrollable body scrolls natively with no hand-off to the sheet, and
  // the grabber + title row (HeaderDragZone) carry a pan of their own that
  // moves the sheet body and lets go of it past its thresholds.
  const isHeaderDragOnly =
    media.md && sheetDragArea === 'header' && !disableDrag;
  const headerDragY = useSharedValue(0);
  useEffect(() => {
    if (open) {
      headerDragY.value = 0;
    }
  }, [open, headerDragY]);
  const dismissFromHeaderDrag = useCallback(() => {
    handleOpenChange(false);
  }, [handleOpenChange]);
  const headerDragStyle = useAnimatedStyle(() => ({
    transform: [
      {
        // A bounded dialog may already be at the top safe-area limit.
        translateY: isBoundedDialogLayout
          ? Math.max(0, headerDragY.value)
          : headerDragY.value,
      },
    ],
  }));

  const zIndex = useOverlayZIndex(open, title);
  const { style: safeKeyboardAnimationStyle, keyboardPaddingBottom } =
    useSafeKeyboardAnimationStyle({
      useInitialSafeAreaBottomInsetFallback,
      trackKeyboardPadding: isBoundedDialogLayout,
    });
  const useNativeSheetPresentation =
    nativeSheet && media.md && NATIVE_SHEET_PRESENTATION_SUPPORTED;
  const dialogHeader = showHeader ? (
    <DialogHeader
      trackID={trackID}
      onClose={handleHeaderCloseButtonPress}
      hideCloseButton={isBoundedDialogLayout}
    />
  ) : null;
  const boundedCloseButton = useMemo(
    () =>
      isBoundedDialogLayout && showHeader ? (
        <DialogHeaderCloseButton
          testID="dialog-bounded-close"
          trackID={trackID}
          onClose={handleHeaderCloseButtonPress}
        />
      ) : null,
    [handleHeaderCloseButtonPress, isBoundedDialogLayout, showHeader, trackID],
  );
  const boundedHeaderDragChrome = useMemo(
    () =>
      isBoundedDialogLayout && isHeaderDragOnly ? (
        <HeaderDragZone
          dragY={headerDragY}
          onDismiss={dismissFromHeaderDrag}
          minHeight={HEADER_DRAG_ZONE_MIN_HEIGHT}
        >
          <SheetGrabber />
        </HeaderDragZone>
      ) : undefined,
    [
      dismissFromHeaderDrag,
      headerDragY,
      isBoundedDialogLayout,
      isHeaderDragOnly,
    ],
  );
  const dialogMain = (
    <>
      <Content
        testID={testID}
        isAsync={isAsync}
        estimatedContentHeight={estimatedContentHeight}
        nativeSheetPresentation={useNativeSheetPresentation}
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
    </>
  );
  const renderDialogContent = (
    <Animated.View
      style={
        useNativeSheetPresentation ? undefined : safeKeyboardAnimationStyle
      }
    >
      {isBoundedDialogLayout ? (
        <BoundedDialogScrollLayout
          keyboardPaddingBottom={keyboardPaddingBottom}
          isCentered={!media.md}
          chrome={boundedHeaderDragChrome}
          closeButton={boundedCloseButton}
        >
          {dialogHeader}
          {dialogMain}
        </BoundedDialogScrollLayout>
      ) : (
        <>
          {isHeaderDragOnly ? (
            <HeaderDragZone
              dragY={headerDragY}
              onDismiss={dismissFromHeaderDrag}
              minHeight={showHeader ? undefined : HEADER_DRAG_ZONE_MIN_HEIGHT}
            >
              <SheetGrabber />
              {dialogHeader}
            </HeaderDragZone>
          ) : (
            dialogHeader
          )}
          {dialogMain}
        </>
      )}
    </Animated.View>
  );

  const dialogSheetBody = (
    <DialogSheetContext.Provider value={!useNativeSheetPresentation}>
      <FocusScope
        enabled={open}
        trapped={open ? effectiveTrapFocus : undefined}
        onMountAutoFocus={onOpenAutoFocus}
        loop
      >
        {isHeaderDragOnly ? (
          <Animated.View style={headerDragStyle}>
            <Stack
              bg={(contentContainerProps as { bg?: IColorTokens })?.bg ?? '$bg'}
              borderTopLeftRadius="$6"
              borderTopRightRadius="$6"
              borderCurve="continuous"
            >
              {renderDialogContent}
            </Stack>
          </Animated.View>
        ) : (
          <Stack>
            {!disableDrag ? <SheetGrabber /> : null}
            {renderDialogContent}
          </Stack>
        )}
      </FocusScope>
    </DialogSheetContext.Provider>
  );

  if (useNativeSheetPresentation) {
    return (
      <NativeSheetPresentation
        open={Boolean(open)}
        onOpenChange={handleOpenChange}
        dismissOnOverlayPress={dismissOnOverlayPress}
        dismissOnSnapToBottom={sheetProps?.dismissOnSnapToBottom ?? true}
        disableDrag={
          disableDrag || Boolean(sheetProps?.disableDrag) || isHeaderDragOnly
        }
        dismissOnBackPress={!disableSystemClose}
        showHandle={false}
        cornerRadius={24}
        onAnimationComplete={sheetProps?.onAnimationComplete}
        testID={testID}
      >
        <Stack
          bg={
            isHeaderDragOnly
              ? 'transparent'
              : ((contentContainerProps as { bg?: IColorTokens })?.bg ?? '$bg')
          }
          borderTopLeftRadius="$6"
          borderTopRightRadius="$6"
          borderCurve="continuous"
          overflow="hidden"
        >
          {dialogSheetBody}
        </Stack>
      </NativeSheetPresentation>
    );
  }

  if (media.md) {
    return (
      <Sheet
        disableDrag={disableDrag || isHeaderDragOnly}
        open={open}
        position={position}
        onPositionChange={setPosition}
        dismissOnSnapToBottom
        // the native dismissOnOverlayPress used on native side,
        //  so it needs to assign a value to onOpenChange.
        dismissOnOverlayPress={dismissOnOverlayPress}
        onOpenChange={handleOpenChange}
        snapPointsMode="fit"
        transition="quick"
        zIndex={zIndex}
        // OK-36893 OK-38624
        // When modal is false, multiple Tamagui sheets may collapse into position:relative
        // which causes z-index stacking issues
        modal={!platformEnv.isNative && modal === undefined ? true : modal}
        {...sheetProps}
      >
        <Sheet.Overlay
          {...FIX_SHEET_PROPS}
          transition="quick"
          animateOnly={ANIMATE_ONLY_OPACITY}
          enterStyle={DIALOG_ENTER_STYLE_OPACITY}
          exitStyle={DIALOG_EXIT_STYLE_OPACITY}
          backgroundColor="$bgBackdrop"
          zIndex={sheetProps?.zIndex || zIndex}
          {...sheetOverlayProps}
        />
        <Sheet.Frame
          unstyled
          testID={testID}
          borderTopLeftRadius="$6"
          borderTopRightRadius="$6"
          // Match the sheet frame to the content surface so the bottom
          // safe-area inset region (applied as paddingBottom on the wrapper,
          // below the footer) doesn't reveal the default `$bg` as a seam when a
          // dialog overrides its content background (e.g. Prime feature intro).
          // In header-drag mode the frame stays put and transparent while the
          // body below carries the surface and moves with the drag, so the
          // pull reads as the sheet moving rather than content sliding in it.
          bg={
            isHeaderDragOnly
              ? 'transparent'
              : ((contentContainerProps as { bg?: IColorTokens })?.bg ?? '$bg')
          }
          borderCurve="continuous"
          disableHideBottomOverflow
          // Fix width issue for portrait iPad mini - ensure proper dialog width
          mx={platformEnv.isNativeIOSPad ? 'auto' : undefined}
          width={platformEnv.isNativeIOSPad ? MAX_CONTENT_WIDTH : undefined}
          maxWidth={platformEnv.isNativeIOSPad ? MAX_CONTENT_WIDTH : undefined}
        >
          {dialogSheetBody}
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
            // The positioning layer outlives closed content during its exit animation.
            // Let the overlay and content own hit testing on the web.
            pointerEvents={Platform.select({ web: 'box-none' })}
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
              animateOnly={ANIMATE_ONLY_OPACITY}
              transition="quick"
              forceMount={forceMount || undefined}
              enterStyle={DIALOG_ENTER_STYLE_OPACITY}
              exitStyle={DIALOG_EXIT_STYLE_OPACITY}
              onPress={handleBackdropPress}
              zIndex={floatingPanelProps?.zIndex || zIndex}
              style={
                !platformEnv.isNative && !open && forceMount
                  ? DIALOG_HIDDEN_STYLE
                  : EMPTY_DIALOG_STYLE
              }
            />
            {/* /* fix missing title warnings in html dialog element on Web */}
            <TMDialog.Title display="none" />
            <TMDialog.Content
              elevate
              {...({ trapFocus: effectiveTrapFocus } as any)}
              onEscapeKeyDown={handleEscapeKeyDown as any}
              key="content"
              testID={testID}
              animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
              transition={DIALOG_CONTENT_ANIMATION}
              enterStyle={DIALOG_CONTENT_ENTER_EXIT_STYLE}
              exitStyle={DIALOG_CONTENT_ENTER_EXIT_STYLE}
              borderRadius="$4"
              borderWidth="$0"
              $theme-dark={DIALOG_THEME_DARK}
              outlineWidth={1}
              outlineOffset={0}
              outlineColor="$neutral3"
              style={
                !platformEnv.isNative && !open && forceMount
                  ? DIALOG_CONTENT_VISIBILITY_HIDDEN
                  : DIALOG_OUTLINE_STYLE
              }
              bg="$bg"
              width={MAX_CONTENT_WIDTH}
              p="$0"
              {...floatingPanelProps}
              onOpenAutoFocus={
                onOpenAutoFocus ?? floatingPanelProps?.onOpenAutoFocus
              }
              zIndex={floatingPanelProps?.zIndex || zIndex}
            >
              {platformEnv.isNative && !isBoundedDialogLayout ? (
                // Native only: the centered frame sits in an absolute-fill
                // Stack, so Yoga measures its subtree in AtMost mode and any
                // `flex: 1` child (e.g. ListItem's Pressable wrapper) collapses
                // to zero height and overlaps its siblings. A ScrollView
                // measures its content unconstrained (overflow: scroll), which
                // restores content sizing and also lets tall content scroll.
                // Bounded login already wraps one DialogScrollView; do not nest.
                <ScrollView bounces={false} keyboardShouldPersistTaps="handled">
                  {renderDialogContent}
                </ScrollView>
              ) : (
                renderDialogContent
              )}
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
    onBeforeClose,
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
    onCloseRequested,
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
  const formRef = useRef<UseFormReturn<any, any, any> | undefined>(undefined);
  const pendingCloseRef = useRef<Promise<void> | undefined>(undefined);
  const handleClose = useCallback(
    (extra?: { flag?: string }) => {
      if (pendingCloseRef.current) {
        return pendingCloseRef.current;
      }
      const close = async () => {
        if (onBeforeClose && !(await onBeforeClose(extra))) {
          return;
        }
        if (
          props.trackID &&
          extra?.flag !== 'confirm' &&
          extra?.flag !== 'cancel'
        ) {
          defaultLogger.ui.dialog.dialogClose({ trackId: props.trackID });
        }
        onCloseRequested?.();
        changeIsOpen(false);
        void Keyboard.dismissWithDelay(50);
        await onClose(extra);
      };
      pendingCloseRef.current = close().finally(() => {
        pendingCloseRef.current = undefined;
      });
      return pendingCloseRef.current;
    },
    [changeIsOpen, onClose, props.trackID, onBeforeClose, onCloseRequested],
  );

  const handleIsExist = useCallback(
    () => (isExist ? isExist() : false),
    [isExist],
  );

  // `Dialog.Form` registers itself onto `formRef` from a lazily loaded module,
  // so it lands after the rest of the dialog has mounted and lands again on
  // every remount. Consumers that hold on to the instance (the footer's
  // `disabledOn` subscription) need to be told, not to re-read a ref they have
  // no reason to look at again. (OK-62416)
  const formListenersRef = useRef(new Set<() => void>());
  const registerForm = useCallback((form: IDialogForm | undefined) => {
    formRef.current = form;
    for (const listener of formListenersRef.current) {
      listener();
    }
  }, []);
  const subscribeFormChange = useCallback((listener: () => void) => {
    const listeners = formListenersRef.current;
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const contextValue = useMemo(
    () => ({
      dialogInstance: {
        close: handleClose,
        ref: formRef,
        isExist: handleIsExist,
        registerForm,
        subscribeFormChange,
      },
      footerRef: {
        notifyUpdate: undefined,
        props: undefined,
      },
    }),
    [handleClose, handleIsExist, registerForm, subscribeFormChange],
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
  onCloseStart,
  dialogContainer,
  portalContainer,
  isOverTopAllViews,
  ...props
}: IDialogShowFunctionProps): IDialogInstance {
  if (
    platformEnv.isDev &&
    platformEnv.isNativeIOS &&
    portalContainer &&
    isOverTopAllViews === true
  ) {
    // iOS only, because only `renderToContainer.ios` fails on this shape: it
    // mounts `element` twice — once wrapped in a fresh `OverlayContainer`,
    // once into `portalContainer` — and returns only the second manager, so
    // the first window is never torn down. That stray window is also created
    // at dialog-open time, and iOS stacks window overlays in the order they
    // were added, so once the app-state lock screen has added its own (at lock
    // time, not app start) a dialog opened afterwards lands on top of the
    // passcode screen. Elsewhere the pair is fine and documented: web renders
    // once and portals to `document.body` (the only shape in which that
    // feature exists, and what `useInPageDialog` relies on), and Android
    // ignores the flag outright. (OK-62416)
    console.error(
      '[Dialog.show] on iOS, `portalContainer` and `isOverTopAllViews: true` must not be combined: it mounts the dialog twice, leaks the first window overlay, and can stack it above the app-state lock screen. Pass one or the other.',
      { portalContainer },
    );
  }
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
        onCloseStart?.();
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
  // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
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
  // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
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
  ScrollView: DialogScrollView,
  Title: DialogTitle,
  Description: DialogDescription,
  RichDescription: DialogRichDescription,
  HyperlinkTextDescription: DialogHyperlinkTextDescription,
  Icon: DialogIcon,
  Footer: FooterAction,
  Form: LazyDialogFormComponent,
  FormField: LazyDialogFormFieldComponent,
  preloadForm: preloadDialogFormComponents,
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
  inFullScreenPushPage = 'inFullScreenPushPage',
}
export const useInPageDialog = (dialogType?: EInPageDialogType) => {
  const navigatorPortalId = useModalNavigatorContextPortalId();
  const { pagePortalId } = usePageContext();
  const pageType = usePageType();
  const type = useMemo(() => {
    if (dialogType) {
      return dialogType;
    }
    if (pageType === EPageType.modal || pageType === EPageType.webView) {
      return EInPageDialogType.inModalPage;
    }
    if (pageType === EPageType.fullScreenPush) {
      return EInPageDialogType.inFullScreenPushPage;
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
