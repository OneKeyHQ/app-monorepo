import type { RefObject } from 'react';
import { createRef } from 'react';

import { overlayToastStore } from '@onekeyfe/react-native-native-overlay';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors/errors/localError';
import { dismissKeyboard } from '@onekeyhq/shared/src/keyboard';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { requestNativeStorageRecovery } from '@onekeyhq/shared/src/storage/nativeStorageRecovery';
import { getNativeStorageRecoveryToastTarget } from '@onekeyhq/shared/src/storage/nativeStorageTypes';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { mountImperativeOverlay } from '../../shared/imperativeOverlayMount';

import { ShowCustom, ShowToasterClose } from './ShowCustom';
import {
  TOAST_LINK_URL_IN_APP_PREFIX,
  TOAST_LINK_URL_PREFIX,
} from './toastRichText';
import {
  buildMessageToastSpec,
  buildNotificationToastSpec,
  toastActionId,
} from './toastSpec';
import {
  getToastStyleContext,
  subscribeToastStyleContext,
} from './toastStyleContext';

import type { IShowToasterInstance, IShowToasterProps } from './ShowCustom';
import type { IToastAction, IToastHaptic } from './toastSpec';
import type { IToastStyleContext } from './toastStyleContext';
import type { IPortalManager } from '../../hocs';
import type { IKeyOfIcons } from '../../primitives';
import type {
  IOverlayToastPosition,
  IOverlayToastSpec,
} from '@onekeyfe/react-native-native-overlay';
import type { IntlShape } from 'react-intl';

export type { IToastAction, IToastActionVariant } from './toastSpec';

export interface IToastProps {
  toastId?: string;
  title: string;
  message?: string;
  icon?: IKeyOfIcons;
  imageUri?: string;
  duration?: number;
  actionsAlign?: 'left' | 'right';
  /**
   * Buttons under the message. A toast is drawn by the platform from plain
   * data, so an action is a description of a small `Button`, not an element.
   */
  actions?: IToastAction | IToastAction[];
  onClose?: () => void;
  nativeStorageRecoveryTestSessionId?: string;
}

export interface IToastBaseProps extends IToastProps {
  title: string;
  message?: string;
  duration?: number;
  haptic?: IToastHaptic;
  preset?: 'done' | 'error' | 'none' | 'custom';
  /**
   * Change the position of the toast.
   * Only works on web platform.
   * @platform web
   */
  position?: IOverlayToastPosition;
}

export interface IToastNotificationProps extends IToastBaseProps {
  onPress?: () => void;
  iconImageUri?: string;
}

/** Where a link inside toast text points. */
export interface IToastLink {
  /** `url` leaves the app, `urlInApp` opens inside it. */
  kind: 'url' | 'urlInApp';
  url: string;
}

const RECOVERY_ACTION_TEST_ID = 'native-storage-repair-toast-action';

let toastLinkHandler: ((link: IToastLink) => void) | undefined;

/**
 * The app decides how a link in toast text opens (deep links, the in-app
 * browser). Until one is registered a link opens in the system browser.
 */
export function setToastLinkHandler(
  handler: ((link: IToastLink) => void) | undefined,
) {
  toastLinkHandler = handler;
}

function openToastLink(link: string) {
  let parsed: IToastLink | undefined;
  if (link.startsWith(TOAST_LINK_URL_IN_APP_PREFIX)) {
    parsed = {
      kind: 'urlInApp',
      url: link.slice(TOAST_LINK_URL_IN_APP_PREFIX.length),
    };
  } else if (link.startsWith(TOAST_LINK_URL_PREFIX)) {
    parsed = { kind: 'url', url: link.slice(TOAST_LINK_URL_PREFIX.length) };
  }
  if (!parsed?.url) {
    return;
  }
  if (toastLinkHandler) {
    toastLinkHandler(parsed);
    return;
  }
  openUrlExternal(parsed.url);
}

function toActionList(actions: IToastProps['actions']): IToastAction[] {
  if (!actions) {
    return [];
  }
  return Array.isArray(actions) ? actions : [actions];
}

// A toast that reports a recoverable native storage failure carries a retry
// button, unless the caller already supplied one.
function withRecoveryAction({
  title,
  message,
  actions,
  testSessionId,
  close,
  intl,
}: {
  title: string;
  message?: string;
  actions: IToastAction[];
  testSessionId?: string;
  close: () => void;
  intl: IntlShape;
}): IToastAction[] {
  const target = platformEnv.isNative
    ? getNativeStorageRecoveryToastTarget(title, message)
    : undefined;
  if (
    !target ||
    actions.some((action) => action.testID === RECOVERY_ACTION_TEST_ID)
  ) {
    return actions;
  }
  let pending = false;
  return [
    ...actions,
    {
      label: intl.formatMessage({ id: ETranslations.global_retry }),
      testID: RECOVERY_ACTION_TEST_ID,
      onPress: () => {
        if (pending) return;
        pending = true;
        try {
          close();
        } finally {
          requestNativeStorageRecovery(
            target,
            target === 'appStorage' ? testSessionId : undefined,
          );
          pending = false;
        }
      },
    },
  ];
}

