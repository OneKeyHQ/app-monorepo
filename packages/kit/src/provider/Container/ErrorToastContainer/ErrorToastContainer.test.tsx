/** @jest-environment jsdom */

import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import { act, fireEvent, render } from '@testing-library/react';

import { Dialog, Toast, globalNetInfo } from '@onekeyhq/components';
import { showOneKeyIdLoginDialog } from '@onekeyhq/kit/src/components/OneKeyAuth/oneKeyIdLoginDialogs';
import {
  InvalidPIN,
  NeedFirmwareUpgradeFromWeb,
  UnknownHardwareError,
} from '@onekeyhq/shared/src/errors';
import {
  ThirdPartyAppNotInstalled,
  ThirdPartyPassphraseAlwaysOnDevice,
} from '@onekeyhq/shared/src/errors/errors/thirdPartyHardwareErrors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { toPlainErrorObject } from '@onekeyhq/shared/src/errors/utils/errorUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { setNativeAppStorageEmergencyStatus } from '@onekeyhq/shared/src/storage/nativeStorageRecovery';

import { ErrorToastContainer } from './ErrorToastContainer';
import { getErrorAction } from './ErrorToasts';

const mockSubscribeNativeStorageContractViolations = jest.fn();
const mockOpenChangeLogModal = jest.fn();
const mockRootNavigate = jest.fn<void, unknown[]>();

jest.mock('@onekeyhq/shared/src/platformEnv', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/platformEnv')
  >('@onekeyhq/shared/src/platformEnv');
  return {
    ...actual,
    __esModule: true,
    default: { ...actual.default, isNative: true },
  };
});

jest.mock(
  '../../../views/FirmwareUpdate/hooks/useFirmwareUpdateActions',
  () => ({
    useFirmwareUpdateActions: () => ({
      openChangeLogModal: mockOpenChangeLogModal,
    }),
  }),
);

jest.mock(
  '@onekeyhq/kit/src/background/instance/backgroundApiProxy',
  () => ({}),
);
jest.mock('@onekeyhq/shared/src/modules3rdParty/intercom', () => ({}));
jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({}));

jest.mock('react-intl', () => {
  const actual = jest.requireActual<typeof import('react-intl')>('react-intl');
  const intl = actual.createIntl({
    locale: 'zh-CN',
    messages: jest.requireActual('@onekeyhq/shared/src/locale/json/zh_CN.json'),
  });
  return { ...actual, useIntl: () => intl };
});

jest.mock('@onekeyhq/components', () => ({
  Button: ({
    children,
    onPress,
  }: {
    children: import('react').ReactNode;
    onPress: () => void;
  }) => <button onClick={onPress}>{children}</button>,
  Toast: {
    dismiss: jest.fn(),
    error: jest.fn(),
    message: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
  },
  Dialog: { show: jest.fn() },
  rootNavigationRef: {
    current: { navigate: (...args: unknown[]) => mockRootNavigate(...args) },
  },
  globalNetInfo: {
    currentState: jest.fn(() => ({
      isInternetReachable: true,
    })),
  },
}));

jest.mock(
  '@onekeyhq/shared/src/storage/nativeStorageContractViolationSubscription',
  () => ({
    subscribeNativeStorageContractViolations: (
      listener: (violation: unknown) => void,
    ) => {
      const unsubscribe: unknown =
        mockSubscribeNativeStorageContractViolations(listener);
      return typeof unsubscribe === 'function' ? unsubscribe : () => undefined;
    },
  }),
);

jest.mock('./ErrorToasts', () => ({
  getErrorAction: jest.fn(() => undefined),
}));

const mockedToast = Toast as unknown as {
  error: jest.Mock;
};
const mockedGlobalNetInfo = globalNetInfo as unknown as {
  currentState: jest.Mock;
};

