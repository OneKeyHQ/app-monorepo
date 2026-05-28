import { CommonActions } from '@react-navigation/native';
import { isEqual } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Toast,
  closeAllDialogInstances,
  getDialogInstances,
  getFormInstances,
  rootNavigationRef,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { ERootRoutes } from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

const REFERRAL_BIND_BLOCKED_TOAST_DURATION = 60 * 60 * 1000;
const REFERRAL_BLOCKING_ROOT_ROUTE_NAMES = new Set<string>([
  ERootRoutes.Modal,
  ERootRoutes.iOSFullScreen,
  ERootRoutes.FullScreenPush,
  ERootRoutes.WebView,
  ERootRoutes.Onboarding,
  ERootRoutes.PermissionWebDevice,
]);

let referralBlockingToast: ReturnType<typeof Toast.message> | undefined;
let referralBlockingToastToken = 0;

type IReferralBlockingRootRouteSnapshot = {
  fallbackId: string;
  key?: string;
};

export type IReferralBlockingOverlayContinueParams = {
  shouldContinue: () => boolean;
};

function ReferralBlockingOverlayToastAction({
  onPress,
}: {
  onPress: () => void;
}) {
  const intl = useIntl();

  return (
    <Button
      testID="referral-bind-close-current-window-toast-btn"
      size="small"
      variant="primary"
      onPress={onPress}
    >
      {intl.formatMessage({
        id: ETranslations.explore_close_all,
      })}
    </Button>
  );
}

function isReferralBlockingRootRouteName(routeName?: string) {
  return !!routeName && REFERRAL_BLOCKING_ROOT_ROUTE_NAMES.has(routeName);
}

function isReferralBlockingRootOverlayOpen() {
  const rootState = rootNavigationRef.current?.getRootState();
  if (!rootState) {
    return false;
  }

  const hasMainRoute = rootState.routes.some(
    (route) => route.name === ERootRoutes.Main,
  );
  const currentRoute = rootState.routes[rootState.index ?? 0];

  return hasMainRoute && isReferralBlockingRootRouteName(currentRoute?.name);
}

function getReferralBlockingRootRouteSnapshots() {
  const rootState = rootNavigationRef.current?.getRootState();
  if (!rootState) {
    return [];
  }

  const hasMainRoute = rootState.routes.some(
    (route) => route.name === ERootRoutes.Main,
  );
  if (!hasMainRoute) {
    return [];
  }

  return rootState.routes.flatMap((route, index) => {
    if (!isReferralBlockingRootRouteName(route.name)) {
      return [];
    }
    return [
      {
        fallbackId: `${index}:${route.name}`,
        key: route.key,
      },
    ];
  });
}

function hasOpenDialogInstance() {
  return getDialogInstances().some((instance) => instance.isExist());
}

function hasDirtyFormInstance() {
  const formInstances = getFormInstances();
  const formInstance = formInstances[formInstances.length - 1];
  return (
    !!formInstance &&
    !isEqual(formInstance.formState.defaultValues, formInstance.getValues())
  );
}

export function hasReferralBlockingOverlayOpen() {
  return isReferralBlockingRootOverlayOpen() || hasOpenDialogInstance();
}

function resetReferralBlockingRootOverlays(
  snapshots: IReferralBlockingRootRouteSnapshot[],
) {
  if (!snapshots.length) {
    return;
  }
  const rootState = rootNavigationRef.current?.getRootState();
  if (!rootState) {
    return;
  }

  const snapshotKeys = new Set(
    snapshots.map((snapshot) => snapshot.key).filter(Boolean),
  );
  const snapshotFallbackIds = new Set(
    snapshots.map((snapshot) => snapshot.fallbackId),
  );
  const routes = rootState.routes.filter((route, index) => {
    if (!isReferralBlockingRootRouteName(route.name)) {
      return true;
    }
    if (route.key && snapshotKeys.has(route.key)) {
      return false;
    }
    if (!route.key && snapshotFallbackIds.has(`${index}:${route.name}`)) {
      return false;
    }
    return true;
  });
  if (routes.length === rootState.routes.length || routes.length === 0) {
    return;
  }

  rootNavigationRef.current?.dispatch(
    CommonActions.reset({
      ...rootState,
      routes,
      index: routes.length - 1,
    }),
  );
}