const toastIdMap = new Map<string, [number, number]>();

const handleToastId = ({
  title,
  toastId,
  duration = 0,
  onClose,
}: {
  toastId?: string;
  title: string;
  message?: string;
  duration?: number;
  onClose?: () => void;
}) => {
  const handleClose = () => {
    if (toastId) {
      toastIdMap.delete(toastId);
    }
    onClose?.();
  };
  if (platformEnv.isDev) {
    if (title?.length === 0) {
      throw new OneKeyLocalError(
        `The parameter 'title' cannot be an empty string`,
      );
    }
  }
  if (toastId) {
    if (toastIdMap.has(toastId)) {
      const [createdAt, toastDuration] = toastIdMap.get(toastId) as [
        number,
        number,
      ];
      if (Date.now() - createdAt < toastDuration) {
        return;
      }
      toastIdMap.delete(toastId);
    }
    toastIdMap.set(toastId, [Date.now(), duration + 500]);
  }
  return handleClose;
};

interface IActiveToast {
  build: (context: IToastStyleContext) => IOverlayToastSpec;
  /** The row as last built, for routing a press to its handler. */
  actions: () => IToastAction[];
  onClose: () => void;
  onPress?: () => void;
  /** False while it waits for the style context to draw with. */
  shown: boolean;
  closed: boolean;
}

// The toasts this module has on screen or waiting, so a theme or layout
// change can redraw them and a toast requested before the host mounted can
// appear once it has.
const activeToasts = new Map<string, IActiveToast>();

function finishToast(id: string, toast: IActiveToast) {
  if (toast.closed) {
    return;
  }
  toast.closed = true;
  // Shown again under the same id: that toast owns the entry now.
  if (activeToasts.get(id) === toast) {
    activeToasts.delete(id);
  }
  toast.onClose();
}

function reconcileActiveToasts() {
  const snapshot = overlayToastStore.getSnapshot?.();
  if (!snapshot?.items) {
    return;
  }
  const liveIds = new Set(snapshot.items.map((item) => item.spec.id));
  activeToasts.forEach((toast, id) => {
    if (toast.shown && !liveIds.has(id)) {
      finishToast(id, toast);
    }
  });
}

let subscribedToToastStore = false;

function ensureToastStoreSubscription() {
  if (subscribedToToastStore) {
    return;
  }
  subscribedToToastStore = true;
  overlayToastStore.subscribe?.(reconcileActiveToasts);
}

function presentToast(id: string, toast: IActiveToast) {
  const context = getToastStyleContext();
  if (!context) {
    return;
  }
  ensureToastStoreSubscription();
  const spec = toast.build(context);
  if (toast.shown) {
    overlayToastStore.update(spec);
    return;
  }
  toast.shown = true;
  overlayToastStore.show(spec, {
    onClose: () => {
      finishToast(id, toast);
    },
    onAction: (actionId) => {
      const action = toast
        .actions()
        .find((_, index) => toastActionId(index) === actionId);
      if (action?.testID) {
        defaultLogger.ui.button.click({
          trackId: action.testID,
        });
      }
      void action?.onPress?.();
    },
    onLink: openToastLink,
    onPress: () => toast.onPress?.(),
  });
  reconcileActiveToasts();
}

subscribeToastStyleContext(() => {
  activeToasts.forEach((toast, id) => presentToast(id, toast));
});

function closeToast(id: string, toast: IActiveToast) {
  if (activeToasts.get(id) !== toast) {
    return;
  }
  if (!toast.shown) {
    finishToast(id, toast);
    return;
  }
  overlayToastStore.dismiss(id);
}

function showToast(id: string, toast: IActiveToast) {
  const previous = activeToasts.get(id);
  if (previous) {
    finishToast(id, previous);
  }
  activeToasts.set(id, toast);
  presentToast(id, toast);
  return {
    close: () => closeToast(id, toast),
  };
}

function toastMessage({
  toastId,
  title,
  message,
  icon,
  duration = 5000,
  haptic,
  actions,
  actionsAlign = 'right',
  position,
  onClose,
  nativeStorageRecoveryTestSessionId,
}: IToastBaseProps) {
  const handleClose = handleToastId({ title, toastId, duration, onClose });
  if (!handleClose) return;
  const id = toastId ?? overlayToastStore.createId();
  let close = () => {};
  const callerActions = toActionList(actions);
  let resolvedActions: IToastAction[] | undefined;
  // The retry label needs the app's locale, which arrives with the context.
  const resolveActions = (context: IToastStyleContext) => {
    resolvedActions ??= withRecoveryAction({
      title,
      message,
      actions: callerActions,
      testSessionId: nativeStorageRecoveryTestSessionId,
      close: () => close(),
      intl: context.intl,
    });
    return resolvedActions;
  };
  const instance = showToast(id, {
    build: (context) =>
      buildMessageToastSpec(context, {
        id,
        title,
        message,
        icon,
        haptic,
        duration,
        // Native toasts always land at the top.
        position: platformEnv.isNative ? undefined : position,
        actions: resolveActions(context),
        actionsAlign,
      }),
    actions: () => resolvedActions ?? callerActions,
    onClose: handleClose,
    shown: false,
    closed: false,
  });
  close = instance.close;
  return instance;
}

