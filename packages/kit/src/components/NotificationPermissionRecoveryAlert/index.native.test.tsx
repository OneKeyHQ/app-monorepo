import type { ReactNode } from 'react';

import { act, render } from '@testing-library/react-native';

import {
  ENotificationPermission,
  ENotificationPermissionRecoveryReason,
  ENotificationPermissionRecoverySource,
} from '@onekeyhq/shared/types/notification';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

import { NotificationPermissionRecoveryAlert } from './index.native';

type IMockAlertProps = {
  action?: {
    onPrimaryPress?: () => void;
  };
  title?: string;
};

let mockAlertProps: IMockAlertProps | undefined;

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  function Alert(props: IMockAlertProps) {
    mockAlertProps = props;
    return null;
  }

  function Stack({ children }: { children?: ReactNode }) {
    return <>{children}</>;
  }

  return { Alert, Stack };
});

jest.mock('@onekeyhq/shared/src/locale', () => ({
  ETranslations: {
    backup_go_system_settings: 'backup_go_system_settings',
    global_enable: 'global_enable',
    notifications_intro_title: 'notifications_intro_title',
  },
}));

jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: {
    wait: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceNotification: {
      checkNotificationPermissionRecovery: jest.fn(),
      dismissNotificationPermissionRecovery: jest.fn(),
      recoverNotificationPermission: jest.fn(),
    },
  },
}));

jest.mock('../../hooks/useHandleAppStateActive', () => ({
  useHandleAppStateActive: jest.fn(),
}));

jest.mock('../../hooks/useRouteIsFocused', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  let currentFocus = true;
  const listeners: Array<(value: boolean) => void> = [];

  const useRouteIsFocused = () => {
    const [isFocused, setIsFocused] =
      ReactModule.useState<boolean>(currentFocus);
    ReactModule.useEffect(() => {
      listeners.push(setIsFocused);
      return () => {
        const index = listeners.indexOf(setIsFocused);
        if (index >= 0) {
          listeners.splice(index, 1);
        }
      };
    }, [setIsFocused]);
    return isFocused;
  };

  return {
    useRouteIsFocused,
    __resetFocus: () => {
      currentFocus = true;
    },
    __setFocus: (value: boolean) => {
      currentFocus = value;
      listeners.slice().forEach((listener) => listener(value));
    },
  };
});

const focusControl = jest.requireMock('../../hooks/useRouteIsFocused') as {
  __resetFocus: () => void;
  __setFocus: (value: boolean) => void;
};

const notificationService =
  backgroundApiProxy.serviceNotification as unknown as {
    checkNotificationPermissionRecovery: jest.Mock;
    dismissNotificationPermissionRecovery: jest.Mock;
    recoverNotificationPermission: jest.Mock;
  };

const visibleResult = {
  checkedAt: 1,
  isSupported: true,
  isTestMode: false,
  permission: ENotificationPermission.denied,
  pushEnabled: true,
  reason: ENotificationPermissionRecoveryReason.permissionRequired,
  shouldShow: true,
};

function createDeferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

describe('NotificationPermissionRecoveryAlert', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    focusControl.__resetFocus();
    mockAlertProps = undefined;
    notificationService.dismissNotificationPermissionRecovery.mockResolvedValue(
      undefined,
    );
    notificationService.recoverNotificationPermission.mockResolvedValue(
      undefined,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('discards an in-flight check after the route loses focus', async () => {
    const deferred = createDeferred<typeof visibleResult>();
    notificationService.checkNotificationPermissionRecovery.mockReturnValueOnce(
      deferred.promise,
    );

    render(
      <NotificationPermissionRecoveryAlert scene="home" initialDelayMs={0} />,
    );

    act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(
      notificationService.checkNotificationPermissionRecovery,
    ).toHaveBeenCalledTimes(1);

    act(() => {
      focusControl.__setFocus(false);
    });
    await act(async () => {
      deferred.resolve(visibleResult);
      await deferred.promise;
    });

    expect(mockAlertProps).toBeUndefined();
  });

  it('passes the freshly loaded settings snapshot to the background check', async () => {
    notificationService.checkNotificationPermissionRecovery.mockResolvedValueOnce(
      visibleResult,
    );

    render(
      <NotificationPermissionRecoveryAlert scene="settings" pushEnabled />,
    );
    await act(async () => {
      jest.runOnlyPendingTimers();
      await Promise.resolve();
    });

    expect(
      notificationService.checkNotificationPermissionRecovery,
    ).toHaveBeenCalledWith({
      ignoreCooldown: true,
      pushEnabled: true,
      source: ENotificationPermissionRecoverySource.settings,
    });
  });

  it('does not re-check after a recovery action loses focus', async () => {
    const recoveryDeferred = createDeferred<void>();
    notificationService.checkNotificationPermissionRecovery.mockResolvedValueOnce(
      visibleResult,
    );
    notificationService.recoverNotificationPermission.mockReturnValueOnce(
      recoveryDeferred.promise,
    );

    render(
      <NotificationPermissionRecoveryAlert scene="home" initialDelayMs={0} />,
    );
    await act(async () => {
      jest.runOnlyPendingTimers();
      await Promise.resolve();
    });

    act(() => {
      mockAlertProps?.action?.onPrimaryPress?.();
    });
    expect(
      notificationService.recoverNotificationPermission,
    ).toHaveBeenCalledTimes(1);

    act(() => {
      focusControl.__setFocus(false);
    });
    await act(async () => {
      recoveryDeferred.resolve();
      await recoveryDeferred.promise;
      await Promise.resolve();
    });

    expect(
      notificationService.checkNotificationPermissionRecovery,
    ).toHaveBeenCalledTimes(1);
  });
});