function confirmCloseDirtyFormIfNeeded() {
  if (!hasDirtyFormInstance()) {
    return Promise.resolve(true);
  }

  return new Promise<boolean>((resolve) => {
    let isSettled = false;
    const resolveOnce = (result: boolean) => {
      if (isSettled) {
        return;
      }
      isSettled = true;
      resolve(result);
    };

    Dialog.show({
      // eslint-disable-next-line onekey/no-app-locale-main-thread -- deep-link overlay guard can run outside React render.
      title: appLocale.intl.formatMessage({
        id: ETranslations.global_close,
      }),
      // eslint-disable-next-line onekey/no-app-locale-main-thread -- deep-link overlay guard can run outside React render.
      description: appLocale.intl.formatMessage({
        id: ETranslations.global_close_confirm_description,
      }),
      showCancelButton: true,
      showFooter: true,
      showConfirmButton: true,
      onCancel: () => {
        resolveOnce(false);
      },
      onConfirm: () => {
        resolveOnce(true);
      },
      onClose: (extra) => {
        if (extra?.flag !== 'confirm') {
          resolveOnce(false);
        }
      },
    });
  });
}

async function closeReferralBlockingOverlays({
  shouldContinue,
}: {
  shouldContinue: () => boolean;
}) {
  const rootRouteSnapshots = getReferralBlockingRootRouteSnapshots();
  if (!(await confirmCloseDirtyFormIfNeeded()) || !shouldContinue()) {
    return false;
  }
  await closeAllDialogInstances();
  if (!shouldContinue()) {
    return false;
  }
  resetReferralBlockingRootOverlays(rootRouteSnapshots);
  await timerUtils.wait(100);
  return shouldContinue() && !hasReferralBlockingOverlayOpen();
}

export function showReferralBlockingOverlayToast({
  onContinue,
  shouldContinue,
}: {
  shouldContinue?: () => boolean;
  onContinue: (
    params: IReferralBlockingOverlayContinueParams,
  ) => void | Promise<void>;
}) {
  referralBlockingToastToken += 1;
  const currentToken = referralBlockingToastToken;

  if (!hasReferralBlockingOverlayOpen()) {
    void referralBlockingToast?.close();
    referralBlockingToast = undefined;
    return false;
  }

  void referralBlockingToast?.close();
  let isHandlingContinue = false;
  const currentToastRef: {
    current?: ReturnType<typeof Toast.message>;
  } = {};
  const closeCurrentToast = () => {
    void currentToastRef.current?.close();
  };
  const canContinue = () =>
    currentToken === referralBlockingToastToken && (shouldContinue?.() ?? true);
  const handleCloseAndContinue = () => {
    if (isHandlingContinue) {
      return;
    }
    if (!canContinue()) {
      closeCurrentToast();
      return;
    }
    isHandlingContinue = true;
    closeCurrentToast();
    void (async () => {
      try {
        if (
          !(await closeReferralBlockingOverlays({
            shouldContinue: canContinue,
          }))
        ) {
          return;
        }
        await onContinue({ shouldContinue: canContinue });
      } catch (error) {
        defaultLogger.app.error.log(
          `Failed to continue referral binding: ${String(error)}`,
        );
      } finally {
        isHandlingContinue = false;
      }
    })();
  };

  currentToastRef.current = Toast.message({
    duration: REFERRAL_BIND_BLOCKED_TOAST_DURATION,
    // eslint-disable-next-line onekey/no-app-locale-main-thread -- deep-link overlay guard can run outside React render.
    title: appLocale.intl.formatMessage({
      id: ETranslations.referral_close_current_popup_title,
    }),
    // eslint-disable-next-line onekey/no-app-locale-main-thread -- deep-link overlay guard can run outside React render.
    message: appLocale.intl.formatMessage({
      id: ETranslations.referral_close_current_popup_desc,
    }),
    actionsAlign: 'left',
    onClose: () => {
      if (
        currentToken === referralBlockingToastToken &&
        referralBlockingToast === currentToastRef.current
      ) {
        referralBlockingToast = undefined;
      }
    },
    actions: (
      <ReferralBlockingOverlayToastAction onPress={handleCloseAndContinue} />
    ),
  });
  referralBlockingToast = currentToastRef.current;

  return true;
}