describe('ErrorToastContainer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getErrorAction).mockReset();
    jest.mocked(Dialog.show).mockImplementation((options) => ({
      close: async (extra) => {
        await options.onClose?.(extra);
      },
      getForm: () => undefined,
      isExist: () => true,
    }));
    setNativeAppStorageEmergencyStatus(undefined);
    mockSubscribeNativeStorageContractViolations.mockReturnValue(jest.fn());
    mockedGlobalNetInfo.currentState.mockReturnValue({
      isInternetReachable: true,
    });
  });

  it('shows a persistent ban dialog instead of an actionable toast', async () => {
    render(<ErrorToastContainer />);
    await act(async () => {
      appEventBus.emit(EAppEventBusNames.ShowToast, {
        method: 'error',
        title: 'This account has been banned.',
        errorCode: '90012',
        httpStatusCode: 403,
        requestId: 'login-denied',
        diagnosticText: 'Restricted OAuth sign-in',
      });
    });
    expect(Dialog.show).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'OneKeyID',
        description: '账号已被封禁',
        showCancelButton: false,
        onConfirmText: '我明白了',
        dismissOnOverlayPress: false,
        disableDrag: true,
      }),
    );
    expect(mockedToast.error).not.toHaveBeenCalled();
    expect(getErrorAction).not.toHaveBeenCalled();
    expect(mockRootNavigate).not.toHaveBeenCalled();
  });

  it('waits for the login dialog to close and deduplicates the persistent error', async () => {
    let finishClosing: (() => void) | undefined;
    const closing = new Promise<void>((resolve) => {
      finishClosing = resolve;
    });
    const onLoginClose = jest.fn();
    const close = jest.fn(async () => {
      await closing;
      await onLoginClose();
    });
    jest.mocked(Dialog.show).mockReturnValueOnce({
      close,
      getForm: () => undefined,
      isExist: () => true,
    });
    showOneKeyIdLoginDialog({ title: 'Login' });
    render(<ErrorToastContainer />);
    const showBan = () =>
      appEventBus.emit(EAppEventBusNames.ShowToast, {
        method: 'error',
        title: '',
        errorCode: 90_012,
      });
    act(() => {
      showBan();
      showBan();
    });
    expect(close).toHaveBeenCalledTimes(1);
    expect(Dialog.show).toHaveBeenCalledTimes(1);
    await act(async () => {
      finishClosing?.();
    });
    expect(onLoginClose).toHaveBeenCalledTimes(1);
    expect(Dialog.show).toHaveBeenCalledTimes(2);
    expect(Dialog.show).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: 'OneKeyID',
        description: '账号已被封禁',
      }),
    );
    await act(async () => {
      showBan();
    });
    expect(Dialog.show).toHaveBeenCalledTimes(2);
    const errorDialog = jest.mocked(Dialog.show).mock.calls[1][0];
    await act(async () => {
      await errorDialog.onClose?.();
      showBan();
    });
    expect(Dialog.show).toHaveBeenCalledTimes(3);
    expect(mockedToast.error).not.toHaveBeenCalled();
  });

  it.each([90_012, '90012'])(
    'shows a serialized ban %s as the ban dialog without a toast',
    async (errorCode) => {
      render(<ErrorToastContainer />);
      await act(async () => {
        appEventBus.emit(EAppEventBusNames.ShowToast, {
          method: 'error',
          title: '',
          errorCode,
        });
      });
      expect(Dialog.show).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'OneKeyID',
          description: '账号已被封禁',
        }),
      );
      expect(mockedToast.error).not.toHaveBeenCalled();
    },
  );

  const emergencyStatus = {
    mode: 'emergency',
    phase: 'active',
    epoch: '1-test',
    policy: 'retain-current-without-legacy-merge-v1',
  } as const;

  it('shows a persisted emergency warning when the toast consumer mounts after bootstrap and locale loading', () => {
    setNativeAppStorageEmergencyStatus(emergencyStatus);
    expect(Toast.warning).not.toHaveBeenCalled();
    const view = render(<ErrorToastContainer />);
    expect(Toast.warning).toHaveBeenCalledTimes(1);
    expect(Toast.warning).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: 'Emergency storage mode',
        message: expect.stringContaining('Migration is not complete'),
      }),
    );
    act(() => setNativeAppStorageEmergencyStatus({ ...emergencyStatus }));
    expect(Toast.warning).toHaveBeenCalledTimes(1);
    view.unmount();
    render(<ErrorToastContainer />);
    expect(Toast.warning).toHaveBeenCalledTimes(2);
  });

  it('subscribes to later emergency activation and stops observing after unmount', () => {
    const view = render(<ErrorToastContainer />);
    expect(Toast.warning).not.toHaveBeenCalled();
    act(() => setNativeAppStorageEmergencyStatus(emergencyStatus));
    expect(Toast.warning).toHaveBeenCalledTimes(1);
    act(() =>
      setNativeAppStorageEmergencyStatus({
        ...emergencyStatus,
        epoch: '2-test',
      }),
    );
    expect(Toast.warning).toHaveBeenCalledTimes(2);
    view.unmount();
    act(() =>
      setNativeAppStorageEmergencyStatus({
        ...emergencyStatus,
        epoch: '3-test',
      }),
    );
    expect(Toast.warning).toHaveBeenCalledTimes(2);
  });

  it('does not display native emergency status on non-native platforms', () => {
    const property = jest.replaceProperty(platformEnv, 'isNative', false);
    try {
      setNativeAppStorageEmergencyStatus(emergencyStatus);
      const view = render(<ErrorToastContainer />);
      expect(Toast.warning).not.toHaveBeenCalled();
      view.unmount();
    } finally {
      property.restore();
    }
  });

  it('forwards raw migration text, method, icon, duration and existing actions to the shared toast', async () => {
    const view = render(<ErrorToastContainer />);
    const title =
      'Native storage migration target is inconsistent:appStorage; App-storage MMKV migration marker is missing after migration completed';
    const action = <button type="button">Support</button>;
    jest.mocked(getErrorAction).mockReturnValueOnce(action);
    await act(async () =>
      appEventBus.emit(EAppEventBusNames.ShowToast, {
        method: 'warning',
        title,
        message: 'Original diagnostic details',
        icon: 'ErrorOutline',
        duration: 8000,
        toastId: 'caller-id',
        nativeStorageRecoveryTestSessionId: 'storage-repair-test-toast',
      }),
    );
    expect(Toast.warning).toHaveBeenCalledWith(
      expect.objectContaining({
        title,
        message: 'Original diagnostic details',
        icon: 'ErrorOutline',
        duration: 8000,
        toastId: 'caller-id',
        actions: action,
        nativeStorageRecoveryTestSessionId: 'storage-repair-test-toast',
      }),
    );
    expect(Toast.error).not.toHaveBeenCalled();
    view.unmount();
  });

  it('keeps the title verbatim when the migration diagnostic is only in message', async () => {
    const view = render(<ErrorToastContainer />);
    const message =
      'Native storage migration target is inconsistent:jotai; Jotai MMKV migration marker is missing after migration completed';
    await act(async () =>
      appEventBus.emit(EAppEventBusNames.ShowToast, {
        method: 'error',
        title: 'Original operation failure',
        message,
        i18nKey: ETranslations.wallet_action_failed,
        i18nInfo: { message: 'would replace the title' },
      }),
    );
    expect(Toast.error).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Original operation failure', message }),
    );
    view.unmount();
  });

  it('shows the Portfolio firmware guidance and opens updates for that device', async () => {
    const { unmount } = render(<ErrorToastContainer />);
    const error = {
      ...toPlainErrorObject(
        convertDeviceError({
          code: HardwareErrorCode.CallMethodNeedUpgradeFirmware,
          error: 'Device firmware version is too low',
          connectId: 'PORTFOLIO_DEVICE_ID',
          params: {
            method: 'uploadPortfolio',
            current: '1.0.2',
            require: '1.0.3',
          },
        }),
      ),
      autoToast: true,
    };
    const actual =
      jest.requireActual<typeof import('./ErrorToasts')>('./ErrorToasts');
    jest.mocked(getErrorAction).mockImplementationOnce(actual.getErrorAction);
    await act(async () => {
      errorToastUtils.showToastOfError(error);
    });
    expect(mockedToast.error).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '请将固件升级到版本 1.0.3 或更高版本以使用此功能',
      }),
    );
    const toast = mockedToast.error.mock.calls[0][0] as {
      actions: import('react').ReactElement;
    };
    const action = render(toast.actions);
    fireEvent.click(action.getByRole('button', { name: '检查更新' }));
    expect(mockOpenChangeLogModal).toHaveBeenCalledWith({
      connectId: 'PORTFOLIO_DEVICE_ID',
    });
    action.unmount();
    unmount();
  });

  it('shows a diagnostic toast for a blocked AsyncStorage API', () => {
    const { unmount } = render(<ErrorToastContainer />);
    const listener = mockSubscribeNativeStorageContractViolations.mock
      .calls[0][0] as (violation: {
      apiName: string;
      runtime: 'main' | 'background';
    }) => void;

    act(() => {
      listener({ apiName: 'useAsyncStorage', runtime: 'background' });
    });

    expect(mockedToast.error).toHaveBeenCalledWith({
      title: 'Unsupported AsyncStorage API',
      message:
        'useAsyncStorage was blocked in the background runtime. See the device log for the call stack.',
      toastId: 'native-storage-contract:background:useAsyncStorage',
      duration: 10_000,
    });
    unmount();
  });

  it('does not show axios network error toast when offline is already confirmed', () => {
    mockedGlobalNetInfo.currentState.mockReturnValue({
      isInternetReachable: false,
    });
    const { unmount } = render(<ErrorToastContainer />);

    act(() => {
      appEventBus.emit(EAppEventBusNames.ShowToast, {
        method: 'error',
        title: 'Network error',
        errorClassName: EOneKeyErrorClassNames.AxiosNetworkError,
      });
    });

    expect(mockedToast.error).not.toHaveBeenCalled();
    unmount();
  });

  it('does not show axios network error toast before offline status is confirmed', () => {
    const { unmount } = render(<ErrorToastContainer />);

    act(() => {
      appEventBus.emit(EAppEventBusNames.ShowToast, {
        method: 'error',
        title: '网络错误',
        errorClassName: EOneKeyErrorClassNames.AxiosNetworkError,
      });
    });

    expect(mockedToast.error).not.toHaveBeenCalled();
    unmount();
  });

  it('does not show timeout toast even when network status is online', () => {
    const { unmount } = render(<ErrorToastContainer />);

    act(() => {
      appEventBus.emit(EAppEventBusNames.ShowToast, {
        method: 'error',
        title: 'timeout of 30000ms exceeded',
        errorCode: 'ECONNABORTED',
        errorName: 'AxiosError',
      });
    });

    expect(mockedToast.error).not.toHaveBeenCalled();
    unmount();
  });

  it('shows numeric errorCode HTTP responses even when offline', () => {
    mockedGlobalNetInfo.currentState.mockReturnValue({
      isInternetReachable: false,
    });
    const { unmount } = render(<ErrorToastContainer />);

    act(() => {
      appEventBus.emit(EAppEventBusNames.ShowToast, {
        method: 'error',
        title: 'Network error',
        errorCode: 503,
      });
    });

    expect(mockedToast.error).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Network error',
      }),
    );
    unmount();
  });

  it('does not use default OneKey error code as an effective HTTP status', () => {
    const { unmount } = render(<ErrorToastContainer />);

    act(() => {
      appEventBus.emit(EAppEventBusNames.ShowToast, {
        method: 'error',
        title: '网络错误',
        errorClassName: EOneKeyErrorClassNames.AxiosNetworkError,
        errorCode: -99_999,
      });
    });

    expect(mockedToast.error).not.toHaveBeenCalled();
    unmount();
  });

  it('shows generic timeout text when it is not a transport timeout', () => {
    const { unmount } = render(<ErrorToastContainer />);

    act(() => {
      appEventBus.emit(EAppEventBusNames.ShowToast, {
        method: 'error',
        title: 'Device method call timeout',
      });
    });

    expect(mockedToast.error).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Device method call timeout',
      }),
    );
    unmount();
  });

  it.each([
    {
      errorCode: 110,
      title: 'Device Id in the features is not same.',
      i18nKey:
        ETranslations.hardware_device_information_is_inconsistent_it_may_be_caused_by_device_reset,
      expectedTitle:
        '设备连接状态已更新。请选择「添加钱包」>「连接硬件钱包」来重新设置。使用原助记词将恢复当前钱包，使用新助记词将创建新钱包。',
    },
    {
      errorCode: 118,
      title: 'Device check unlock type not match error',
      i18nKey: ETranslations.hardware_device_pin_state_error,
      expectedTitle: '输入的PIN码与当前钱包不符。请重试。',
    },
    {
      errorCode: 112,
      title: 'Device passphrase state error',
      i18nKey: ETranslations.hardware_device_passphrase_state_error,
      expectedTitle: 'Passphrase 与当前钱包不匹配，请再试一次',
    },
  ])(
    'localizes hardware error $errorCode on the main thread',
    ({ errorCode, title, i18nKey, expectedTitle }) => {
      const { unmount } = render(<ErrorToastContainer />);

      act(() => {
        appEventBus.emit(EAppEventBusNames.ShowToast, {
          method: 'error',
          title,
          errorCode,
          i18nKey,
        });
      });

      expect(mockedToast.error).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expectedTitle,
        }),
      );
      unmount();
    },
  );

  it.each([
    {
      ErrorClass: NeedFirmwareUpgradeFromWeb,
      expectedTitle:
        '您的硬件钱包固件需要更新。请在电脑上访问 firmware.onekey.so 进行升级。',
    },
    {
      ErrorClass: UnknownHardwareError,
      expectedTitle:
        '操作失败。请确保您的硬件和应用程序均为最新版本，或联系技术支持。 Firmware response detail : 800',
    },
  ])(
    'localizes the recovery toast from $ErrorClass.name and retains its action',
    async ({ ErrorClass, expectedTitle }) => {
      const { unmount } = render(<ErrorToastContainer />);
      const error = new ErrorClass({
        payload: {
          connectId: 'FIRMWARE_DEVICE_ID',
          code: 800,
          error: 'Firmware response detail',
        },
      });
      error.autoToast = true;
      // Error construction under Jest leaves the background fallback text;
      // the real UI formatter above must supply the Chinese guidance.
      expect(error.message).not.toBe(expectedTitle);
      const action = <span>Update firmware</span>;
      jest.mocked(getErrorAction).mockReturnValueOnce(action);
      const onShowToast = jest.fn();
      appEventBus.on(EAppEventBusNames.ShowToast, onShowToast);
      try {
        await act(async () => {
          errorToastUtils.showToastOfError(error);
        });
        expect(onShowToast).toHaveBeenCalledWith(
          expect.objectContaining({
            i18nKey: error.key,
            i18nInfo: error.info,
          }),
        );
        expect(getErrorAction).toHaveBeenCalledWith(
          expect.objectContaining({
            errorCode: error.code,
            connectId: 'FIRMWARE_DEVICE_ID',
          }),
        );
        expect(mockedToast.error).toHaveBeenCalledWith(
          expect.objectContaining({
            title: expectedTitle,
            actions: action,
          }),
        );
      } finally {
        appEventBus.off(EAppEventBusNames.ShowToast, onShowToast);
        unmount();
      }
    },
  );

  it('preserves raw details for unrelated parameterized error keys', () => {
    const { unmount } = render(<ErrorToastContainer />);

    act(() => {
      appEventBus.emit(EAppEventBusNames.ShowToast, {
        method: 'error',
        title: 'The request is too large for the current connection.',
        errorCode: 833,
        i18nKey: ETranslations.wallet_action_failed,
      });
    });

    expect(mockedToast.error).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'The request is too large for the current connection.',
      }),
    );
    unmount();
  });

  it.each([
    InvalidPIN,
    ThirdPartyPassphraseAlwaysOnDevice,
    ThirdPartyAppNotInstalled,
  ])(
    'localizes %s through the hardware error toast event',
    async (ErrorClass) => {
      const { unmount } = render(<ErrorToastContainer />);
      const error = new ErrorClass({
        payload: { error: 'Raw firmware English error' },
        info: { appName: 'Ethereum' },
        appName: 'Ethereum',
      });
      error.autoToast = true;
      const onShowToast = jest.fn();
      appEventBus.on(EAppEventBusNames.ShowToast, onShowToast);
      try {
        await act(async () => {
          errorToastUtils.showToastOfError(error);
        });
        expect(onShowToast).toHaveBeenCalledWith(
          expect.objectContaining({
            isHardwareError: true,
            i18nKey: error.key,
            i18nInfo: error.info,
          }),
        );
        const messages: Record<string, string> = jest.requireActual(
          '@onekeyhq/shared/src/locale/json/zh_CN.json',
        );
        expect(mockedToast.error).toHaveBeenCalledWith(
          expect.objectContaining({
            title: messages[error.key as string].replace(
              '{appName}',
              'Ethereum',
            ),
          }),
        );
      } finally {
        appEventBus.off(EAppEventBusNames.ShowToast, onShowToast);
        unmount();
      }
    },
  );

  it('preserves raw hardware messages without a known translation key', () => {
    const { unmount } = render(<ErrorToastContainer />);
    act(() => {
      appEventBus.emit(EAppEventBusNames.ShowToast, {
        method: 'error',
        title: 'Unknown firmware failure',
        isHardwareError: true,
        i18nKey: 'onekey_error' as ETranslations,
      });
    });
    expect(mockedToast.error).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Unknown firmware failure' }),
    );
    unmount();
  });
});
