import type { RefObject } from 'react';
import { createRef } from 'react';

import { overlayToastStore } from '@onekeyfe/react-native-native-overlay';
import { Platform } from 'react-native';

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

const DEFAULT_MESSAGE_DURATION = 5000;
const DEFAULT_SIMPLE_SUCCESS_DURATION = 3000;

function validateToastTitle(title: string) {
  if (platformEnv.isDev && title?.length === 0) {
    throw new OneKeyLocalError(
      `The parameter 'title' cannot be an empty string`,
    );
  }
}

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
  let entry: [number, number] | undefined;
  const handleClose = () => {
    if (toastId && entry && toastIdMap.get(toastId) === entry) {
      toastIdMap.delete(toastId);
    }
    onClose?.();
  };
  validateToastTitle(title);
  if (toastId) {
    const existing = toastIdMap.get(toastId);
    if (existing) {
      const [createdAt, toastDuration] = existing;
      if (Date.now() - createdAt < toastDuration) {
        return;
      }
      toastIdMap.delete(toastId);
    }
    entry = [Date.now(), duration + 500];
    toastIdMap.set(toastId, entry);
  }
  return handleClose;
};

interface IActiveToast {
  renderId: string;
  build: (context: IToastStyleContext) => IOverlayToastSpec;
  /** The row as last built, for routing a press to its handler. */
  actions: () => IToastAction[];
  onClose: () => void;
  onPress?: () => void;
  /** False while it waits for the style context to draw with. */
  shown: boolean;
  closed: boolean;
  dismissed?: boolean;
  restartLifetime?: boolean;
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

function isToastLiveInStore(id: string): boolean {
  const snapshot = overlayToastStore.getSnapshot?.();
  if (!snapshot?.items) {
    return true;
  }
  return snapshot.items.some((item) => item.spec.id === id);
}

function reconcileActiveToasts() {
  const snapshot = overlayToastStore.getSnapshot?.();
  if (!snapshot?.items) {
    return;
  }
  const liveIds = new Set(snapshot.items.map((item) => item.spec.id));
  const evicted = [...activeToasts.entries()].filter(
    ([, toast]) => toast.shown && !liveIds.has(toast.renderId),
  );
  evicted.forEach(([id, toast]) => {
    if (
      !toast.closed &&
      activeToasts.get(id) === toast &&
      !isToastLiveInStore(toast.renderId)
    ) {
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
  if (!context || toast.dismissed || toast.closed) {
    return;
  }
  ensureToastStoreSubscription();
  const spec = toast.build(context);
  if (toast.shown && !toast.restartLifetime) {
    overlayToastStore.update(spec);
    return;
  }
  toast.shown = true;
  toast.restartLifetime = false;
  overlayToastStore.show(spec, {
    onDismiss: () => {
      if (toast.renderId === spec.id) toast.dismissed = true;
    },
    onClose: () => {
      if (toast.renderId === spec.id) finishToast(id, toast);
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
  toast.dismissed = true;
  overlayToastStore.dismiss(toast.renderId);
}

function retireToastCard(id: string) {
  const item = overlayToastStore
    .getSnapshot()
    .items.find(({ spec }) => spec.id === id);
  if (!item) return;

  // A dismissed card still occupies its queue slot during the exit.
  overlayToastStore.dismiss(id);
  overlayToastStore.handleEvent({
    type: 'close',
    id,
    generation: item.generation,
    reason: 'programmatic',
  });
}

function showToast(id: string, toast: IActiveToast) {
  const previous = activeToasts.get(id);
  if (previous) {
    finishToast(id, previous);
    if (previous.shown && previous.renderId !== toast.renderId) {
      retireToastCard(previous.renderId);
    }
  }
  activeToasts.set(id, toast);
  presentToast(id, toast);
  return {
    close: () => closeToast(id, toast),
  };
}

function createMessageContent(
  {
    title,
    message,
    icon,
    duration = DEFAULT_MESSAGE_DURATION,
    haptic,
    actions,
    actionsAlign = 'right',
    position,
    nativeStorageRecoveryTestSessionId,
  }: IToastBaseProps,
  id: string,
  close: () => void,
): Pick<IActiveToast, 'build' | 'actions'> {
  const callerActions = toActionList(actions);
  let resolvedActions: IToastAction[] | undefined;
  // The retry label needs the app's locale, which arrives with the context.
  const resolveActions = (context: IToastStyleContext) => {
    resolvedActions ??= withRecoveryAction({
      title,
      message,
      actions: callerActions,
      testSessionId: nativeStorageRecoveryTestSessionId,
      close,
      intl: context.intl,
    });
    return resolvedActions;
  };
  return {
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
  };
}

function showMessageToast(props: IToastBaseProps) {
  const {
    title,
    toastId,
    duration = DEFAULT_MESSAGE_DURATION,
    onClose,
  } = props;
  const handleClose = handleToastId({ title, toastId, duration, onClose });
  if (!handleClose) return;
  const id = toastId ?? overlayToastStore.createId();
  const toast: IActiveToast = {
    ...createMessageContent(props, id, () => closeToast(id, toast)),
    renderId: id,
    onClose: handleClose,
    shown: false,
    closed: false,
  };
  return { id, toast, handle: showToast(id, toast) };
}

function toastMessage(props: IToastBaseProps) {
  return showMessageToast(props)?.handle;
}

export type IToastSettleStatus = 'success' | 'error' | 'warning' | 'info';

export interface IToastLoadingResult {
  close: () => void;
  /** Shows the result and starts its timeout. Returns false if the caller must show it separately. */
  settle: (
    status: IToastSettleStatus,
    props: Omit<IToastBaseProps, 'toastId' | 'onClose' | 'haptic' | 'preset'>,
    options?: { showAtFrontOnWeb?: boolean },
  ) => boolean;
}

export interface IToastPromiseMessages<T> {
  loading: string | Omit<IToastBaseProps, 'haptic' | 'preset'>;
  success:
    | string
    | Omit<IToastBaseProps, 'toastId' | 'onClose' | 'haptic' | 'preset'>
    | ((
        data: T,
      ) =>
        | string
        | Omit<IToastBaseProps, 'toastId' | 'onClose' | 'haptic' | 'preset'>);
  error:
    | string
    | Omit<IToastBaseProps, 'toastId' | 'onClose' | 'haptic' | 'preset'>
    | ((
        error: unknown,
      ) =>
        | string
        | Omit<IToastBaseProps, 'toastId' | 'onClose' | 'haptic' | 'preset'>);
}

function normalizeToastProps<T extends { title: string }>(
  value: string | T,
): T {
  return typeof value === 'string' ? ({ title: value } as T) : value;
}

function isCoveredOnWeb(
  id: string,
  position: IOverlayToastPosition | undefined,
) {
  const snapshot = overlayToastStore.getSnapshot();
  const defaultPosition = snapshot.config.position ?? 'bottom-right';
  const first = snapshot.items.find(
    ({ spec, visible }) =>
      spec.id === id ||
      (visible &&
        (spec.position ?? defaultPosition) === (position ?? defaultPosition)),
  );
  return first !== undefined && first.spec.id !== id;
}

function toastLoading(props: IToastBaseProps): IToastLoadingResult | undefined {
  const instance = showMessageToast({ haptic: 'loading', ...props });
  if (!instance) return;
  const { id, toast, handle } = instance;
  const entry = props.toastId ? toastIdMap.get(props.toastId) : undefined;
  let settled = false;

  return {
    close: handle.close,
    settle: (status, result, { showAtFrontOnWeb } = {}) => {
      if (
        settled ||
        toast.dismissed ||
        toast.closed ||
        activeToasts.get(id) !== toast
      ) {
        return false;
      }
      const position = result.position ?? props.position;
      validateToastTitle(result.title);
      const previousRenderId = toast.renderId;
      // Native renderers announce on attachment. On web, replace only when
      // the caller requested a front card and a newer toast covers the result.
      const isNative = Platform.select({
        native: true,
        default: false,
      });
      const replaceCard =
        toast.shown &&
        (isNative ||
          (showAtFrontOnWeb && isCoveredOnWeb(previousRenderId, position)));
      const renderId = replaceCard
        ? overlayToastStore.createId()
        : previousRenderId;
      const content = createMessageContent(
        {
          ...result,
          position,
          haptic: status,
        },
        renderId,
        handle.close,
      );
      settled = true;
      if (entry) {
        entry[0] = Date.now();
        entry[1] = (result.duration ?? DEFAULT_MESSAGE_DURATION) + 500;
      }
      Object.assign(toast, content);
      // Theme redraws keep the existing timeout.
      toast.restartLifetime = true;
      if (replaceCard) {
        toast.renderId = renderId;
        toast.shown = false;
        retireToastCard(previousRenderId);
      }
      presentToast(id, toast);
      return true;
    },
  };
}

/** An active toast ID owns the feedback for one task. Other tasks still run. */
function toastPromise<T>(
  task: Promise<T> | (() => Promise<T>),
  messages: IToastPromiseMessages<T>,
  options: Pick<
    IToastBaseProps,
    'toastId' | 'duration' | 'position' | 'onClose'
  > = {},
): Promise<T> {
  const loadingProps = normalizeToastProps(messages.loading);
  const loadingPosition = loadingProps.position ?? options.position;
  const loading = toastLoading({
    ...options,
    ...loadingProps,
    position: loadingPosition,
    duration: Infinity,
  });
  const showResult = (
    status: 'success' | 'error',
    resolveProps: () => string | IToastBaseProps,
  ) => {
    if (!loading) return;
    try {
      const props = normalizeToastProps(resolveProps());
      const resultProps = {
        duration: options.duration,
        ...props,
        position: props.position ?? loadingPosition,
      };
      if (!loading.settle(status, resultProps)) {
        toastMessage({ haptic: status, ...resultProps });
      }
    } catch {
      try {
        loading.close();
      } catch {
        // Toast presentation and cleanup must preserve the task outcome.
      }
    }
  };
  const pending =
    typeof task === 'function' ? Promise.resolve().then(task) : task;
  return pending.then(
    (data) => {
      showResult('success', () =>
        typeof messages.success === 'function'
          ? messages.success(data)
          : messages.success,
      );
      return data;
    },
    (error) => {
      showResult('error', () =>
        typeof messages.error === 'function'
          ? messages.error(error)
          : messages.error,
      );
      throw error;
    },
  );
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
    renderId: id,
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
    const defaultDuration =
      props.message || toActionList(props.actions).length > 0
        ? DEFAULT_MESSAGE_DURATION
        : DEFAULT_SIMPLE_SUCCESS_DURATION;
    return toastMessage({
      haptic: 'success',
      ...props,
      duration: props.duration ?? defaultDuration,
    });
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
  loading: toastLoading,
  promise: toastPromise,
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