function toastNotification({
  toastId,
  title,
  message,
  icon,
  iconImageUri,
  imageUri,
  duration = 5000,
  actions,
  actionsAlign = 'right',
  position,
  onPress,
  onClose,
  nativeStorageRecoveryTestSessionId,
}: IToastNotificationProps) {
  const handleClose = handleToastId({ title, toastId, duration, onClose });
  if (!handleClose) return;
  // A notification never reuses a card: every call is its own toast.
  const id = overlayToastStore.createId();
  let close = () => {};
  // The caller's actions; a storage recovery toast adds its repair action.
  const isRecovery =
    platformEnv.isNative &&
    !!getNativeStorageRecoveryToastTarget(title, message);
  const callerActions = toActionList(actions);
  let resolvedActions: IToastAction[] | undefined;
  const resolveActions = (context: IToastStyleContext) => {
    if (!isRecovery) {
      resolvedActions = callerActions;
      return callerActions;
    }
    resolvedActions ??= withRecoveryAction({
      title,
      message,
      actions: callerActions,
      testSessionId: nativeStorageRecoveryTestSessionId,
      close: () => close(),
      intl: context.intl,
    });
    return resolvedActions;
  };
  const instance = showToast(id, {
    build: (context) =>
      buildNotificationToastSpec(context, {
        id,
        title,
        message,
        icon,
        iconImageUri,
        imageUri,
        duration,
        position: platformEnv.isNative ? undefined : position,
        actions: resolveActions(context),
        actionsAlign,
        pressable: true,
      }),
    actions: () => resolvedActions ?? [],
    onClose: handleClose,
    onPress,
    shown: false,
    closed: false,
  });
  close = instance.close;
  return instance;
}

export { ToastContent } from './ToastContent';
export { ToastHost, ToastHost as Toaster } from './ToastHost';

export type IToastShowResult = {
  close: (extra?: { flag?: string }) => void | Promise<void>;
};

export const Toast = {
  success: (props: IToastProps) => {
    return toastMessage({ haptic: 'success', ...props });
  },
  error: (props: IToastProps) => {
    return toastMessage({ haptic: 'error', ...props });
  },
  warning: (props: IToastProps) => {
    return toastMessage({ haptic: 'warning', ...props });
  },
  message: (props: IToastProps) => {
    return toastMessage({ haptic: 'info', preset: 'none', ...props });
  },
  loading: (props: IToastProps) => {
    return toastMessage({ haptic: 'loading', ...props });
  },
  notification: (props: IToastNotificationProps) => {
    return toastNotification({ haptic: 'info', preset: 'none', ...props });
  },
  /* show custom view on Toast */
  show: ({
    onClose,
    children,
    ...others
  }: IShowToasterProps): IToastShowResult => {
    dismissKeyboard();
    let instanceRef: RefObject<IShowToasterInstance | null> | undefined =
      createRef();
    let portalRef:
      | {
          current: IPortalManager;
        }
      | undefined;

    let exitResolvers: Array<() => void> = [];
    let closeExtra: { flag?: string } | undefined;
    // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
    const handleClose = (extra?: { flag?: string }) =>
      new Promise<void>((resolve) => {
        closeExtra = extra;
        exitResolvers.push(resolve);
      });
    // The overlay finished its exit animation: remove the React node.
    // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
    const handleExited = () => {
      if (!portalRef) {
        return;
      }
      instanceRef = undefined;
      portalRef.current.destroy();
      portalRef = undefined;
      void onClose?.(closeExtra);
      exitResolvers.forEach((resolve) => resolve());
      exitResolvers = [];
    };
    portalRef = {
      current: mountImperativeOverlay({
        target: 'global',
        node: (
          <ShowCustom
            ref={instanceRef}
            onClose={handleClose}
            onExited={handleExited}
            {...others}
          >
            {children}
          </ShowCustom>
        ),
      }),
    };
    const close = async (extra?: { flag?: string }) => {
      if (!instanceRef?.current) {
        closeExtra = extra;
        handleExited();
        return;
      }
      return instanceRef?.current?.close(extra);
    };
    const r: IToastShowResult = {
      close,
    };
    return r;
  },
  Close: ShowToasterClose,
  dismiss: (id: string) => {
    toastIdMap.delete(id);
    const toast = activeToasts.get(id);
    if (toast) {
      closeToast(id, toast);
    }
  },
};
export type IToast = typeof Toast;

export { useToaster } from './ShowCustom';
export type { IShowToasterProps } from './ShowCustom';

// Kept for callers that still mount the provider; the app host now owns the
// React mount point for custom toasts.
export function ShowToastProvider() {
  return null;
}
